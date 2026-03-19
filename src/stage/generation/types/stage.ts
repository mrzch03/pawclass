/**
 * Stage and Scene types — adapted from OpenMAIC, without PBL.
 */

import type { Slide } from './slides.js';
import type { Action } from './action.js';

export type SceneType = 'slide' | 'quiz' | 'interactive';

export type Whiteboard = Omit<Slide, 'theme' | 'turningMode' | 'sectionTag' | 'type'>;

export interface Scene {
  id: string;
  stageId: string;
  type: SceneType;
  title: string;
  order: number;
  content: SceneContent;
  actions?: Action[];
  whiteboards?: Slide[];
  createdAt?: number;
  updatedAt?: number;
}

export type SceneContent = SlideContent | QuizContent | InteractiveContent;

export interface SlideContent {
  type: 'slide';
  canvas: Slide;
}

export interface QuizContent {
  type: 'quiz';
  questions: QuizQuestion[];
}

export interface QuizOption {
  label: string;
  value: string;
}

export interface QuizQuestion {
  id: string;
  type: 'single' | 'multiple' | 'short_answer';
  question: string;
  options?: QuizOption[];
  answer?: string[];
  analysis?: string;
  commentPrompt?: string;
  hasAnswer?: boolean;
  points?: number;
}

export interface InteractiveContent {
  type: 'interactive';
  url: string;
  html?: string;
}
