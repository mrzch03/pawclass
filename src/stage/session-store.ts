/**
 * In-memory session storage.
 *
 * Sessions live in a Map keyed by session ID. This is sufficient for
 * the single-user-per-workspace model — each workspace runs one
 * Stage App instance.
 */

import type { Session, SessionStatus, Scene, QuizResult } from "../types.js";

const sessions = new Map<string, Session>();

export const sessionStore = {
  create(id: string, outline: Session["outline"]): Session {
    const session: Session = {
      id,
      outline,
      status: "idle",
      currentStepIndex: 0,
      scenes: [],
      quizResults: [],
      createdAt: Date.now(),
    };
    sessions.set(id, session);
    return session;
  },

  get(id: string): Session | undefined {
    return sessions.get(id);
  },

  list(): Session[] {
    return Array.from(sessions.values());
  },

  updateStatus(id: string, status: SessionStatus): Session | undefined {
    const s = sessions.get(id);
    if (!s) return undefined;
    s.status = status;
    if (status === "playing" && !s.startedAt) {
      s.startedAt = Date.now();
    }
    if (status === "completed" || status === "ended") {
      s.completedAt = Date.now();
    }
    return s;
  },

  setScenes(id: string, scenes: Scene[]): Session | undefined {
    const s = sessions.get(id);
    if (!s) return undefined;
    s.scenes = scenes;
    return s;
  },

  setCurrentStep(id: string, stepIndex: number): Session | undefined {
    const s = sessions.get(id);
    if (!s) return undefined;
    s.currentStepIndex = stepIndex;
    return s;
  },

  addQuizResult(id: string, result: QuizResult): Session | undefined {
    const s = sessions.get(id);
    if (!s) return undefined;
    s.quizResults.push(result);
    return s;
  },

  delete(id: string): boolean {
    return sessions.delete(id);
  },
};
