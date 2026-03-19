/**
 * Generation types — adapted from OpenMAIC, without PBL and media generation.
 */

import type { PPTElement, SlideBackground } from './slides.js';
import type { QuizQuestion } from './stage.js';
import type { ActionType } from './action.js';

export interface SceneOutline {
  id: string;
  type: 'slide' | 'quiz' | 'interactive';
  title: string;
  description: string;
  keyPoints: string[];
  teachingObjective?: string;
  estimatedDuration?: number;
  order: number;
  language?: 'zh-CN' | 'en-US';
  quizConfig?: {
    questionCount: number;
    difficulty: 'easy' | 'medium' | 'hard';
    questionTypes: ('single' | 'multiple' | 'text')[];
  };
  interactiveConfig?: {
    conceptName: string;
    conceptOverview: string;
    designIdea: string;
    subject?: string;
  };
}

export interface GeneratedSlideContent {
  elements: PPTElement[];
  background?: SlideBackground;
  remark?: string;
}

export interface GeneratedQuizContent {
  questions: QuizQuestion[];
}

export interface GeneratedInteractiveContent {
  html: string;
}

export interface GenerationProgress {
  currentStage: 1 | 2 | 3;
  overallProgress: number;
  stageProgress: number;
  statusMessage: string;
  scenesGenerated: number;
  totalScenes: number;
  errors?: string[];
}

/** AI call function type — takes system + user prompts, returns text */
export type AICallFn = (system: string, user: string) => Promise<string>;
