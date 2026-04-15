import { Hono } from "hono";
import { eq, and, desc, sql } from "drizzle-orm";
import type { DB } from "../db/connection.js";
import type { KnowledgeService } from "../knowledge/knowledge-service.js";
import { conceptMastery, exerciseAttempts, practiceSessions, teachingDirectives } from "../db/schema.js";
import type { AuthVariables } from "../auth/types.js";

export function createTeacherRoutes(db: DB, kb: KnowledgeService): Hono<{ Variables: AuthVariables }> {
  const api = new Hono<{ Variables: AuthVariables }>();

  // Role guard: only teachers
  api.use("/*", async (c, next) => {
    if (c.get("role") !== "teacher") {
      return c.json({ error: "Forbidden: teacher role required" }, 403);
    }
    await next();
  });

  // GET /teacher/students — list students with overview
  api.get("/students", async (c) => {
    const students = c.get("students") || [];
    const courseId = c.req.query("course") || "middle/grade7-up/english";

    const result = [];
    for (const studentId of students) {
      const masteries = await db
        .select()
        .from(conceptMastery)
        .where(and(eq(conceptMastery.userId, studentId), eq(conceptMastery.courseId, courseId)));

      const totalAttempts = masteries.reduce((s, m) => s + m.totalAttempts, 0);
      const totalCorrect = masteries.reduce((s, m) => s + m.correctCount, 0);
      const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
      const now = new Date().toISOString();
      const dueCount = masteries.filter(m => m.nextReviewAt && m.nextReviewAt <= now).length;

      const byLevel = { new: 0, learning: 0, practiced: 0, mastered: 0 };
      for (const m of masteries) {
        byLevel[m.masteryLevel as keyof typeof byLevel] = (byLevel[m.masteryLevel as keyof typeof byLevel] || 0) + 1;
      }

      result.push({
        studentId,
        courseId,
        accuracy,
        totalAttempts,
        dueForReview: dueCount,
        totalConcepts: masteries.length,
        byLevel,
      });
    }

    return c.json(result);
  });

  // GET /teacher/student/:id/profile — detailed student profile
  api.get("/student/:id/profile", async (c) => {
    const studentId = c.req.param("id");
    const courseId = c.req.query("course") || "middle/grade7-up/english";

    const masteries = await db
      .select()
      .from(conceptMastery)
      .where(and(eq(conceptMastery.userId, studentId), eq(conceptMastery.courseId, courseId)));

    const totalAttempts = masteries.reduce((s, m) => s + m.totalAttempts, 0);
    const totalCorrect = masteries.reduce((s, m) => s + m.correctCount, 0);

    const byLevel = { new: 0, learning: 0, practiced: 0, mastered: 0 };
    for (const m of masteries) {
      byLevel[m.masteryLevel as keyof typeof byLevel] = (byLevel[m.masteryLevel as keyof typeof byLevel] || 0) + 1;
    }

    const weak = masteries
      .filter(m => m.totalAttempts >= 3)
      .map(m => ({
        conceptId: m.conceptId,
        accuracy: Math.round((m.correctCount / m.totalAttempts) * 100),
        wrongCount: m.wrongCount,
        masteryLevel: m.masteryLevel,
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 10);

    const now = new Date().toISOString();
    const dueCount = masteries.filter(m => m.nextReviewAt && m.nextReviewAt <= now).length;

    return c.json({
      studentId,
      courseId,
      totalConcepts: masteries.length,
      byLevel,
      totalAttempts,
      totalCorrect,
      accuracy: totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0,
      dueForReview: dueCount,
      weakConcepts: weak,
      masteries,
    });
  });

  // GET /teacher/student/:id/history — recent practice history
  api.get("/student/:id/history", async (c) => {
    const studentId = c.req.param("id");
    const courseId = c.req.query("course") || "middle/grade7-up/english";
    const limit = parseInt(c.req.query("limit") || "20");

    const sessions = await db
      .select()
      .from(practiceSessions)
      .where(and(eq(practiceSessions.userId, studentId), eq(practiceSessions.courseId, courseId)))
      .orderBy(desc(practiceSessions.startedAt))
      .limit(limit);

    return c.json(sessions);
  });

  // GET /teacher/overview — class-wide overview (heatmap data)
  api.get("/overview", async (c) => {
    const students = c.get("students") || [];
    const courseId = c.req.query("course") || "middle/grade7-up/english";
    const allConcepts = kb.listConcepts(courseId);

    // Build concept × student accuracy matrix
    const heatmap: Record<string, Record<string, number>> = {};
    for (const concept of allConcepts) {
      heatmap[concept.id] = {};
    }

    for (const studentId of students) {
      const masteries = await db
        .select()
        .from(conceptMastery)
        .where(and(eq(conceptMastery.userId, studentId), eq(conceptMastery.courseId, courseId)));

      for (const m of masteries) {
        if (heatmap[m.conceptId]) {
          heatmap[m.conceptId][studentId] = m.totalAttempts > 0
            ? Math.round((m.correctCount / m.totalAttempts) * 100)
            : -1;
        }
      }
    }

    // Class average per concept
    const conceptAverages = allConcepts.map(concept => {
      const scores = Object.values(heatmap[concept.id] || {}).filter(v => v >= 0);
      const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
      return { conceptId: concept.id, name: concept.name, average: avg, studentCount: scores.length };
    }).sort((a, b) => a.average - b.average);

    return c.json({ students, conceptAverages, heatmap });
  });

  // POST /teacher/directive — issue a teaching directive
  api.post("/directive", async (c) => {
    const teacherId = c.get("userId");
    const body = await c.req.json();
    const { studentId, courseId, content } = body;

    if (!studentId || !content) {
      return c.json({ error: "studentId and content required" }, 400);
    }

    const [row] = await db
      .insert(teachingDirectives)
      .values({
        teacherId,
        studentId,
        courseId: courseId || "middle/grade7-up/english",
        content,
      })
      .returning();

    return c.json(row);
  });

  // GET /teacher/directives — list directives
  api.get("/directives", async (c) => {
    const teacherId = c.get("userId");
    const studentId = c.req.query("studentId");
    const status = c.req.query("status");

    const conditions = [eq(teachingDirectives.teacherId, teacherId)];
    if (studentId) conditions.push(eq(teachingDirectives.studentId, studentId));
    if (status) conditions.push(eq(teachingDirectives.status, status));

    const rows = await db
      .select()
      .from(teachingDirectives)
      .where(and(...conditions))
      .orderBy(desc(teachingDirectives.createdAt))
      .limit(50);

    return c.json(rows);
  });

  // GET /teacher/directive/:id
  api.get("/directive/:id", async (c) => {
    const id = c.req.param("id");
    const rows = await db.select().from(teachingDirectives).where(eq(teachingDirectives.id, id));
    if (!rows.length) return c.json({ error: "not found" }, 404);
    return c.json(rows[0]);
  });

  return api;
}
