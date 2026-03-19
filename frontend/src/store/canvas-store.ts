/**
 * Canvas store — manages spotlight, laser, and whiteboard visual state.
 * Simplified from OpenMAIC canvas store for read-only rendering.
 */

import { create } from "zustand";

export interface CanvasState {
  // Spotlight
  spotlightElementId: string | null;
  spotlightDimOpacity: number;

  // Laser
  laserElementId: string | null;
  laserColor: string;

  // Actions
  setSpotlight: (elementId: string | null, dimOpacity?: number) => void;
  setLaser: (elementId: string | null, color?: string) => void;
  clearEffects: () => void;
}

export const useCanvasStore = create<CanvasState>((set) => ({
  spotlightElementId: null,
  spotlightDimOpacity: 0.5,
  laserElementId: null,
  laserColor: "#ff0000",

  setSpotlight: (elementId, dimOpacity = 0.5) =>
    set({ spotlightElementId: elementId, spotlightDimOpacity: dimOpacity }),

  setLaser: (elementId, color = "#ff0000") =>
    set({ laserElementId: elementId, laserColor: color }),

  clearEffects: () =>
    set({
      spotlightElementId: null,
      laserElementId: null,
    }),
}));
