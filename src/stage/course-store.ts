/**
 * Database-backed course storage.
 *
 * Courses persist to PostgreSQL so they survive server restarts.
 * In-memory Map used as cache for fast reads; writes go to both.
 */

import { eq } from "drizzle-orm";
import { courses as coursesTable } from "../db/schema.js";
import type { DB } from "../db/connection.js";
import type { Course, CourseStatus, Scene, Action, QuizResult } from "../types.js";

// In-memory cache
const cache = new Map<string, Course>();

let db: DB | null = null;

/** Must be called once at startup with the DB instance */
export function initCourseStore(database: DB): void {
  db = database;
  // Load existing courses into cache
  loadFromDb().catch((e) => console.error("[course-store] Failed to load:", e));
}

async function loadFromDb(): Promise<void> {
  if (!db) return;
  const rows = await db.select().from(coursesTable);
  for (const row of rows) {
    cache.set(row.id, rowToCourse(row));
  }
  if (rows.length > 0) {
    console.log(`[course-store] Loaded ${rows.length} courses from DB`);
  }
}

function rowToCourse(row: any): Course {
  return {
    id: row.id,
    title: row.title,
    status: row.status as CourseStatus,
    currentStepIndex: row.currentStepIndex,
    scenes: (row.scenes as Scene[]) || [],
    quizResults: (row.quizResults as QuizResult[]) || [],
    createdAt: row.createdAt ? new Date(row.createdAt).getTime() : Date.now(),
    startedAt: row.startedAt ? new Date(row.startedAt).getTime() : undefined,
    completedAt: row.completedAt ? new Date(row.completedAt).getTime() : undefined,
  };
}

async function persist(course: Course): Promise<void> {
  if (!db) return;
  try {
    await db
      .insert(coursesTable)
      .values({
        id: course.id,
        title: course.title,
        status: course.status,
        currentStepIndex: course.currentStepIndex,
        scenes: course.scenes as any,
        quizResults: course.quizResults as any,
        startedAt: course.startedAt ? new Date(course.startedAt).toISOString() : null,
        completedAt: course.completedAt ? new Date(course.completedAt).toISOString() : null,
      })
      .onConflictDoUpdate({
        target: coursesTable.id,
        set: {
          title: course.title,
          status: course.status,
          currentStepIndex: course.currentStepIndex,
          scenes: course.scenes as any,
          quizResults: course.quizResults as any,
          startedAt: course.startedAt ? new Date(course.startedAt).toISOString() : null,
          completedAt: course.completedAt ? new Date(course.completedAt).toISOString() : null,
        },
      });
  } catch (e) {
    console.error(`[course-store] Failed to persist course ${course.id}:`, e);
  }
}

export const courseStore = {
  create(id: string, title: string): Course {
    const course: Course = {
      id,
      title,
      status: "draft",
      currentStepIndex: 0,
      scenes: [],
      quizResults: [],
      createdAt: Date.now(),
    };
    cache.set(id, course);
    persist(course);
    return course;
  },

  get(id: string): Course | undefined {
    return cache.get(id);
  },

  list(): Course[] {
    return Array.from(cache.values());
  },

  updateStatus(id: string, status: CourseStatus): Course | undefined {
    const c = cache.get(id);
    if (!c) return undefined;
    c.status = status;
    if (status === "playing" && !c.startedAt) {
      c.startedAt = Date.now();
    }
    if (status === "completed" || status === "ended") {
      c.completedAt = Date.now();
    }
    persist(c);
    return c;
  },

  addScene(id: string, scene: Scene): number | undefined {
    const c = cache.get(id);
    if (!c) return undefined;
    const index = c.scenes.length;
    scene.stepIndex = index;
    c.scenes.push(scene);
    persist(c);
    return index;
  },

  addActionToLastScene(id: string, action: Action): { sceneIndex: number; actionId: string } | undefined {
    const c = cache.get(id);
    if (!c || c.scenes.length === 0) return undefined;
    const lastScene = c.scenes[c.scenes.length - 1];
    lastScene.actions.push(action);
    persist(c);
    return { sceneIndex: c.scenes.length - 1, actionId: action.id };
  },

  setCurrentStep(id: string, stepIndex: number): Course | undefined {
    const c = cache.get(id);
    if (!c) return undefined;
    c.currentStepIndex = stepIndex;
    persist(c);
    return c;
  },

  addQuizResult(id: string, result: QuizResult): Course | undefined {
    const c = cache.get(id);
    if (!c) return undefined;
    c.quizResults.push(result);
    persist(c);
    return c;
  },

  delete(id: string): boolean {
    const ok = cache.delete(id);
    if (ok && db) {
      db.delete(coursesTable).where(eq(coursesTable.id, id)).catch(() => {});
    }
    return ok;
  },
};
