/**
 * ScreenElement — dispatches rendering to type-specific element renderers.
 * Adapted from OpenMAIC for read-only mode.
 */

interface ScreenElementProps {
  element: any;
}

export function ScreenElement({ element }: ScreenElementProps) {
  const style: React.CSSProperties = {
    position: "absolute",
    left: element.left,
    top: element.top,
    width: element.width,
    height: element.type === "line" ? undefined : element.height,
    transform: element.rotate ? `rotate(${element.rotate}deg)` : undefined,
    opacity: element.opacity ?? 1,
  };

  switch (element.type) {
    case "text":
      return <TextElement element={element} style={style} />;
    case "image":
      return <ImageElement element={element} style={style} />;
    case "shape":
      return <ShapeElement element={element} style={style} />;
    case "line":
      return <LineElement element={element} style={style} />;
    case "chart":
      return <ChartElement element={element} style={style} />;
    case "latex":
      return <LatexElement element={element} style={style} />;
    case "table":
      return <TableElement element={element} style={style} />;
    default:
      return null;
  }
}

function TextElement({ element, style }: { element: any; style: React.CSSProperties }) {
  return (
    <div
      data-element-id={element.id}
      style={{
        ...style,
        color: element.defaultColor || "#333",
        fontFamily: element.defaultFontName || "sans-serif",
        lineHeight: element.lineHeight || 1.5,
        backgroundColor: element.fill || undefined,
        overflow: "hidden",
      }}
      dangerouslySetInnerHTML={{ __html: element.content }}
    />
  );
}

function ImageElement({ element, style }: { element: any; style: React.CSSProperties }) {
  return (
    <div data-element-id={element.id} style={style}>
      <img
        src={element.src}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: element.radius ? `${element.radius}px` : undefined,
          transform: [
            element.flipH ? "scaleX(-1)" : "",
            element.flipV ? "scaleY(-1)" : "",
          ].join(" ").trim() || undefined,
        }}
      />
    </div>
  );
}

function ShapeElement({ element, style }: { element: any; style: React.CSSProperties }) {
  const [vw, vh] = element.viewBox || [1000, 1000];
  return (
    <div data-element-id={element.id} style={style}>
      <svg viewBox={`0 0 ${vw} ${vh}`} width="100%" height="100%">
        <path d={element.path} fill={element.fill || "#5b9bd5"} />
      </svg>
      {element.text && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems:
              element.text.align === "top" ? "flex-start" :
              element.text.align === "bottom" ? "flex-end" : "center",
            justifyContent: "center",
            padding: "8px",
            color: element.text.defaultColor || "#333",
            fontFamily: element.text.defaultFontName || "sans-serif",
            fontSize: "14px",
          }}
          dangerouslySetInnerHTML={{ __html: element.text.content }}
        />
      )}
    </div>
  );
}

function LineElement({ element, style }: { element: any; style: React.CSSProperties }) {
  const [sx, sy] = element.start || [0, 0];
  const [ex, ey] = element.end || [0, 0];
  const minX = Math.min(sx, ex);
  const minY = Math.min(sy, ey);
  const w = Math.abs(ex - sx) || 1;
  const h = Math.abs(ey - sy) || 1;

  return (
    <div data-element-id={element.id} style={{ ...style, width: element.width, height: h }}>
      <svg viewBox={`${minX} ${minY} ${w} ${h}`} width="100%" height="100%">
        <line
          x1={sx}
          y1={sy}
          x2={ex}
          y2={ey}
          stroke={element.color || "#333"}
          strokeWidth={2}
          strokeDasharray={element.style === "dashed" ? "8,4" : undefined}
          markerEnd={element.points?.[1] === "arrow" ? "url(#arrowhead)" : undefined}
        />
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill={element.color || "#333"} />
          </marker>
        </defs>
      </svg>
    </div>
  );
}

function ChartElement({ element, style }: { element: any; style: React.CSSProperties }) {
  // Simplified chart rendering — shows data as text for now
  // Full chart rendering would use a library like Chart.js
  return (
    <div
      data-element-id={element.id}
      style={{
        ...style,
        backgroundColor: element.fill || "#f8f9fa",
        border: "1px solid #e0e0e0",
        borderRadius: "4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "12px",
        color: "#666",
        padding: "8px",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
          {element.chartType} chart
        </div>
        <div>{element.data?.labels?.join(", ")}</div>
      </div>
    </div>
  );
}

function LatexElement({ element, style }: { element: any; style: React.CSSProperties }) {
  if (element.html) {
    return (
      <div
        data-element-id={element.id}
        style={{ ...style, display: "flex", alignItems: "center", justifyContent: element.align || "center" }}
        dangerouslySetInnerHTML={{ __html: element.html }}
      />
    );
  }
  return (
    <div
      data-element-id={element.id}
      style={{ ...style, fontFamily: "serif", fontSize: "16px", display: "flex", alignItems: "center" }}
    >
      {element.latex}
    </div>
  );
}

function TableElement({ element, style }: { element: any; style: React.CSSProperties }) {
  return (
    <div data-element-id={element.id} style={{ ...style, overflow: "hidden" }}>
      <table
        style={{
          width: "100%",
          height: "100%",
          borderCollapse: "collapse",
          fontSize: "12px",
        }}
      >
        <tbody>
          {element.data?.map((row: any[], rowIndex: number) => (
            <tr key={rowIndex}>
              {row.map((cell: any, colIndex: number) => (
                <td
                  key={colIndex}
                  colSpan={cell.colspan || 1}
                  rowSpan={cell.rowspan || 1}
                  style={{
                    border: "1px solid #ddd",
                    padding: "4px 8px",
                    backgroundColor: cell.style?.backcolor,
                    color: cell.style?.color,
                    fontWeight: cell.style?.bold ? "bold" : undefined,
                    fontStyle: cell.style?.em ? "italic" : undefined,
                    textAlign: cell.style?.align || "left",
                    fontSize: cell.style?.fontsize || undefined,
                  }}
                >
                  {cell.text}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
