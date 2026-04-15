/**
 * usePlayback — connects to the SSE stream and drives playback.
 */

import { useEffect, useRef, useCallback } from "react";
import { usePlaybackStore } from "../store/playback-store";
import { useStageStore } from "../store/stage-store";
import { useCanvasStore } from "../store/canvas-store";

const API_BASE = "";

export function usePlayback(sessionId: string | null, mode: "session" | "course" = "session") {
  const eventSourceRef = useRef<EventSource | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const actionQueueRef = useRef<any[]>([]);
  const playingRef = useRef(false);

  const setStatus = usePlaybackStore((s) => s.setStatus);
  const setCurrentStep = usePlaybackStore((s) => s.setCurrentStep);
  const setTotalSteps = usePlaybackStore((s) => s.setTotalSteps);
  const setGeneratingProgress = usePlaybackStore((s) => s.setGeneratingProgress);
  const setSpeechText = usePlaybackStore((s) => s.setSpeechText);

  const setScenes = useStageStore((s) => s.setScenes);
  const setCurrentSceneIndex = useStageStore((s) => s.setCurrentSceneIndex);
  const addScene = useStageStore((s) => s.addScene);
  const addActionToScene = useStageStore((s) => s.addActionToScene);
  const setWhiteboardOpen = useStageStore((s) => s.setWhiteboardOpen);
  const addWhiteboardElement = useStageStore((s) => s.addWhiteboardElement);
  const removeWhiteboardElement = useStageStore((s) => s.removeWhiteboardElement);
  const clearWhiteboard = useStageStore((s) => s.clearWhiteboard);

  const setSpotlight = useCanvasStore((s) => s.setSpotlight);
  const setLaser = useCanvasStore((s) => s.setLaser);
  const clearEffects = useCanvasStore((s) => s.clearEffects);

  /** Build the correct audio URL based on mode */
  const getAudioUrl = useCallback(
    (actionId: string) => {
      const prefix = mode === "course" ? "course" : "session";
      return `${API_BASE}/api/${prefix}/${sessionId}/audio/${actionId}`;
    },
    [mode, sessionId],
  );

  // Execute a single action
  const executeAction = useCallback(
    async (action: any) => {
      switch (action.type) {
        case "speech": {
          // Show narration subtitle
          setSpeechText(action.text || "");

          // Try to play TTS audio
          const audioUrl = getAudioUrl(action.id);
          return new Promise<void>((resolve) => {
            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            audio.onended = () => {
              setSpeechText("");
              resolve();
            };
            audio.onerror = () => {
              // No TTS audio available — show subtitle for estimated reading time
              const duration = action.text.length * 150; // ~150ms per CJK char
              setTimeout(() => {
                setSpeechText("");
                resolve();
              }, Math.max(duration, 2000));
            };
            audio.play().catch(() => {
              const duration = action.text.length * 150;
              setTimeout(() => {
                setSpeechText("");
                resolve();
              }, Math.max(duration, 2000));
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
    [getAudioUrl, setSpeechText, setSpotlight, setLaser, setWhiteboardOpen, addWhiteboardElement, removeWhiteboardElement, clearWhiteboard],
  );

  // Execute all actions for a scene sequentially
  const executeSceneActions = useCallback(
    async (scene: any, sessionId: string) => {
      playingRef.current = true;
      clearEffects();
      setSpeechText("");

      // Execute actions if any
      if (scene.actions?.length > 0) {
        for (const action of scene.actions) {
          if (!playingRef.current) break;
          await executeAction(action);
        }
      }

      // Quiz and interactive scenes: don't auto-advance, wait for user interaction
      if (scene.type === "quiz" || scene.type === "interactive") {
        return;
      }

      // Slides with no actions: give user time to read (min 5 seconds)
      if (!scene.actions?.length) {
        await delay(5000);
      }

      // Report step complete
      if (playingRef.current) {
        const stepCompletePath = mode === "course"
          ? `${API_BASE}/api/course/${sessionId}/step-complete`
          : `${API_BASE}/api/session/${sessionId}/step-complete`;
        await fetch(stepCompletePath, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stepIndex: scene.stepIndex ?? (scene.order - 1) }),
        });
      }
    },
    [executeAction, clearEffects, setSpeechText],
  );

  // Connect SSE
  useEffect(() => {
    if (!sessionId) return;

    const streamPath = mode === "course"
      ? `${API_BASE}/api/course/${sessionId}/stream`
      : `${API_BASE}/api/session/${sessionId}/stream`;
    const es = new EventSource(streamPath);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case "init":
          setStatus(data.status);
          setCurrentStep(data.currentStepIndex);
          setTotalSteps(data.totalSteps);
          // Course init includes existing scenes
          if (data.scenes?.length) {
            setScenes(data.scenes);
          }
          // Auto-start finalized courses that haven't begun playing
          if (mode === "course" && data.status === "finalized" && data.totalSteps > 0) {
            fetch(`${API_BASE}/api/course/${sessionId}/play`, { method: "POST" })
              .catch((err) => console.error("[sse] Auto-play failed:", err));
          }
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
          setSpeechText("");
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
          setSpeechText("");
          break;

        case "session_ended":
          setStatus("ended");
          playingRef.current = false;
          setSpeechText("");
          break;

        case "generating_progress":
          setStatus("generating");
          setGeneratingProgress(data.progress, data.message);
          break;

        // Course progressive loading events
        case "scene_added":
          addScene(data.scene);
          setTotalSteps(data.totalScenes);
          break;

        case "action_added":
          addActionToScene(data.sceneIndex, data.action);
          break;

        case "course_finalized":
          setTotalSteps(data.totalScenes);
          // Auto-start playback after finalization
          if (mode === "course") {
            fetch(`${API_BASE}/api/course/${sessionId}/play`, { method: "POST" })
              .catch((err) => console.error("[sse] Auto-play failed:", err));
          }
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
  }, [sessionId, mode]);

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
    setSpeechText("");
    await fetch(`${API_BASE}/api/session/${sessionId}/student-exit`, {
      method: "POST",
    });
  }, [sessionId]);

  return { requestHelp, exitSession };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
