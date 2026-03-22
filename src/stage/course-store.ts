/**
 * In-memory course storage.
 *
 * Courses live in a Map keyed by course ID. Same pattern as session-store
 * but with the Course lifecycle: draft → finalized → playing ↔ paused → completed → ended.
 *
 * Content can be added in both "draft" and "playing" states (progressive loading).
 */

import type { Course, CourseStatus, Scene, Action, QuizResult } from "../types.js";

const courses = new Map<string, Course>();

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
    courses.set(id, course);
    return course;
  },

  get(id: string): Course | undefined {
    return courses.get(id);
  },

  list(): Course[] {
    return Array.from(courses.values());
  },

  updateStatus(id: string, status: CourseStatus): Course | undefined {
    const c = courses.get(id);
    if (!c) return undefined;
    c.status = status;
    if (status === "playing" && !c.startedAt) {
      c.startedAt = Date.now();
    }
    if (status === "completed" || status === "ended") {
      c.completedAt = Date.now();
    }
    return c;
  },

  /** Append a scene and return its index */
  addScene(id: string, scene: Scene): number | undefined {
    const c = courses.get(id);
    if (!c) return undefined;
    const index = c.scenes.length;
    scene.stepIndex = index;
    c.scenes.push(scene);
    return index;
  },

  /** Append an action to the last scene */
  addActionToLastScene(id: string, action: Action): { sceneIndex: number; actionId: string } | undefined {
    const c = courses.get(id);
    if (!c || c.scenes.length === 0) return undefined;
    const lastScene = c.scenes[c.scenes.length - 1];
    lastScene.actions.push(action);
    return { sceneIndex: c.scenes.length - 1, actionId: action.id };
  },

  setCurrentStep(id: string, stepIndex: number): Course | undefined {
    const c = courses.get(id);
    if (!c) return undefined;
    c.currentStepIndex = stepIndex;
    return c;
  },

  addQuizResult(id: string, result: QuizResult): Course | undefined {
    const c = courses.get(id);
    if (!c) return undefined;
    c.quizResults.push(result);
    return c;
  },

  delete(id: string): boolean {
    return courses.delete(id);
  },
};
