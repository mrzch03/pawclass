/**
 * Teaching outline LLM prompt construction.
 *
 * Produces a system + user prompt pair that instructs an LLM to generate
 * a structured teaching outline JSON based on student context.
 */

export interface MistakeForOutline {
  id: string;
  question: string;
  studentAnswer: string;
  correctAnswer: string;
  explanation?: string;
  topic?: string;
  subject?: string;
  reviewCount?: number;
  lastReviewCorrect?: boolean;
}

export interface StudentStats {
  totalMistakes: number;
  masteredCount: number;
  unmasteredCount: number;
  weakTopics: string[];
}

export interface OutlinePromptInput {
  request: string;
  subject?: string;
  topic?: string;
  depth: "quick" | "standard" | "deep";
  mistakes: MistakeForOutline[];
  stats?: StudentStats;
}

const SYSTEM_PROMPT = `You are an expert educational content designer. Your task is to create a personalized teaching outline based on the student's request and their learning data.

## Teaching Modes

Choose ONE mode based on context:
- **mistake_focused**: Student has relevant unmastered mistakes. Focus on error correction and reinforcement.
- **knowledge_first**: Student wants to learn a topic but has no related mistakes. Teach from scratch.
- **mixed**: Student has some related mistakes but also needs broader knowledge. Interleave teaching with error review.

## Step Types

Each step in the outline must be one of:
- **concept**: Knowledge point explanation. Use whiteboard to draw diagrams, write formulas, show derivations.
- **example**: Worked example demonstration. Step-by-step problem solving on whiteboard.
- **mistake_review**: Review a specific mistake. Show original question and student's wrong answer, then correct solution. MUST have relatedMistakeIds.
- **practice**: Quiz/exercise. MUST have practiceConfig with question details.
- **interactive**: HTML interactive experiment (physics simulations, function graphing, etc.).
- **summary**: Recap key points and learning suggestions.

## Design Principles

1. Progressive: Start simple, build complexity
2. Practice-integrated: Alternate teaching and exercises
3. Personalized: Reference student's actual mistakes when available
4. Time-controlled: Respect the depth setting:
   - quick: 5-8 minutes, 3-5 steps
   - standard: 10-15 minutes, 5-8 steps
   - deep: 20-30 minutes, 8-12 steps

## Constraints

- relatedMistakeIds MUST only reference IDs from the provided mistake list. Never invent IDs.
- If no mistakes are provided, do NOT generate mistake_review steps.
- practiceConfig.basedOnMistakeIds must also be real IDs.
- interactionHint describes HOW to present (whiteboard drawing, slide with bullet points, etc.)

## Output Format

Return a single JSON object (no markdown fences):
{
  "title": "string",
  "estimatedMinutes": number,
  "teachingMode": "mistake_focused" | "knowledge_first" | "mixed",
  "briefing": "string — one sentence summary for the student",
  "steps": [
    {
      "order": number,
      "type": "concept" | "example" | "mistake_review" | "practice" | "interactive" | "summary",
      "title": "string",
      "description": "string",
      "keyPoints": ["string"],
      "estimatedSeconds": number,
      "relatedMistakeIds": ["string"] | [],
      "interactionHint": "string",
      "practiceConfig": {
        "questionCount": number,
        "difficulty": "easy" | "medium" | "hard",
        "basedOnMistakeIds": ["string"] | [],
        "questionTypes": ["single" | "multiple" | "short_answer"]
      } | null
    }
  ]
}`;

export function buildOutlinePrompt(input: OutlinePromptInput): {
  system: string;
  user: string;
} {
  const mistakeSection =
    input.mistakes.length > 0
      ? input.mistakes
          .map(
            (m, i) =>
              `Mistake ${i + 1} (ID: ${m.id}):\n` +
              `  Question: ${m.question}\n` +
              `  Student's answer: ${m.studentAnswer}\n` +
              `  Correct answer: ${m.correctAnswer}\n` +
              (m.explanation ? `  Explanation: ${m.explanation}\n` : "") +
              (m.topic ? `  Topic: ${m.topic}\n` : "") +
              (m.reviewCount != null ? `  Review count: ${m.reviewCount}\n` : "") +
              (m.lastReviewCorrect != null
                ? `  Last review correct: ${m.lastReviewCorrect}\n`
                : ""),
          )
          .join("\n")
      : "No mistakes available for this student/topic.";

  const statsSection = input.stats
    ? `Student Statistics:\n` +
      `  Total mistakes: ${input.stats.totalMistakes}\n` +
      `  Mastered: ${input.stats.masteredCount}\n` +
      `  Unmastered: ${input.stats.unmasteredCount}\n` +
      `  Weak topics: ${input.stats.weakTopics.join(", ") || "none"}`
    : "No statistics available.";

  const user = [
    `Student's request: "${input.request}"`,
    input.subject ? `Subject: ${input.subject}` : null,
    input.topic ? `Topic: ${input.topic}` : null,
    `Depth: ${input.depth}`,
    "",
    "--- Student's Mistake Data ---",
    mistakeSection,
    "",
    "--- " + statsSection + " ---",
  ]
    .filter((line) => line !== null)
    .join("\n");

  return { system: SYSTEM_PROMPT, user };
}
