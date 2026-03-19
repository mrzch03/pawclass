/**
 * ScreenCanvas — main slide renderer.
 * Adapted from OpenMAIC ScreenCanvas for read-only rendering.
 */

import { useRef } from "react";
import { ScreenElement } from "./ScreenElement";
import { SpotlightOverlay } from "./SpotlightOverlay";
import { LaserOverlay } from "./LaserOverlay";
import { useCanvasStore } from "../store/canvas-store";

interface ScreenCanvasProps {
  slide: any; // Slide type
  width?: number;
  height?: number;
}

export function ScreenCanvas({ slide, width = 1000, height }: ScreenCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const spotlightElementId = useCanvasStore((s) => s.spotlightElementId);
  const laserElementId = useCanvasStore((s) => s.laserElementId);

  if (!slide) return null;

  const viewportSize = slide.viewportSize || 1000;
  const viewportRatio = slide.viewportRatio || 0.5625;
  const canvasHeight = height || width * viewportRatio;
  const scale = width / viewportSize;

  const bgStyle: React.CSSProperties = {};
  if (slide.background) {
    if (slide.background.type === "solid" && slide.background.color) {
      bgStyle.backgroundColor = slide.background.color;
    } else if (slide.background.type === "image" && slide.background.image?.src) {
      bgStyle.backgroundImage = `url(${slide.background.image.src})`;
      bgStyle.backgroundSize = slide.background.image.size || "cover";
      bgStyle.backgroundPosition = "center";
    }
  } else if (slide.theme?.backgroundColor) {
    bgStyle.backgroundColor = slide.theme.backgroundColor;
  }

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ width, height: canvasHeight, ...bgStyle }}
    >
      <div
        style={{
          width: viewportSize,
          height: viewportSize * viewportRatio,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
        }}
      >
        {slide.elements?.map((element: any) => (
          <ScreenElement key={element.id} element={element} />
        ))}
      </div>

      {spotlightElementId && (
        <SpotlightOverlay elementId={spotlightElementId} containerRef={containerRef} />
      )}
      {laserElementId && (
        <LaserOverlay elementId={laserElementId} containerRef={containerRef} />
      )}
    </div>
  );
}
