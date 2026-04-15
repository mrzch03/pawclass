import { Hono } from "hono";
import { eq, and, lte, desc, sql } from "drizzle-orm";
import type { DB } from "../db/connection.js";
import { conceptMastery, exerciseAttempts } from "../db/schema.js";
import { computePriority } from "../learning/priority.js";
import type { AuthVariables } from "../auth/types.js";
import { resolveStudentId, AuthorizationError } from "../auth/resolve-student.js";

export function createLearnerRoutes(db: DB): Hono<{ Variables: AuthVariables }> {
  const api = new Hono<{ Variables: AuthVariables }>();

  // GET /learner/profile — student profile summary
  api.get("/profile", async (c) => {
    const userId = resolveStudentId(c);
    const courseId = c.req.query("course") || "middle/grade7-up/english";

    const masteries = await db
      .select()
      .from(conceptMastery)
      .where(and(eq(conceptMastery.userId, userId), eq(conceptMastery.courseId, courseId)));

    const totalConcepts = masteries.length;
    const byLevel = { new: 0, learning: 0, practiced: 0, mastered: 0 };
    let totalAttempts = 0;
    let totalCorrect = 0;

    for (const m of masteries) {
      byLevel[m.masteryLevel as keyof typeof byLevel] = (byLevel[m.masteryLevel as keyof typeof byLevel] || 0) + 1;
      totalAttempts += m.totalAttempts;
      totalCorrect += m.correctCount;
    }

    const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;

    // Count due for review
    const now = new Date().toISOString();
    const dueCount = masteries.filter(
      (m) => m.nextReviewAt && m.nextReviewAt <= now
    ).length;

    // Weakest concepts (lowest accuracy, at least 3 attempts)
    const weak = masteries
      .filter((m) => m.totalAttempts >= 3)
      .map((m) => ({
        conceptId: m.conceptId,
        accuracy: Math.round((m.correctCount / m.totalAttempts) * 100),
        wrongCount: m.wrongCount,
      }))
      .sort((a, b) => a.accuracy - b.accuracy)
      .slice(0, 5);

    return c.json({
      courseId,
      totalConcepts,
      byLevel,
      totalAttempts,
      totalCorrect,
      accuracy,
      dueForReview: dueCount,
      weakConcepts: weak,
    });
  });

  // GET /learner/mastery — all concept mastery data
  api.get("/mastery", async (c) => {
    const userId = resolveStudentId(c);
    const courseId = c.req.query("course") || "middle/grade7-up/english";
    const conceptId = c.req.query("concept");

    const conditions = [eq(conceptMastery.userId, userId), eq(conceptMastery.courseId, courseId)];
    if (conceptId) conditions.push(eq(conceptMastery.conceptId, conceptId));

    const rows = await db
      .select()
      .from(conceptMastery)
      .where(and(...conditions));

    return c.json(rows);
  });

  // GET /learner/due — concepts due for review, sorted by priority
  api.get("/due", async (c) => {
    const userId = resolveStudentId(c);
    const courseId = c.req.query("course") || "middle/grade7-up/english";
    const limit = parseInt(c.req.query("limit") || "20");

    const now = new Date().toISOString();
    const rows = await db
      .select()
      .from(conceptMastery)
      .where(
        and(
          eq(conceptMastery.userId, userId),
          eq(conceptMastery.courseId, courseId),
          lte(conceptMastery.nextReviewAt, now)
        )
      );

    const scored = rows
      .map((r) => ({ ...r, priority: computePriority(r) }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit);

    return c.json(scored);
  });

  // GET /learner/stats — extended statistics
  api.get("/stats", async (c) => {
    const userId = resolveStudentId(c);
    const courseId = c.req.query("course") || "middle/grade7-up/english";

    // Recent attempts (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const recentAttempts = await db
      .select({
        date: sql<string>`DATE(${exerciseAttempts.createdAt})`,
        total: sql<number>`COUNT(*)`,
        correct: sql<number>`SUM(CASE WHEN ${exerciseAttempts.isCorrect} THEN 1 ELSE 0 END)`,
      })
      .from(exerciseAttempts)
      .where(
        and(
          eq(exerciseAttempts.userId, userId),
          eq(exerciseAttempts.courseId, courseId),
          sql`${exerciseAttempts.createdAt} >= ${sevenDaysAgo}`
        )
      )
      .groupBy(sql`DATE(${exerciseAttempts.createdAt})`)
      .orderBy(sql`DATE(${exerciseAttempts.createdAt})`);

    return c.json({ recentAttempts });
  });

  return api;
}
