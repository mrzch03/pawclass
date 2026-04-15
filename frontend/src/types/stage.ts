export interface QuizOption {
  label?: string;
  value?: string;
}

export interface QuizQuestion {
  id?: string;
  type?: "single" | "multiple" | "short_answer";
  question: string;
  options?: QuizOption[];
  answer?: string[];
  analysis?: string;
}

export interface Scene {
  type?: "slide" | "quiz" | "interactive";
  title?: string;
  stepIndex?: number;
  order?: number;
  content?: {
    canvas?: unknown;
    questions?: QuizQuestion[];
    html?: string;
    url?: string;
  };
  actions?: Array<Record<string, unknown>>;
}
