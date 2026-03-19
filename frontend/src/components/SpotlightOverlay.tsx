/**
 * SpotlightOverlay — dims everything except the focused element.
 * Adapted from OpenMAIC SpotlightOverlay.
 */

import { useEffect, useState, type RefObject } from "react";
import { useCanvasStore } from "../store/canvas-store";

interface SpotlightOverlayProps {
  elementId: string;
  containerRef: RefObject<HTMLDivElement | null>;
}

export function SpotlightOverlay({ elementId, containerRef }: SpotlightOverlayProps) {
  const dimOpacity = useCanvasStore((s) => s.spotlightDimOpacity);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [containerRect, setContainerRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const el = container.querySelector(`[data-element-id="${elementId}"]`);
    if (!el) return;

    setRect(el.getBoundingClientRect());
    setContainerRect(container.getBoundingClientRect());
  }, [elementId, containerRef]);

  if (!rect || !containerRect) return null;

  const x = rect.left - containerRect.left;
  const y = rect.top - containerRect.top;
  const w = rect.width;
  const h = rect.height;
  const cw = containerRect.width;
  const ch = containerRect.height;
  const padding = 8;
  const radius = 12;

  return (
    <svg
      className="pointer-events-none absolute inset-0 transition-all duration-500"
      width={cw}
      height={ch}
      style={{ zIndex: 50 }}
    >
      <defs>
        <mask id="spotlight-mask">
          <rect width={cw} height={ch} fill="white" />
          <rect
            x={x - padding}
            y={y - padding}
            width={w + padding * 2}
            height={h + padding * 2}
            rx={radius}
            ry={radius}
            fill="black"
          />
        </mask>
      </defs>
      <rect
        width={cw}
        height={ch}
        fill={`rgba(0, 0, 0, ${dimOpacity})`}
        mask="url(#spotlight-mask)"
      />
      <rect
        x={x - padding}
        y={y - padding}
        width={w + padding * 2}
        height={h + padding * 2}
        rx={radius}
        ry={radius}
        fill="none"
        stroke="rgba(255, 255, 255, 0.6)"
        strokeWidth="2"
        filter="blur(2px)"
      />
    </svg>
  );
}
