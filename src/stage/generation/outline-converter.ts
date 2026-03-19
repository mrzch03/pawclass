/**
 * Converts Mistakes App TeachingOutline → OpenMAIC-style SceneOutline[].
 *
 * Mapping:
 *  concept / example / mistake_review / summary → slide
 *  practice → quiz
 *  interactive → interactive
 */

import { nanoid } from "nanoid";
import type { TeachingOutline, TeachingOutlineStep } from "../types.js";
import type { SceneOutline } from "./types/generation.js";

export function convertTeachingOutlineToSceneOutlines(
  outline: TeachingOutline,
  language: "zh-CN" | "en-US" = "zh-CN",
): SceneOutline[] {
  return outline.steps.map((step) => convertStep(step, language));
}

function convertStep(
  step: TeachingOutlineStep,
  language: "zh-CN" | "en-US",
): SceneOutline {
  const base: SceneOutline = {
    id: nanoid(),
    title: step.title,
    description: step.description,
    keyPoints: step.keyPoints,
    estimatedDuration: step.estimatedSeconds,
    order: step.order,
    language,
    type: "slide", // default
  };

  switch (step.type) {
    case "concept":
    case "example":
    case "mistake_review":
    case "summary":
      return { ...base, type: "slide" };

    case "practice":
      return {
        ...base,
        type: "quiz",
        quizConfig: step.practiceConfig
          ? {
              questionCount: step.practiceConfig.questionCount,
              difficulty: step.practiceConfig.difficulty,
              questionTypes: step.practiceConfig.questionTypes.map((t) =>
                t === "short_answer" ? "text" : t,
              ),
            }
          : { questionCount: 3, difficulty: "medium", questionTypes: ["single"] },
      };

    case "interactive":
      return {
        ...base,
        type: "interactive",
        interactiveConfig: {
          conceptName: step.title,
          conceptOverview: step.description,
          designIdea: step.interactionHint,
        },
      };

    default:
      return { ...base, type: "slide" };
  }
}
