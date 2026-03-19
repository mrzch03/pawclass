/**
 * Playback store — manages playback status and current step.
 */

import { create } from "zustand";

export type PlaybackStatus =
  | "idle"
  | "generating"
  | "ready"
  | "playing"
  | "paused"
  | "completed"
  | "ended";

export interface PlaybackState {
  status: PlaybackStatus;
  currentStepIndex: number;
  totalSteps: number;
  generatingProgress: number;
  generatingMessage: string;

  setStatus: (status: PlaybackStatus) => void;
  setCurrentStep: (index: number) => void;
  setTotalSteps: (total: number) => void;
  setGeneratingProgress: (progress: number, message: string) => void;
}

export const usePlaybackStore = create<PlaybackState>((set) => ({
  status: "idle",
  currentStepIndex: 0,
  totalSteps: 0,
  generatingProgress: 0,
  generatingMessage: "",

  setStatus: (status) => set({ status }),
  setCurrentStep: (index) => set({ currentStepIndex: index }),
  setTotalSteps: (total) => set({ totalSteps: total }),
  setGeneratingProgress: (progress, message) =>
    set({ generatingProgress: progress, generatingMessage: message }),
}));
