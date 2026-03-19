/**
 * Server-side playback engine.
 *
 * Manages step progression and broadcasts SSE events to connected clients.
 * Simpler than OpenMAIC's PlaybackEngine — only manages steps, not rendering.
 */

import { sessionStore } from "../session-store.js";
import { assertTransition } from "../session-types.js";
import type { EventEmitter } from "../events/event-emitter.js";
import type { QuizResult, Scene } from "../types.js";

export type SSEEvent =
  | { type: "play"; stepIndex: number; scene: Scene }
  | { type: "pause" }
  | { type: "resume"; stepIndex: number; scene: Scene }
  | { type: "goto"; stepIndex: number; scene: Scene }
  | { type: "step_complete"; stepIndex: number }
  | { type: "session_complete" }
  | { type: "session_ended" }
  | { type: "generating_progress"; progress: number; message: string };

type SSEListener = (event: SSEEvent) => void;

export class ServerPlaybackEngine {
  private listeners = new Map<string, Set<SSEListener>>();

  constructor(private eventEmitter?: EventEmitter | null) {}

  /** Subscribe to SSE events for a session */
  subscribe(sessionId: string, listener: SSEListener): () => void {
    if (!this.listeners.has(sessionId)) {
      this.listeners.set(sessionId, new Set());
    }
    this.listeners.get(sessionId)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(sessionId)?.delete(listener);
      if (this.listeners.get(sessionId)?.size === 0) {
        this.listeners.delete(sessionId);
      }
    };
  }

  broadcast(sessionId: string, event: SSEEvent) {
    const listeners = this.listeners.get(sessionId);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(event);
        } catch (e: any) {
          console.error(`[engine] SSE broadcast error: ${e.message}`);
        }
      }
    }
  }

  /** Start playback from current step */
  play(sessionId: string) {
    const session = sessionStore.get(sessionId);
    if (!session) throw new Error("Session not found");

    const scene = session.scenes[session.currentStepIndex];
    if (!scene) throw new Error("No scene at current step");

    this.broadcast(sessionId, {
      type: "play",
      stepIndex: session.currentStepIndex,
      scene,
    });
  }

  /** Pause playback */
  pause(sessionId: string) {
    this.broadcast(sessionId, { type: "pause" });
  }

  /** Resume playback from current step */
  resume(sessionId: string) {
    const session = sessionStore.get(sessionId);
    if (!session) throw new Error("Session not found");

    const scene = session.scenes[session.currentStepIndex];
    if (!scene) throw new Error("No scene at current step");

    this.broadcast(sessionId, {
      type: "resume",
      stepIndex: session.currentStepIndex,
      scene,
    });
  }

  /** Jump to a specific step */
  gotoStep(sessionId: string, stepIndex: number) {
    const session = sessionStore.get(sessionId);
    if (!session) throw new Error("Session not found");
    if (stepIndex < 0 || stepIndex >= session.scenes.length) {
      throw new Error("Invalid step index");
    }

    sessionStore.setCurrentStep(sessionId, stepIndex);
    const scene = session.scenes[stepIndex];

    this.broadcast(sessionId, { type: "goto", stepIndex, scene });
  }

  /** Stop session */
  stop(sessionId: string) {
    this.broadcast(sessionId, { type: "session_ended" });
  }

  /** Frontend reports step completion → auto-advance to next step */
  async onStepComplete(sessionId: string, stepIndex: number) {
    const session = sessionStore.get(sessionId);
    if (!session) return;

    this.broadcast(sessionId, { type: "step_complete", stepIndex });

    // Emit event notification
    await this.eventEmitter?.emit({
      type: "step_complete",
      sessionId,
      stepIndex,
      summary: `第${stepIndex + 1}步完成: ${session.scenes[stepIndex]?.title || ""}`,
    });

    // Auto-advance to next step
    const nextStep = stepIndex + 1;
    if (nextStep < session.scenes.length) {
      sessionStore.setCurrentStep(sessionId, nextStep);
      const scene = session.scenes[nextStep];
      this.broadcast(sessionId, { type: "play", stepIndex: nextStep, scene });
    } else {
      // All steps complete
      assertTransition(session.status, "completed");
      sessionStore.updateStatus(sessionId, "completed");
      this.broadcast(sessionId, { type: "session_complete" });

      await this.eventEmitter?.emit({
        type: "session_end",
        sessionId,
        summary: `教学完成，共${session.scenes.length}步`,
        data: {
          totalSteps: session.scenes.length,
          quizResults: session.quizResults,
        },
      });
    }
  }

  /** Student submits quiz answers */
  async onQuizSubmit(sessionId: string, stepIndex: number, result: QuizResult) {
    const session = sessionStore.get(sessionId);
    if (!session) return;

    sessionStore.addQuizResult(sessionId, result);

    await this.eventEmitter?.emit({
      type: "quiz_result",
      sessionId,
      stepIndex,
      summary: `第${stepIndex + 1}步测验完成，答对${result.score}/${result.total}题`,
      data: result,
    });
  }

  /** Student requests help */
  async onHelpRequest(sessionId: string, stepIndex: number) {
    const session = sessionStore.get(sessionId);
    if (!session) return;

    await this.eventEmitter?.emit({
      type: "help_request",
      sessionId,
      stepIndex,
      summary: `学生在第${stepIndex + 1}步请求帮助: ${session.scenes[stepIndex]?.title || ""}`,
    });
  }

  /** Student exits the session */
  async onStudentExit(sessionId: string) {
    const session = sessionStore.get(sessionId);
    if (!session) return;

    await this.eventEmitter?.emit({
      type: "student_exit",
      sessionId,
      summary: `学生退出教学（进度: ${session.currentStepIndex + 1}/${session.scenes.length}）`,
    });
  }
}
