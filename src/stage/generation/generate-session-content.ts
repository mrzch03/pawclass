/**
 * Session content generation orchestrator.
 *
 * Takes a teaching outline, converts to SceneOutlines, then generates
 * full Scene content (slides, quizzes, interactives) with actions.
 */

import type { TeachingOutline } from "../types.js";
import type { Scene } from "./types/stage.js";
import { convertTeachingOutlineToSceneOutlines } from "./outline-converter.js";
import { buildSceneFromOutline } from "./scene-builder.js";
import { createAICallFn } from "./ai-provider.js";
import { generateTTSForScenes } from "../tts/tts-generator.js";

export interface GenerationProgressEvent {
  phase: "converting" | "generating" | "tts" | "complete";
  sceneIndex?: number;
  totalScenes: number;
  sceneName?: string;
}

/**
 * Generate all session content from a teaching outline.
 */
export async function generateSessionContent(
  sessionId: string,
  outline: TeachingOutline,
  onProgress?: (event: GenerationProgressEvent) => void,
): Promise<Scene[]> {
  // Step 1: Convert teaching outline to scene outlines
  onProgress?.({ phase: "converting", totalScenes: outline.steps.length });
  const sceneOutlines = convertTeachingOutlineToSceneOutlines(outline);
  console.log(`[generate] Converted ${sceneOutlines.length} scene outlines`);

  // Step 2: Generate content for each scene
  const aiCall = createAICallFn();
  const scenes: Scene[] = [];

  for (let i = 0; i < sceneOutlines.length; i++) {
    const so = sceneOutlines[i];
    onProgress?.({
      phase: "generating",
      sceneIndex: i,
      totalScenes: sceneOutlines.length,
      sceneName: so.title,
    });

    console.log(`[generate] Scene ${i + 1}/${sceneOutlines.length}: ${so.title}`);

    try {
      const scene = await buildSceneFromOutline(so, aiCall, sessionId);
      if (scene) {
        scenes.push(scene);
      } else {
        console.error(`[generate] Scene ${i + 1} returned null: ${so.title}`);
      }
    } catch (e: any) {
      console.error(`[generate] Scene ${i + 1} failed: ${e.message}`);
    }
  }

  // Step 3: Generate TTS audio
  onProgress?.({ phase: "tts", totalScenes: scenes.length });
  try {
    await generateTTSForScenes(sessionId, scenes);
  } catch (e: any) {
    console.warn(`[generate] TTS generation failed (non-fatal): ${e.message}`);
  }

  onProgress?.({ phase: "complete", totalScenes: scenes.length });
  console.log(`[generate] Completed: ${scenes.length} scenes generated for session ${sessionId}`);

  return scenes;
}
