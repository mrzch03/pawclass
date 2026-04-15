import { create } from "zustand";
import { authFetch } from "../lib/auth";
import type { Exercise, SubmitResult } from "../types/learning";

interface PracticeState {
  sessionId: string | null;
  exercises: Exercise[];
  currentIndex: number;
  results: Map<string, SubmitResult>;
  status: "idle" | "active" | "completed";
  score: number;
  total: number;

  // Actions
  startSession: (sessionId: string, exercises: Exercise[]) => void;
  submitAnswer: (exerciseId: string, answer: string) => Promise<SubmitResult>;
  next: () => void;
  complete: () => Promise<void>;
  reset: () => void;
}

const API_BASE = "";

export const usePracticeStore = create<PracticeState>((set, get) => ({
  sessionId: null,
  exercises: [],
  currentIndex: 0,
  results: new Map(),
  status: "idle",
  score: 0,
  total: 0,

  startSession: (sessionId, exercises) => {
    set({
      sessionId,
      exercises,
      currentIndex: 0,
      results: new Map(),
      status: "active",
      score: 0,
      total: exercises.length,
    });
  },

  submitAnswer: async (exerciseId, answer) => {
    const { sessionId, results } = get();
    const res = await authFetch(`${API_BASE}/api/practice/${sessionId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exerciseId, answer }),
    });
    const result: SubmitResult = await res.json();

    const newResults = new Map(results);
    newResults.set(exerciseId, result);

    set({ results: newResults, score: result.progress.score });
    return result;
  },

  next: () => {
    const { currentIndex, exercises } = get();
    if (currentIndex < exercises.length - 1) {
      set({ currentIndex: currentIndex + 1 });
    }
  },

  complete: async () => {
    const { sessionId } = get();
    await authFetch(`${API_BASE}/api/practice/${sessionId}/complete`, { method: "POST" });
    set({ status: "completed" });
  },

  reset: () => {
    set({
      sessionId: null,
      exercises: [],
      currentIndex: 0,
      results: new Map(),
      status: "idle",
      score: 0,
      total: 0,
    });
  },
}));
