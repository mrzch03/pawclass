/**
 * Server-side playback engine.
 *
 * Manages step progression and broadcasts SSE events to connected clients.
 * Simpler than OpenMAIC's PlaybackEngine — only manages steps, not rendering.
 */

import { sessionStore } from "../session-store.js";
import { courseStore } from "../course-store.js";
import { assertTransition } from "../session-types.js";
import type { EventEmitter } from "../events/event-emitter.js";
import type { QuizResult, Scene, Session, Course } from "../types.js";

export type SSEEvent =
  | { type: "play"; stepIndex: number; scene: Scene }
  | { type: "pause" }
  | { type: "resume"; stepIndex: number; scene: Scene }
  | { type: "goto"; stepIndex: number; scene: Scene }
  | { type: "step_complete"; stepIndex: number }
  | { type: "session_complete" }
  | { type: "session_ended" }
  | { type: "generating_progress"; progress: number; message: string }
  // Course-specific events (progressive loading)
  | { type: "scene_added"; sceneIndex: number; scene: Scene; totalScenes: number }
  | { type: "action_added"; sceneIndex: number; actionId: string; action: unknown }
  | { type: "course_finalized"; totalScenes: number };

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

  /** Look up a session or course by ID */
  private lookup(id: string): { scenes: Scene[]; currentStepIndex: number; setCurrentStep: (idx: number) => void } | null {
    const session = sessionStore.get(id);
    if (session) return {
      scenes: session.scenes,
      currentStepIndex: session.currentStepIndex,
      setCurrentStep: (idx) => sessionStore.setCurrentStep(id, idx),
    };
    const course = courseStore.get(id);
    if (course) return {
      scenes: course.scenes,
      currentStepIndex: course.currentStepIndex,
      setCurrentStep: (idx) => courseStore.setCurrentStep(id, idx),
    };
    return null;
  }

  /** Start playback from current step */
  play(id: string) {
    const data = this.lookup(id);
    if (!data) throw new Error("Session/course not found");

    const scene = data.scenes[data.currentStepIndex];
    if (!scene) throw new Error("No scene at current step");

    this.broadcast(id, {
      type: "play",
      stepIndex: data.currentStepIndex,
      scene,
    });
  }

  /** Pause playback */
  pause(id: string) {
    this.broadcast(id, { type: "pause" });
  }

  /** Resume playback from current step */
  resume(id: string) {
    const data = this.lookup(id);
    if (!data) throw new Error("Session/course not found");

    const scene = data.scenes[data.currentStepIndex];
    if (!scene) throw new Error("No scene at current step");

    this.broadcast(id, {
      type: "resume",
      stepIndex: data.currentStepIndex,
      scene,
    });
  }

  /** Jump to a specific step */
  gotoStep(id: string, stepIndex: number) {
    const data = this.lookup(id);
    if (!data) throw new Error("Session/course not found");
    if (stepIndex < 0 || stepIndex >= data.scenes.length) {
      throw new Error("Invalid step index");
    }

    data.setCurrentStep(stepIndex);
    const scene = data.scenes[stepIndex];

    this.broadcast(id, { type: "goto", stepIndex, scene });
  }

  /** Stop session */
  stop(sessionId: string) {
    this.broadcast(sessionId, { type: "session_ended" });
  }

  /** Frontend reports step completion → auto-advance to next step */
  async onStepComplete(id: string, stepIndex: number) {
    // Try session first, then course
    const session = sessionStore.get(id);
    const course = !session ? courseStore.get(id) : undefined;
    const entity = session || course;
    if (!entity) return;

    this.broadcast(id, { type: "step_complete", stepIndex });

    // Emit event notification
    await this.eventEmitter?.emit({
      type: "step_complete",
      sessionId: id,
      stepIndex,
      summary: `第${stepIndex + 1}步完成: ${entity.scenes[stepIndex]?.title || ""}`,
    });

    // Auto-advance to next step
    const nextStep = stepIndex + 1;
    if (nextStep < entity.scenes.length) {
      if (session) sessionStore.setCurrentStep(id, nextStep);
      else courseStore.setCurrentStep(id, nextStep);
      const scene = entity.scenes[nextStep];
      this.broadcast(id, { type: "play", stepIndex: nextStep, scene });
    } else {
      // All steps complete
      if (session) {
        assertTransition(session.status, "completed");
        sessionStore.updateStatus(id, "completed");
      } else if (course) {
        courseStore.updateStatus(id, "completed");
      }
      this.broadcast(id, { type: "session_complete" });

      await this.eventEmitter?.emit({
        type: "session_end",
        sessionId: id,
        summary: `教学完成，共${entity.scenes.length}步`,
        data: {
          totalSteps: entity.scenes.length,
          quizResults: entity.quizResults,
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
