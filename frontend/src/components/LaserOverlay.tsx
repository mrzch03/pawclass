/**
 * LaserOverlay — laser pointer effect on an element.
 * Adapted from OpenMAIC LaserOverlay.
 */

import { useEffect, useState, type RefObject } from "react";
import { useCanvasStore } from "../store/canvas-store";

interface LaserOverlayProps {
  elementId: string;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function LaserOverlay({ elementId, containerRef }: LaserOverlayProps) {
  const laserColor = useCanvasStore((s) => s.laserColor);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const el = container.querySelector(`[data-element-id="${elementId}"]`);
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    setPos({
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top + rect.height / 2,
    });
  }, [elementId, containerRef]);

  if (!pos) return null;

  return (
    <div
      className="pointer-events-none absolute"
      style={{
        left: pos.x - 12,
        top: pos.y - 12,
        width: 24,
        height: 24,
        zIndex: 60,
      }}
    >
      {/* Outer ring with pulse */}
      <div
        className="absolute inset-0 animate-ping rounded-full"
        style={{
          backgroundColor: laserColor,
          opacity: 0.3,
          animationDuration: "1.5s",
        }}
      />
      {/* Inner dot */}
      <div
        className="absolute rounded-full"
        style={{
          left: 8,
          top: 8,
          width: 8,
          height: 8,
          backgroundColor: laserColor,
          boxShadow: `0 0 8px ${laserColor}, 0 0 16px ${laserColor}`,
        }}
      />
    </div>
  );
}
