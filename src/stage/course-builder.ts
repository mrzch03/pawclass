/**
 * Course builder — pure functions for building Scene and Action objects.
 *
 * No AI, no store dependency. Takes simple inputs, returns typed objects.
 * Reuses types from src/stage/generation/types/.
 */

import { nanoid } from "nanoid";
import type { Slide, SlideTheme, PPTTextElement, PPTShapeElement } from "./generation/types/slides.js";
import type { SlideContent, QuizContent, InteractiveContent, QuizQuestion, QuizOption } from "./generation/types/stage.js";
import type { SpeechAction, WbDrawTextAction, WbDrawShapeAction, WbDrawLatexAction, WbDrawLineAction, Action } from "./generation/types/action.js";
import type { Scene } from "../types.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_THEME: SlideTheme = {
  backgroundColor: "#ffffff",
  themeColors: ["#5b9bd5", "#ed7d31", "#a5a5a5", "#ffc000", "#4472c4"],
  fontColor: "#333333",
  fontName: "Microsoft YaHei",
};

const CODE_THEME: SlideTheme = {
  backgroundColor: "#1e1e1e",
  themeColors: ["#569cd6", "#ce9178", "#608b4e", "#dcdcaa", "#4ec9b0"],
  fontColor: "#d4d4d4",
  fontName: "Consolas",
};

const VIEWPORT_SIZE = 1000;
const VIEWPORT_RATIO = 0.5625; // 16:9

// ---------------------------------------------------------------------------
// Scene builders
// ---------------------------------------------------------------------------

export function buildSlideScene(opts: {
  title: string;
  content: string;
}): Scene {
  const elements: (PPTTextElement | PPTShapeElement)[] = [];

  // Title element
  elements.push({
    id: nanoid(),
    type: "text",
    left: 50,
    top: 30,
    width: 900,
    height: 80,
    rotate: 0,
    content: `<p style="text-align: center;"><strong>${escapeHtml(opts.title)}</strong></p>`,
    defaultFontName: "Microsoft YaHei",
    defaultColor: "#333333",
    lineHeight: 1.5,
    textType: "title",
  });

  // Content element
  elements.push({
    id: nanoid(),
    type: "text",
    left: 60,
    top: 140,
    width: 880,
    height: 400,
    rotate: 0,
    content: markdownToHtml(opts.content),
    defaultFontName: "Microsoft YaHei",
    defaultColor: "#444444",
    lineHeight: 1.8,
    textType: "content",
  });

  const slide: Slide = {
    id: nanoid(),
    viewportSize: VIEWPORT_SIZE,
    viewportRatio: VIEWPORT_RATIO,
    theme: DEFAULT_THEME,
    elements,
  };

  return {
    id: nanoid(),
    stepIndex: 0, // will be set by course-store.addScene
    type: "slide",
    title: opts.title,
    content: { type: "slide", canvas: slide } satisfies SlideContent,
    actions: [],
  };
}

export function buildCodeScene(opts: {
  language: string;
  content: string;
  title?: string;
}): Scene {
  const title = opts.title || `${opts.language} 代码`;
  const elements: PPTTextElement[] = [];

  // Title element (light text on dark bg)
  elements.push({
    id: nanoid(),
    type: "text",
    left: 40,
    top: 20,
    width: 920,
    height: 50,
    rotate: 0,
    content: `<p><strong>${escapeHtml(title)}</strong></p>`,
    defaultFontName: "Microsoft YaHei",
    defaultColor: "#cccccc",
    lineHeight: 1.4,
    textType: "title",
  });

  // Code block element
  elements.push({
    id: nanoid(),
    type: "text",
    left: 40,
    top: 90,
    width: 920,
    height: 450,
    rotate: 0,
    content: `<pre style="font-family: Consolas, monospace; font-size: 14px;"><code>${escapeHtml(opts.content)}</code></pre>`,
    defaultFontName: "Consolas",
    defaultColor: "#d4d4d4",
    lineHeight: 1.6,
    fill: "#2d2d2d",
    textType: "content",
  });

  const slide: Slide = {
    id: nanoid(),
    viewportSize: VIEWPORT_SIZE,
    viewportRatio: VIEWPORT_RATIO,
    theme: CODE_THEME,
    elements,
    background: { type: "solid", color: "#1e1e1e" },
  };

  return {
    id: nanoid(),
    stepIndex: 0,
    type: "slide",
    title,
    content: { type: "slide", canvas: slide } satisfies SlideContent,
    actions: [],
  };
}

export function buildQuizScene(opts: {
  question: string;
  options: string[];
  answer: number;
}): Scene {
  const questionId = nanoid();
  const quizOptions: QuizOption[] = opts.options.map((text, i) => ({
    label: String.fromCharCode(65 + i), // A, B, C, ...
    value: text,
  }));

  const question: QuizQuestion = {
    id: questionId,
    type: "single",
    question: opts.question,
    options: quizOptions,
    answer: [String(opts.answer)],
    hasAnswer: true,
    points: 1,
  };

  return {
    id: nanoid(),
    stepIndex: 0,
    type: "quiz",
    title: opts.question.length > 40 ? opts.question.slice(0, 40) + "..." : opts.question,
    content: { type: "quiz", questions: [question] } satisfies QuizContent,
    actions: [],
  };
}

export function buildInteractiveScene(opts: {
  type: string;
  language?: string;
}): Scene {
  // Build a simple interactive HTML template based on type
  let html = "";
  if (opts.type === "code-editor") {
    html = buildCodeEditorHtml(opts.language || "python");
  } else {
    html = `<div style="padding:20px;font-family:sans-serif;"><p>Interactive: ${escapeHtml(opts.type)}</p></div>`;
  }

  return {
    id: nanoid(),
    stepIndex: 0,
    type: "interactive",
    title: `${opts.type}${opts.language ? ` (${opts.language})` : ""}`,
    content: { type: "interactive", url: "", html } satisfies InteractiveContent,
    actions: [],
  };
}

// ---------------------------------------------------------------------------
// Action builders
// ---------------------------------------------------------------------------

export function buildNarrationAction(opts: { text: string }): SpeechAction {
  return {
    id: nanoid(),
    type: "speech",
    text: opts.text,
  };
}

export function buildWhiteboardAction(opts: {
  type: "text" | "shape" | "latex" | "line";
  content?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fontSize?: number;
  color?: string;
  shape?: "rectangle" | "circle" | "triangle";
}): Action {
  const id = nanoid();

  switch (opts.type) {
    case "text":
      return {
        id,
        type: "wb_draw_text",
        content: opts.content || "",
        x: opts.x,
        y: opts.y,
        width: opts.width,
        height: opts.height,
        fontSize: opts.fontSize,
        color: opts.color,
      } satisfies WbDrawTextAction;

    case "shape":
      return {
        id,
        type: "wb_draw_shape",
        shape: opts.shape || "rectangle",
        x: opts.x,
        y: opts.y,
        width: opts.width || 100,
        height: opts.height || 100,
        fillColor: opts.color,
      } satisfies WbDrawShapeAction;

    case "latex":
      return {
        id,
        type: "wb_draw_latex",
        latex: opts.content || "",
        x: opts.x,
        y: opts.y,
        width: opts.width,
        height: opts.height,
        color: opts.color,
      } satisfies WbDrawLatexAction;

    case "line":
      return {
        id,
        type: "wb_draw_line",
        startX: opts.x,
        startY: opts.y,
        endX: opts.x + (opts.width || 100),
        endY: opts.y + (opts.height || 0),
        color: opts.color,
      } satisfies WbDrawLineAction;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Simple markdown → HTML for slide content */
function markdownToHtml(md: string): string {
  return md
    .split("\n")
    .map((line) => {
      if (line.startsWith("### ")) return `<p><strong>${escapeHtml(line.slice(4))}</strong></p>`;
      if (line.startsWith("## ")) return `<p style="font-size:20px;"><strong>${escapeHtml(line.slice(3))}</strong></p>`;
      if (line.startsWith("# ")) return `<p style="font-size:24px;"><strong>${escapeHtml(line.slice(2))}</strong></p>`;
      if (line.startsWith("- ")) return `<p>• ${escapeHtml(line.slice(2))}</p>`;
      if (line.startsWith("* ")) return `<p>• ${escapeHtml(line.slice(2))}</p>`;
      if (line.trim() === "") return `<p><br></p>`;
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join("");
}

function buildCodeEditorHtml(language: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 0; padding: 16px; font-family: sans-serif; background: #1e1e1e; color: #d4d4d4; }
  textarea { width: 100%; height: 60vh; background: #2d2d2d; color: #d4d4d4; border: 1px solid #555;
    font-family: Consolas, monospace; font-size: 14px; padding: 12px; resize: none; border-radius: 4px; }
  button { margin-top: 8px; padding: 8px 16px; background: #0e639c; color: white; border: none;
    border-radius: 4px; cursor: pointer; font-size: 14px; }
  button:hover { background: #1177bb; }
  #output { margin-top: 12px; padding: 12px; background: #1a1a1a; border-radius: 4px;
    font-family: Consolas, monospace; font-size: 13px; white-space: pre-wrap; min-height: 60px; }
</style>
</head>
<body>
  <div style="font-size: 12px; color: #888; margin-bottom: 8px;">${language}</div>
  <textarea id="code" placeholder="在此编写代码..."></textarea>
  <button onclick="document.getElementById('output').textContent = '运行中...'">运行</button>
  <div id="output"></div>
</body>
</html>`;
}
