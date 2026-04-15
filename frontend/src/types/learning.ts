export interface Exercise {
  id: string;
  type: string;
  question: string;
  answer?: string;
  explanation?: string;
  concepts: string[];
  difficulty: number;
  options?: string[];
}

export interface PracticeSession {
  id: string;
  total: number;
  exercises: Exercise[];
}

export interface SubmitResult {
  correct: boolean;
  correctAnswer: string;
  explanation: string;
  progress: { done: number; total: number; score: number };
}

export interface ConceptMastery {
  id: string;
  conceptId: string;
  courseId: string;
  totalAttempts: number;
  correctCount: number;
  wrongCount: number;
  streak: number;
  masteryLevel: "new" | "learning" | "practiced" | "mastered";
  nextReviewAt: string | null;
}

export interface LearnerProfile {
  courseId: string;
  totalConcepts: number;
  byLevel: { new: number; learning: number; practiced: number; mastered: number };
  totalAttempts: number;
  totalCorrect: number;
  accuracy: number;
  dueForReview: number;
  weakConcepts: { conceptId: string; accuracy: number; wrongCount: number }[];
}

export interface DailyPlan {
  id: string;
  planDate: string;
  tasks: PlanTask[];
  totalMinutes: number;
  completedCount: number;
  source: "auto" | "agent";
}

export interface PlanTask {
  type: "review" | "practice" | "new";
  conceptIds: string[];
  mode: string;
  count: number;
  minutes: number;
  status: "pending" | "completed" | "skipped";
  description: string;
}

export interface ConceptSummary {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  exerciseCount: number;
  relatedConcepts: string[];
}
