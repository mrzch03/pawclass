/**
 * Course state machine transitions.
 *
 * draft → finalized → playing ↔ paused → completed → ended
 *
 * Content can be added in "draft" and "playing" states (progressive loading).
 */

import type { CourseStatus } from "../types.js";

const VALID_TRANSITIONS: Record<CourseStatus, CourseStatus[]> = {
  draft: ["finalized", "playing"], // can go straight to playing for live mode
  finalized: ["playing"],
  playing: ["paused", "completed", "ended"],
  paused: ["playing", "ended"],
  completed: ["ended"],
  ended: [],
};

/** States that allow adding content */
const CONTENT_ALLOWED: CourseStatus[] = ["draft", "playing"];

export function canTransitionCourse(from: CourseStatus, to: CourseStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertCourseTransition(from: CourseStatus, to: CourseStatus): void {
  if (!canTransitionCourse(from, to)) {
    throw new Error(`Invalid course transition: ${from} → ${to}`);
  }
}

export function canAddContent(status: CourseStatus): boolean {
  return CONTENT_ALLOWED.includes(status);
}
