/**
 * Session state machine transitions.
 *
 * idle → generating → ready → playing ⇄ paused → completed → ended
 */

import type { SessionStatus } from "../types.js";

const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  idle: ["generating"],
  generating: ["ready"],
  ready: ["playing"],
  playing: ["paused", "completed", "ended"],
  paused: ["playing", "ended"],
  completed: ["ended"],
  ended: [],
};

export function canTransition(from: SessionStatus, to: SessionStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: SessionStatus, to: SessionStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid session transition: ${from} → ${to}`);
  }
}
