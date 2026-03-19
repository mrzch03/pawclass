/**
 * Stage store — manages scenes, current scene, and whiteboard state.
 */

import { create } from "zustand";

export interface StageState {
  scenes: any[];
  currentSceneIndex: number;
  currentScene: any | null;
  whiteboardElements: any[];
  isWhiteboardOpen: boolean;

  setScenes: (scenes: any[]) => void;
  setCurrentSceneIndex: (index: number) => void;
  setWhiteboardElements: (elements: any[]) => void;
  addWhiteboardElement: (element: any) => void;
  removeWhiteboardElement: (elementId: string) => void;
  clearWhiteboard: () => void;
  setWhiteboardOpen: (open: boolean) => void;
}

export const useStageStore = create<StageState>((set, get) => ({
  scenes: [],
  currentSceneIndex: 0,
  currentScene: null,
  whiteboardElements: [],
  isWhiteboardOpen: false,

  setScenes: (scenes) => set({ scenes, currentScene: scenes[0] || null }),

  setCurrentSceneIndex: (index) =>
    set((state) => ({
      currentSceneIndex: index,
      currentScene: state.scenes[index] || null,
    })),

  setWhiteboardElements: (elements) => set({ whiteboardElements: elements }),

  addWhiteboardElement: (element) =>
    set((state) => ({
      whiteboardElements: [...state.whiteboardElements, element],
    })),

  removeWhiteboardElement: (elementId) =>
    set((state) => ({
      whiteboardElements: state.whiteboardElements.filter(
        (el: any) => el.id !== elementId,
      ),
    })),

  clearWhiteboard: () => set({ whiteboardElements: [] }),

  setWhiteboardOpen: (open) => set({ isWhiteboardOpen: open }),
}));
