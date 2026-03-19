/**
 * AI provider — wraps Vercel AI SDK for content generation.
 */

import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { AICallFn } from "./types/generation.js";

export function createAICallFn(): AICallFn {
  const apiKey = process.env.STAGE_AI_API_KEY || process.env.OPENAI_API_KEY;
  const model = process.env.STAGE_AI_MODEL || "gpt-4o";
  const baseURL = process.env.STAGE_AI_BASE_URL;

  if (!apiKey) {
    throw new Error("STAGE_AI_API_KEY or OPENAI_API_KEY must be set");
  }

  const openai = createOpenAI({ apiKey, baseURL });

  return async (system: string, user: string): Promise<string> => {
    const result = await generateText({
      model: openai(model),
      system,
      prompt: user,
      temperature: 0.7,
      maxTokens: 8192,
    });
    return result.text;
  };
}
