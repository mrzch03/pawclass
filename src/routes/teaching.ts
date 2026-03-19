/**
 * Teaching outline generation route.
 *
 * Uses the student's mistake data + LLM to produce a personalized
 * teaching outline that can be fed into the stage session system.
 */

import { Hono } from "hono";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { MistakeRepo } from "../repo/mistake-repo.js";
import type { AuthVariables } from "../auth/types.js";
import {
  buildOutlinePrompt,
  type MistakeForOutline,
} from "../llm/outline-prompt.js";
import type { TeachingOutline } from "../stage/types.js";

export interface TeachingDeps {
  mistakeRepo: MistakeRepo;
}

export function createTeachingRoutes(deps: TeachingDeps) {
  const app = new Hono<{ Variables: AuthVariables }>();

  // POST /outline — generate a personalized teaching outline
  app.post("/outline", async (c) => {
    const userId = c.get("userId");

    const body = await c.req.json<{
      request: string;
      subject?: string;
      topic?: string;
      depth?: "quick" | "standard" | "deep";
    }>();

    if (!body.request) {
      return c.json({ error: "request field is required" }, 400);
    }

    const depth = body.depth ?? "standard";

    // Collect student context from existing mistake data
    const [rawMistakes, stats] = await Promise.all([
      deps.mistakeRepo.list(userId, {
        subject: body.subject,
        topic: body.topic,
        mastered: false,
      }),
      deps.mistakeRepo.stats(userId, body.subject),
    ]);

    // Map DB mistakes to outline prompt format
    const mistakes: MistakeForOutline[] = rawMistakes.map((m) => ({
      id: m.id,
      question: m.problemText,
      studentAnswer: m.wrongAnswer ?? "",
      correctAnswer: m.correctAnswer ?? "",
      explanation: m.explanation ?? undefined,
      topic: m.topic ?? undefined,
      subject: m.subject,
    }));

    // Build prompt
    const { system, user } = buildOutlinePrompt({
      request: body.request,
      subject: body.subject,
      topic: body.topic,
      depth,
      mistakes,
      stats: {
        totalMistakes: stats.total,
        masteredCount: stats.mastered,
        unmasteredCount: stats.unmastered,
        weakTopics: stats.weakTopics.map((t) => t.topic),
      },
    });

    // Call LLM
    const openai = createOpenAI({
      apiKey: process.env.PAWCLASS_AI_API_KEY || process.env.OPENAI_API_KEY,
      baseURL: process.env.PAWCLASS_AI_BASE_URL,
    });
    const model = process.env.PAWCLASS_AI_MODEL || "gpt-4o";

    const result = await generateText({
      model: openai(model),
      system,
      prompt: user,
      temperature: 0.7,
    });

    // Parse LLM output
    let outline: TeachingOutline;
    try {
      outline = JSON.parse(result.text);
    } catch {
      return c.json({ error: "LLM returned invalid JSON", raw: result.text }, 500);
    }

    // Validate relatedMistakeIds — filter out non-existent IDs
    const validIds = new Set(mistakes.map((m) => m.id));
    for (const step of outline.steps) {
      step.relatedMistakeIds = step.relatedMistakeIds.filter((id) => validIds.has(id));
      if (step.practiceConfig?.basedOnMistakeIds) {
        step.practiceConfig.basedOnMistakeIds = step.practiceConfig.basedOnMistakeIds.filter(
          (id) => validIds.has(id),
        );
      }
    }

    return c.json(outline);
  });

  return app;
}
