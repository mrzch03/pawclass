/**
 * Core types for clawbox-stage.
 */

// Re-export the teaching outline types from mistakes app
export interface TeachingOutline {
  title: string;
  estimatedMinutes: number;
  teachingMode: "mistake_focused" | "knowledge_first" | "mixed";
  briefing: string;
  steps: TeachingOutlineStep[];
}

export interface TeachingOutlineStep {
  order: number;
  type: "concept" | "example" | "mistake_review" | "practice" | "interactive" | "summary";
  title: string;
  description: string;
  keyPoints: string[];
  estimatedSeconds: number;
  relatedMistakeIds: string[];
  interactionHint: string;
  practiceConfig?: {
    questionCount: number;
    difficulty: "easy" | "medium" | "hard";
    basedOnMistakeIds: string[];
    questionTypes: ("single" | "multiple" | "short_answer")[];
  } | null;
}

// --- Session ---

export type SessionStatus =
  | "idle"
  | "generating"
  | "ready"
  | "playing"
  | "paused"
  | "completed"
  | "ended";

export interface Session {
  id: string;
  outline: TeachingOutline;
  status: SessionStatus;
  currentStepIndex: number;
  scenes: Scene[];
  quizResults: QuizResult[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface Scene {
  id: string;
  stepIndex: number;
  type: "slide" | "quiz" | "interactive";
  title: string;
  content: unknown; // SlideContent | QuizContent | InteractiveContent
  actions: Action[];
}

export interface Action {
  id: string;
  type: string;
  [key: string]: unknown;
}

export interface QuizResult {
  stepIndex: number;
  answers: QuizAnswer[];
  score: number;
  total: number;
  submittedAt: number;
}

export interface QuizAnswer {
  questionIndex: number;
  studentAnswer: string;
  correct: boolean;
}

// --- Course ---

export type CourseStatus =
  | "draft"
  | "finalized"
  | "playing"
  | "paused"
  | "completed"
  | "ended";

export interface Course {
  id: string;
  title: string;
  status: CourseStatus;
  currentStepIndex: number;
  scenes: Scene[];
  quizResults: QuizResult[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

// --- Session Events ---

export type SessionEventType =
  | "step_complete"
  | "quiz_result"
  | "help_request"
  | "student_skip"
  | "student_exit"
  | "session_end";

export interface SessionEvent {
  type: SessionEventType;
  sessionId: string;
  stepIndex?: number;
  summary: string;
  data?: unknown;
}
