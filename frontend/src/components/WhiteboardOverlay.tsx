/**
 * WhiteboardOverlay — renders whiteboard elements drawn by actions.
 * Adapted from OpenMAIC whiteboard-canvas for read-only mode.
 */

import { useStageStore } from "../store/stage-store";

export function WhiteboardOverlay() {
  const isOpen = useStageStore((s) => s.isWhiteboardOpen);
  const elements = useStageStore((s) => s.whiteboardElements);

  if (!isOpen) return null;

  return (
    <div
      className="absolute inset-0 z-40 transition-opacity duration-300"
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.95)",
      }}
    >
      <div className="relative h-full w-full" style={{ aspectRatio: "16/9" }}>
        {elements.map((el: any, index: number) => (
          <WhiteboardElement key={el.elementId || el.id || index} element={el} index={index} />
        ))}
      </div>
    </div>
  );
}

function WhiteboardElement({ element, index }: { element: any; index: number }) {
  const baseStyle: React.CSSProperties = {
    position: "absolute",
    animation: `fadeIn 0.3s ease ${index * 0.1}s both`,
  };

  switch (element.type) {
    case "wb_draw_text":
      return (
        <div
          style={{
            ...baseStyle,
            left: `${(element.x / 1000) * 100}%`,
            top: `${(element.y / 562.5) * 100}%`,
            width: element.width || 400,
            fontSize: element.fontSize || 18,
            color: element.color || "#333",
          }}
          dangerouslySetInnerHTML={{ __html: element.content }}
        />
      );

    case "wb_draw_shape": {
      const shapeStyle: React.CSSProperties = {
        ...baseStyle,
        left: `${(element.x / 1000) * 100}%`,
        top: `${(element.y / 562.5) * 100}%`,
        width: element.width,
        height: element.height,
        backgroundColor: element.fillColor || "#5b9bd5",
      };
      if (element.shape === "circle") {
        shapeStyle.borderRadius = "50%";
      } else if (element.shape === "triangle") {
        return (
          <div style={{ ...baseStyle, left: `${(element.x / 1000) * 100}%`, top: `${(element.y / 562.5) * 100}%` }}>
            <svg width={element.width} height={element.height}>
              <polygon
                points={`${element.width / 2},0 ${element.width},${element.height} 0,${element.height}`}
                fill={element.fillColor || "#5b9bd5"}
              />
            </svg>
          </div>
        );
      }
      return <div style={shapeStyle} />;
    }

    case "wb_draw_latex":
      return (
        <div
          style={{
            ...baseStyle,
            left: `${(element.x / 1000) * 100}%`,
            top: `${(element.y / 562.5) * 100}%`,
            color: element.color || "#000",
            fontFamily: "serif",
            fontSize: "18px",
          }}
        >
          {element.latex}
        </div>
      );

    case "wb_draw_line":
      return (
        <svg
          style={{
            ...baseStyle,
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          <line
            x1={`${(element.startX / 1000) * 100}%`}
            y1={`${(element.startY / 562.5) * 100}%`}
            x2={`${(element.endX / 1000) * 100}%`}
            y2={`${(element.endY / 562.5) * 100}%`}
            stroke={element.color || "#333"}
            strokeWidth={element.width || 2}
            strokeDasharray={element.style === "dashed" ? "8,4" : undefined}
          />
        </svg>
      );

    case "wb_draw_table":
      return (
        <div
          style={{
            ...baseStyle,
            left: `${(element.x / 1000) * 100}%`,
            top: `${(element.y / 562.5) * 100}%`,
            width: element.width,
            height: element.height,
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <tbody>
              {element.data?.map((row: string[], ri: number) => (
                <tr key={ri}>
                  {row.map((cell: string, ci: number) => (
                    <td key={ci} style={{ border: "1px solid #ddd", padding: "4px" }}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "wb_draw_chart":
      return (
        <div
          style={{
            ...baseStyle,
            left: `${(element.x / 1000) * 100}%`,
            top: `${(element.y / 562.5) * 100}%`,
            width: element.width,
            height: element.height,
            backgroundColor: "#f8f9fa",
            border: "1px solid #e0e0e0",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
          }}
        >
          {element.chartType} chart
        </div>
      );

    default:
      return null;
  }
}
