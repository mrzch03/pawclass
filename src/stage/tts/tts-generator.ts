/**
 * TTS pre-generation — uses OpenAI TTS API to generate audio for speech actions.
 * Audio files are stored to disk and served via HTTP.
 */

import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Scene } from "../generation/types/stage.js";
import type { SpeechAction } from "../generation/types/action.js";

const TTS_BASE_DIR = process.env.STAGE_TTS_DIR || "/workspace/stage-data";

export interface TTSConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  voice?: string;
}

/**
 * Generate TTS audio for all speech actions in all scenes.
 * Returns the number of audio files generated.
 */
export async function generateTTSForScenes(
  sessionId: string,
  scenes: Scene[],
  config?: TTSConfig,
): Promise<number> {
  const apiKey = config?.apiKey || process.env.STAGE_TTS_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = config?.baseUrl || process.env.STAGE_TTS_BASE_URL || "https://api.openai.com/v1";
  const model = config?.model || process.env.STAGE_TTS_MODEL || "tts-1";
  const voice = config?.voice || process.env.STAGE_TTS_VOICE || "alloy";

  if (!apiKey) {
    console.warn("[tts] No API key configured, skipping TTS generation");
    return 0;
  }

  const audioDir = join(TTS_BASE_DIR, sessionId, "audio");
  mkdirSync(audioDir, { recursive: true });

  let count = 0;

  for (const scene of scenes) {
    if (!scene.actions) continue;

    for (const action of scene.actions) {
      if (action.type !== "speech") continue;

      const speechAction = action as SpeechAction;
      const audioPath = join(audioDir, `${action.id}.mp3`);

      // Skip if already generated
      if (existsSync(audioPath)) {
        count++;
        continue;
      }

      try {
        const response = await fetch(`${baseUrl}/audio/speech`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            input: speechAction.text,
            voice: speechAction.voice || voice,
            speed: speechAction.speed || 1.0,
            response_format: "mp3",
          }),
        });

        if (!response.ok) {
          console.error(`[tts] Failed for action ${action.id}: ${response.status}`);
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        writeFileSync(audioPath, buffer);

        // Store the audioId reference on the action
        speechAction.audioId = action.id;
        count++;

        console.log(`[tts] Generated audio for action ${action.id} (${buffer.length} bytes)`);
      } catch (e: any) {
        console.error(`[tts] Error generating audio for ${action.id}: ${e.message}`);
      }
    }
  }

  console.log(`[tts] Generated ${count} audio files for session ${sessionId}`);
  return count;
}

/**
 * Get the file path for a TTS audio file.
 */
export function getAudioPath(sessionId: string, actionId: string): string {
  return join(TTS_BASE_DIR, sessionId, "audio", `${actionId}.mp3`);
}
