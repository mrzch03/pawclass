import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import type { DB } from "../db/connection.js";
import type { KnowledgeService } from "../knowledge/knowledge-service.js";
import { practiceSessions, exerciseAttempts, conceptMastery } from "../db/schema.js";
import { computeNextReview, computeMasteryLevel } from "../learning/priority.js";
import type { AuthVariables } from "../auth/types.js";
import { resolveStudentId } from "../auth/resolve-student.js";

export function createPracticeRoutes(db: DB, kb: KnowledgeService): Hono<{ Variables: AuthVariables }> {
  const api = new Hono<{ Variables: AuthVariables }>();

  // POST /practice — create a practice session
  api.post("/", async (c) => {
    const userId = resolveStudentId(c);
    const body = await c.req.json();
    const { courseId, mode, concepts: conceptIds, difficulty, count = 10 } = body;

    if (!courseId) return c.json({ error: "courseId required" }, 400);

    // Determine which concepts to practice
    let targetConcepts: string[] = conceptIds || [];

    if (!targetConcepts.length && mode === "review") {
      // Auto-select: due for review
      const now = new Date().toISOString();
      const due = await db
        .select()
        .from(conceptMastery)
        .where(and(eq(conceptMastery.userId, userId), eq(conceptMastery.courseId, courseId)));

      targetConcepts = due
        .filter((m) => m.nextReviewAt && m.nextReviewAt <= now)
        .map((m) => m.conceptId)
        .slice(0, 5);
    }

    if (!targetConcepts.length) {
      // Fallback: pick from all available concepts
      const allConcepts = kb.listConcepts(courseId);
      targetConcepts = allConcepts.slice(0, 5).map((c) => c.id);
    }

    // Sample exercises from knowledge base
    const previousAttempts = await db
      .select({ exerciseId: exerciseAttempts.exerciseId })
      .from(exerciseAttempts)
      .where(and(eq(exerciseAttempts.userId, userId), eq(exerciseAttempts.courseId, courseId)));
    const recentIds = previousAttempts.map((a) => a.exerciseId);

    const exercises = kb.sampleExercises(courseId, {
      concepts: targetConcepts,
      count,
      difficulty,
      exclude: recentIds.slice(-100), // avoid very recently done exercises
    });

    const sessionId = `prs_${nanoid(12)}`;
    const exerciseList = exercises.map((ex) => ({
      exerciseId: ex.id,
      conceptId: ex.concepts?.[0] || "unknown",
      status: "pending" as const,
      result: null as null | boolean,
    }));

    await db.insert(practiceSessions).values({
      id: sessionId,
      userId,
      courseId,
      title: mode === "review" ? "复习练习" : "专项练习",
      status: "active",
      mode: mode || "practice",
      config: { concepts: targetConcepts, difficulty, exerciseCount: count },
      exercises: exerciseList,
      score: 0,
      total: exercises.length,
    });

    return c.json({
      id: sessionId,
      total: exercises.length,
      exercises: exercises.map((ex) => ({
        id: ex.id,
        type: ex.type,
        question: ex.question,
        concepts: ex.concepts,
        difficulty: ex.difficulty,
        // Don't send answer/explanation yet
      })),
    });
  });

  // GET /practice/:id — get session state
  api.get("/:id", async (c) => {
    const sessionId = c.req.param("id");
    const rows = await db.select().from(practiceSessions).where(eq(practiceSessions.id, sessionId));
    if (!rows.length) return c.json({ error: "session not found" }, 404);
    return c.json(rows[0]);
  });

  // POST /practice/:id/submit — submit an answer
  api.post("/:id/submit", async (c) => {
    const userId = resolveStudentId(c);
    const sessionId = c.req.param("id");
    const body = await c.req.json();
    const { exerciseId, answer, timeSpentMs } = body;

    // Get session
    const rows = await db.select().from(practiceSessions).where(eq(practiceSessions.id, sessionId));
    if (!rows.length) return c.json({ error: "session not found" }, 404);
    const session = rows[0];

    // Find the exercise in knowledge base to check answer
    const exerciseList = session.exercises as any[];
    const entry = exerciseList.find((e: any) => e.exerciseId === exerciseId);
    if (!entry) return c.json({ error: "exercise not in session" }, 400);

    const conceptId = entry.conceptId;

    // Get correct answer from knowledge base
    const kbExercises = kb.getExercises(session.courseId, conceptId);
    const kbEx = kbExercises.find((e) => e.id === exerciseId);
    if (!kbEx) return c.json({ error: "exercise not found in knowledge base" }, 404);

    // Check answer (simple string comparison, can be enhanced)
    const isCorrect = normalizeAnswer(answer) === normalizeAnswer(kbEx.answer);

    // Record attempt
    await db.insert(exerciseAttempts).values({
      userId,
      exerciseId,
      conceptId,
      courseId: session.courseId,
      sessionId,
      isCorrect,
      studentAnswer: answer,
      timeSpentMs,
    });

    // Update concept mastery
    await updateMastery(db, userId, conceptId, session.courseId, isCorrect);

    // Update session exercise status
    entry.status = "done";
    entry.result = isCorrect;
    const newScore = exerciseList.filter((e: any) => e.result === true).length;

    await db
      .update(practiceSessions)
      .set({ exercises: exerciseList, score: newScore })
      .where(eq(practiceSessions.id, sessionId));

    return c.json({
      correct: isCorrect,
      correctAnswer: kbEx.answer,
      explanation: kbEx.explanation,
      progress: {
        done: exerciseList.filter((e: any) => e.status === "done").length,
        total: exerciseList.length,
        score: newScore,
      },
    });
  });

  // POST /practice/:id/complete — mark session complete
  api.post("/:id/complete", async (c) => {
    const sessionId = c.req.param("id");
    const rows = await db.select().from(practiceSessions).where(eq(practiceSessions.id, sessionId));
    if (!rows.length) return c.json({ error: "session not found" }, 404);

    const exercises = rows[0].exercises as any[];
    const score = exercises.filter((e: any) => e.result === true).length;

    await db
      .update(practiceSessions)
      .set({ status: "completed", score, completedAt: new Date().toISOString() })
      .where(eq(practiceSessions.id, sessionId));

    // Build results per concept
    const byConcept: Record<string, { total: number; correct: number }> = {};
    for (const ex of exercises) {
      if (!byConcept[ex.conceptId]) byConcept[ex.conceptId] = { total: 0, correct: 0 };
      byConcept[ex.conceptId].total++;
      if (ex.result === true) byConcept[ex.conceptId].correct++;
    }

    return c.json({
      status: "completed",
      score,
      total: exercises.length,
      accuracy: exercises.length > 0 ? Math.round((score / exercises.length) * 100) : 0,
      byConcept,
    });
  });

  // GET /practice/:id/results — get results summary
  api.get("/:id/results", async (c) => {
    const sessionId = c.req.param("id");
    const rows = await db.select().from(practiceSessions).where(eq(practiceSessions.id, sessionId));
    if (!rows.length) return c.json({ error: "session not found" }, 404);

    const session = rows[0];
    const exercises = session.exercises as any[];
    const score = exercises.filter((e: any) => e.result === true).length;

    const byConcept: Record<string, { total: number; correct: number }> = {};
    for (const ex of exercises) {
      if (!byConcept[ex.conceptId]) byConcept[ex.conceptId] = { total: 0, correct: 0 };
      byConcept[ex.conceptId].total++;
      if (ex.result === true) byConcept[ex.conceptId].correct++;
    }

    return c.json({
      id: session.id,
      status: session.status,
      mode: session.mode,
      score,
      total: exercises.length,
      accuracy: exercises.length > 0 ? Math.round((score / exercises.length) * 100) : 0,
      byConcept,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
    });
  });

  return api;
}

// --- Helpers ---

async function updateMastery(db: DB, userId: string, conceptId: string, courseId: string, isCorrect: boolean) {
  const existing = await db
    .select()
    .from(conceptMastery)
    .where(and(eq(conceptMastery.userId, userId), eq(conceptMastery.conceptId, conceptId), eq(conceptMastery.courseId, courseId)));

  const now = new Date().toISOString();

  if (existing.length === 0) {
    // First attempt for this concept
    const nextReview = computeNextReview({ masteryLevel: "new", streak: 0, isCorrect });
    await db.insert(conceptMastery).values({
      userId,
      conceptId,
      courseId,
      totalAttempts: 1,
      correctCount: isCorrect ? 1 : 0,
      wrongCount: isCorrect ? 0 : 1,
      streak: isCorrect ? 1 : 0,
      masteryLevel: "learning",
      lastPracticed: now,
      nextReviewAt: nextReview.toISOString(),
    });
    return;
  }

  const m = existing[0];
  const newStreak = isCorrect ? m.streak + 1 : 0;
  const newTotal = m.totalAttempts + 1;
  const newCorrect = m.correctCount + (isCorrect ? 1 : 0);
  const newWrong = m.wrongCount + (isCorrect ? 0 : 1);
  const newLevel = computeMasteryLevel({
    masteryLevel: m.masteryLevel,
    totalAttempts: newTotal,
    correctCount: newCorrect,
    streak: newStreak,
  });
  const nextReview = computeNextReview({ masteryLevel: newLevel, streak: newStreak, isCorrect });

  await db
    .update(conceptMastery)
    .set({
      totalAttempts: newTotal,
      correctCount: newCorrect,
      wrongCount: newWrong,
      streak: newStreak,
      masteryLevel: newLevel,
      lastPracticed: now,
      nextReviewAt: nextReview.toISOString(),
      updatedAt: now,
    })
    .where(eq(conceptMastery.id, m.id));
}

function normalizeAnswer(answer: string): string {
  return (answer || "")
    .trim()
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/\s+/g, " ");
}
