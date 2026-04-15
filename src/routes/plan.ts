import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import type { DB } from "../db/connection.js";
import { dailyPlans, conceptMastery } from "../db/schema.js";
import { computePriority } from "../learning/priority.js";
import type { KnowledgeService } from "../knowledge/knowledge-service.js";
import type { AuthVariables } from "../auth/types.js";
import { resolveStudentId } from "../auth/resolve-student.js";

export function createPlanRoutes(db: DB, kb: KnowledgeService): Hono<{ Variables: AuthVariables }> {
  const api = new Hono<{ Variables: AuthVariables }>();

  // GET /plan/today — get or auto-generate today's plan
  api.get("/today", async (c) => {
    const userId = resolveStudentId(c);
    const courseId = c.req.query("course") || "middle/grade7-up/english";
    const today = new Date().toISOString().split("T")[0];

    // Check if plan already exists
    const existing = await db
      .select()
      .from(dailyPlans)
      .where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.courseId, courseId), eq(dailyPlans.planDate, today)));

    if (existing.length) return c.json(existing[0]);

    // Auto-generate plan
    const plan = await autoGeneratePlan(db, kb, userId, courseId);

    const [row] = await db
      .insert(dailyPlans)
      .values({
        userId,
        courseId,
        planDate: today,
        tasks: plan.tasks,
        totalMinutes: plan.totalMinutes,
        source: "auto",
      })
      .returning();

    return c.json(row);
  });

  // POST /plan — Agent creates a custom plan
  api.post("/", async (c) => {
    const userId = resolveStudentId(c);
    const body = await c.req.json();
    const { courseId, date, tasks, totalMinutes } = body;

    if (!courseId || !tasks) return c.json({ error: "courseId and tasks required" }, 400);

    const planDate = date || new Date().toISOString().split("T")[0];

    // Upsert: replace if exists for same day
    const existing = await db
      .select()
      .from(dailyPlans)
      .where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.courseId, courseId), eq(dailyPlans.planDate, planDate)));

    if (existing.length) {
      await db
        .update(dailyPlans)
        .set({ tasks, totalMinutes, source: "agent", completedCount: 0 })
        .where(eq(dailyPlans.id, existing[0].id));

      const [updated] = await db.select().from(dailyPlans).where(eq(dailyPlans.id, existing[0].id));
      return c.json(updated);
    }

    const [row] = await db
      .insert(dailyPlans)
      .values({ userId, courseId, planDate, tasks, totalMinutes, source: "agent" })
      .returning();

    return c.json(row);
  });

  // PATCH /plan/:id/task/:index — update task status
  api.patch("/:id/task/:index", async (c) => {
    const planId = c.req.param("id");
    const taskIndex = parseInt(c.req.param("index"));
    const body = await c.req.json();

    const rows = await db.select().from(dailyPlans).where(eq(dailyPlans.id, planId));
    if (!rows.length) return c.json({ error: "plan not found" }, 404);

    const plan = rows[0];
    const tasks = plan.tasks as any[];

    if (taskIndex < 0 || taskIndex >= tasks.length) {
      return c.json({ error: "invalid task index" }, 400);
    }

    tasks[taskIndex].status = body.status || "completed";
    const completedCount = tasks.filter((t: any) => t.status === "completed").length;

    await db
      .update(dailyPlans)
      .set({ tasks, completedCount })
      .where(eq(dailyPlans.id, planId));

    return c.json({ ok: true, completedCount, total: tasks.length });
  });

  // GET /plan/:id — get a specific plan
  api.get("/:id", async (c) => {
    const planId = c.req.param("id");
    const rows = await db.select().from(dailyPlans).where(eq(dailyPlans.id, planId));
    if (!rows.length) return c.json({ error: "plan not found" }, 404);
    return c.json(rows[0]);
  });

  return api;
}

// --- Auto Plan Generator ---

async function autoGeneratePlan(
  db: DB,
  kb: KnowledgeService,
  userId: string,
  courseId: string
): Promise<{ tasks: any[]; totalMinutes: number }> {
  // Get all mastery data
  const masteries = await db
    .select()
    .from(conceptMastery)
    .where(and(eq(conceptMastery.userId, userId), eq(conceptMastery.courseId, courseId)));

  const now = new Date().toISOString();
  const tasks: any[] = [];

  // Task 1: Review due concepts
  const dueConcepts = masteries
    .filter((m) => m.nextReviewAt && m.nextReviewAt <= now)
    .map((m) => ({ ...m, priority: computePriority(m) }))
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);

  if (dueConcepts.length) {
    tasks.push({
      type: "review",
      conceptIds: dueConcepts.map((m) => m.conceptId),
      mode: "review",
      count: Math.min(dueConcepts.length * 4, 12),
      minutes: 15,
      status: "pending",
      description: `复习 ${dueConcepts.map((m) => m.conceptId).join("、")}`,
    });
  }

  // Task 2: Practice weak concepts
  const weakConcepts = masteries
    .filter((m) => m.totalAttempts >= 3 && m.correctCount / m.totalAttempts < 0.6)
    .sort((a, b) => (a.correctCount / a.totalAttempts) - (b.correctCount / b.totalAttempts))
    .slice(0, 2);

  if (weakConcepts.length) {
    tasks.push({
      type: "practice",
      conceptIds: weakConcepts.map((m) => m.conceptId),
      mode: "practice",
      count: 8,
      minutes: 15,
      status: "pending",
      description: `强化 ${weakConcepts.map((m) => m.conceptId).join("、")}`,
    });
  }

  // Task 3: Explore new concepts (not yet practiced)
  const allConcepts = kb.listConcepts(courseId);
  const practicedIds = new Set(masteries.map((m) => m.conceptId));
  const newConcepts = allConcepts.filter((c) => !practicedIds.has(c.id)).slice(0, 2);

  if (newConcepts.length) {
    tasks.push({
      type: "new",
      conceptIds: newConcepts.map((c) => c.id),
      mode: "practice",
      count: 6,
      minutes: 10,
      status: "pending",
      description: `学习新知识点: ${newConcepts.map((c) => c.name).join("、")}`,
    });
  }

  // Fallback: if no tasks generated, add a general practice
  if (!tasks.length) {
    const concepts = allConcepts.slice(0, 3).map((c) => c.id);
    tasks.push({
      type: "practice",
      conceptIds: concepts,
      mode: "practice",
      count: 10,
      minutes: 15,
      status: "pending",
      description: "综合练习",
    });
  }

  const totalMinutes = tasks.reduce((sum, t) => sum + (t.minutes || 0), 0);
  return { tasks, totalMinutes };
}
