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
  /** Append a new scene (progressive course loading) */
  addScene: (scene: any) => void;
  /** Append an action to a specific scene (progressive course loading) */
  addActionToScene: (sceneIndex: number, action: any) => void;
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

  addScene: (scene) =>
    set((state) => {
      const scenes = [...state.scenes, scene];
      return {
        scenes,
        // If this is the first scene and no scene is selected yet, select it
        currentScene: state.currentScene || scenes[0] || null,
      };
    }),

  addActionToScene: (sceneIndex, action) =>
    set((state) => {
      const scenes = [...state.scenes];
      if (scenes[sceneIndex]) {
        scenes[sceneIndex] = {
          ...scenes[sceneIndex],
          actions: [...(scenes[sceneIndex].actions || []), action],
        };
      }
      return { scenes };
    }),

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
