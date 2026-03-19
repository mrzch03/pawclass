/**
 * usePlayback — connects to the SSE stream and drives playback.
 */

import { useEffect, useRef, useCallback } from "react";
import { usePlaybackStore } from "../store/playback-store";
import { useStageStore } from "../store/stage-store";
import { useCanvasStore } from "../store/canvas-store";

const API_BASE = "";

export function usePlayback(sessionId: string | null) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const actionQueueRef = useRef<any[]>([]);
  const playingRef = useRef(false);

  const setStatus = usePlaybackStore((s) => s.setStatus);
  const setCurrentStep = usePlaybackStore((s) => s.setCurrentStep);
  const setTotalSteps = usePlaybackStore((s) => s.setTotalSteps);
  const setGeneratingProgress = usePlaybackStore((s) => s.setGeneratingProgress);

  const setScenes = useStageStore((s) => s.setScenes);
  const setCurrentSceneIndex = useStageStore((s) => s.setCurrentSceneIndex);
  const setWhiteboardOpen = useStageStore((s) => s.setWhiteboardOpen);
  const addWhiteboardElement = useStageStore((s) => s.addWhiteboardElement);
  const removeWhiteboardElement = useStageStore((s) => s.removeWhiteboardElement);
  const clearWhiteboard = useStageStore((s) => s.clearWhiteboard);

  const setSpotlight = useCanvasStore((s) => s.setSpotlight);
  const setLaser = useCanvasStore((s) => s.setLaser);
  const clearEffects = useCanvasStore((s) => s.clearEffects);

  // Execute a single action
  const executeAction = useCallback(
    async (action: any, sessionId: string) => {
      switch (action.type) {
        case "speech": {
          // Play TTS audio
          const audioUrl = `${API_BASE}/api/session/${sessionId}/audio/${action.id}`;
          return new Promise<void>((resolve) => {
            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            audio.onended = () => resolve();
            audio.onerror = () => {
              // Fallback: estimate duration from text
              const duration = action.text.length * 100; // ~100ms per char
              setTimeout(resolve, Math.min(duration, 10000));
            };
            audio.play().catch(() => {
              const duration = action.text.length * 100;
              setTimeout(resolve, Math.min(duration, 10000));
            });
          });
        }
        case "spotlight":
          setSpotlight(action.elementId, action.dimOpacity);
          break;
        case "laser":
          setLaser(action.elementId, action.color);
          break;
        case "wb_open":
          setWhiteboardOpen(true);
          await delay(300);
          break;
        case "wb_close":
          setWhiteboardOpen(false);
          await delay(300);
          break;
        case "wb_draw_text":
        case "wb_draw_shape":
        case "wb_draw_chart":
        case "wb_draw_latex":
        case "wb_draw_table":
        case "wb_draw_line":
          addWhiteboardElement(action);
          await delay(200);
          break;
        case "wb_clear":
          clearWhiteboard();
          await delay(200);
          break;
        case "wb_delete":
          removeWhiteboardElement(action.elementId);
          await delay(100);
          break;
      }
    },
    [setSpotlight, setLaser, setWhiteboardOpen, addWhiteboardElement, removeWhiteboardElement, clearWhiteboard],
  );

  // Execute all actions for a scene sequentially
  const executeSceneActions = useCallback(
    async (scene: any, sessionId: string) => {
      if (!scene.actions) return;
      playingRef.current = true;
      clearEffects();

      for (const action of scene.actions) {
        if (!playingRef.current) break;
        await executeAction(action, sessionId);
      }

      // Report step complete
      if (playingRef.current) {
        await fetch(`${API_BASE}/api/session/${sessionId}/step-complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepIndex: scene.order - 1 }),
        });
      }
    },
    [executeAction, clearEffects],
  );

  // Connect SSE
  useEffect(() => {
    if (!sessionId) return;

    const es = new EventSource(`${API_BASE}/api/session/${sessionId}/stream`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "init":
          setStatus(data.status);
          setCurrentStep(data.currentStepIndex);
          setTotalSteps(data.totalSteps);
          break;

        case "play":
          setStatus("playing");
          setCurrentStep(data.stepIndex);
          setCurrentSceneIndex(data.stepIndex);
          executeSceneActions(data.scene, sessionId);
          break;

        case "pause":
          setStatus("paused");
          playingRef.current = false;
          audioRef.current?.pause();
          break;

        case "resume":
          setStatus("playing");
          setCurrentStep(data.stepIndex);
          executeSceneActions(data.scene, sessionId);
          break;

        case "goto":
          setCurrentStep(data.stepIndex);
          setCurrentSceneIndex(data.stepIndex);
          clearEffects();
          clearWhiteboard();
          executeSceneActions(data.scene, sessionId);
          break;

        case "step_complete":
          // Already handled by auto-advance
          break;

        case "session_complete":
          setStatus("completed");
          playingRef.current = false;
          break;

        case "session_ended":
          setStatus("ended");
          playingRef.current = false;
          break;

        case "generating_progress":
          setStatus("generating");
          setGeneratingProgress(data.progress, data.message);
          break;
      }
    };

    es.onerror = () => {
      console.error("[sse] Connection error, will retry...");
    };

    return () => {
      es.close();
      playingRef.current = false;
      audioRef.current?.pause();
    };
  }, [sessionId]);

  // Imperative controls
  const requestHelp = useCallback(async () => {
    if (!sessionId) return;
    const step = usePlaybackStore.getState().currentStepIndex;
    await fetch(`${API_BASE}/api/session/${sessionId}/help-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepIndex: step }),
    });
  }, [sessionId]);

  const exitSession = useCallback(async () => {
    if (!sessionId) return;
    playingRef.current = false;
    audioRef.current?.pause();
    await fetch(`${API_BASE}/api/session/${sessionId}/student-exit`, {
      method: "POST",
    });
  }, [sessionId]);

  return { requestHelp, exitSession };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
