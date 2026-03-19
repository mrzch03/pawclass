/**
 * Scene builder.
 *
 * Adapted from OpenMAIC (https://github.com/openmaic/openmaic)
 * Original license: AGPL-3.0
 *
 * Builds complete Scene objects from SceneOutlines.
 * No store dependency — returns Scene objects directly.
 */

import { nanoid } from "nanoid";
import type { SceneOutline, GeneratedSlideContent, GeneratedQuizContent, GeneratedInteractiveContent, AICallFn } from "./types/generation.js";
import type { Slide, SlideTheme } from "./types/slides.js";
import type { Scene } from "./types/stage.js";
import type { Action } from "./types/action.js";
import { generateSceneContent, generateSceneActions } from "./scene-generator.js";

/**
 * Build a complete Scene from a SceneOutline using AI generation.
 */
export async function buildSceneFromOutline(
  outline: SceneOutline,
  aiCall: AICallFn,
  stageId: string,
  onPhaseChange?: (phase: "content" | "actions") => void,
): Promise<Scene | null> {
  // Step 1: Generate content
  onPhaseChange?.("content");
  console.log(`[scene-builder] Generating content for: ${outline.title}`);

  const content = await generateSceneContent(outline, aiCall);
  if (!content) {
    console.error(`[scene-builder] Failed to generate content for: ${outline.title}`);
    return null;
  }

  // Step 2: Generate actions
  onPhaseChange?.("actions");
  console.log(`[scene-builder] Generating actions for: ${outline.title}`);

  const actions = await generateSceneActions(outline, content, aiCall);
  console.log(`[scene-builder] Generated ${actions.length} actions for: ${outline.title}`);

  // Build complete Scene object
  return buildCompleteScene(outline, content, actions, stageId);
}

/**
 * Build complete Scene object from content and actions.
 */
export function buildCompleteScene(
  outline: SceneOutline,
  content: GeneratedSlideContent | GeneratedQuizContent | GeneratedInteractiveContent,
  actions: Action[],
  stageId: string,
): Scene | null {
  const sceneId = nanoid();

  if (outline.type === "slide" && "elements" in content) {
    const defaultTheme: SlideTheme = {
      backgroundColor: "#ffffff",
      themeColors: ["#5b9bd5", "#ed7d31", "#a5a5a5", "#ffc000", "#4472c4"],
      fontColor: "#333333",
      fontName: "Microsoft YaHei",
      outline: { color: "#d14424", width: 2, style: "solid" },
      shadow: { h: 0, v: 0, blur: 10, color: "#000000" },
    };

    const slide: Slide = {
      id: nanoid(),
      viewportSize: 1000,
      viewportRatio: 0.5625,
      theme: defaultTheme,
      elements: content.elements,
      background: content.background,
    };

    return {
      id: sceneId,
      stageId,
      type: "slide",
      title: outline.title,
      order: outline.order,
      content: { type: "slide", canvas: slide },
      actions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  if (outline.type === "quiz" && "questions" in content) {
    return {
      id: sceneId,
      stageId,
      type: "quiz",
      title: outline.title,
      order: outline.order,
      content: { type: "quiz", questions: content.questions },
      actions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  if (outline.type === "interactive" && "html" in content) {
    return {
      id: sceneId,
      stageId,
      type: "interactive",
      title: outline.title,
      order: outline.order,
      content: { type: "interactive", url: "", html: content.html },
      actions,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }

  return null;
}
