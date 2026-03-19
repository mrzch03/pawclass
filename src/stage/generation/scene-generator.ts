/**
 * Scene content and action generation.
 *
 * Adapted from OpenMAIC (https://github.com/openmaic/openmaic)
 * Original license: AGPL-3.0
 *
 * Generates full scenes (slide/quiz/interactive with actions)
 * from scene outlines using an AI call function.
 *
 * Adapted from OpenMAIC's scene-generator — self-contained, no
 * cross-project imports.
 */

import { nanoid } from 'nanoid';
import { jsonrepair } from 'jsonrepair';
import { parse as parsePartialJson, Allow } from 'partial-json';
import type { PPTElement, SlideBackground } from './types/slides';
import type { Action, ActionType } from './types/action';

// ==================== Simplified AICallFn ====================

export type AICallFn = (system: string, user: string) => Promise<string>;

// ==================== Inline Types ====================

/** Scene outline describing a single page to generate */
export interface SceneOutline {
  id: string;
  type: 'slide' | 'quiz' | 'interactive';
  title: string;
  description: string;
  keyPoints: string[];
  teachingObjective?: string;
  estimatedDuration?: number;
  order: number;
  language?: 'zh-CN' | 'en-US';
  quizConfig?: {
    questionCount: number;
    difficulty: 'easy' | 'medium' | 'hard';
    questionTypes: ('single' | 'multiple' | 'text')[];
  };
  interactiveConfig?: {
    conceptName: string;
    conceptOverview: string;
    designIdea: string;
    subject?: string;
  };
}

/** Quiz question */
export interface QuizQuestion {
  id: string;
  type: 'single' | 'multiple' | 'short_answer';
  question: string;
  options?: { value: string; label: string }[];
  answer?: string[];
  analysis?: string;
  commentPrompt?: string;
  hasAnswer?: boolean;
  points?: number;
}

/** Scientific model for interactive content */
export interface ScientificModel {
  core_formulas: string[];
  mechanism: string[];
  constraints: string[];
  forbidden_errors: string[];
}

/** Generated slide content */
export interface GeneratedSlideContent {
  elements: PPTElement[];
  background?: SlideBackground;
  remark?: string;
}

/** Generated quiz content */
export interface GeneratedQuizContent {
  questions: QuizQuestion[];
}

/** Generated interactive content */
export interface GeneratedInteractiveContent {
  html: string;
  scientificModel?: ScientificModel;
}

/** AI-generated slide data (raw parse shape) */
interface GeneratedSlideData {
  elements: Array<{
    type: 'text' | 'image' | 'shape' | 'chart' | 'latex' | 'line';
    left: number;
    top: number;
    width: number;
    height: number;
    [key: string]: unknown;
  }>;
  background?: {
    type: 'solid' | 'gradient';
    color?: string;
    gradient?: {
      type: 'linear' | 'radial';
      colors: Array<{ pos: number; color: string }>;
      rotate: number;
    };
  };
  remark?: string;
}

/** Prompt builder function — provided externally or via the built-in prompt system */
export type PromptBuilder = (
  promptId: string,
  variables: Record<string, unknown>,
) => { system: string; user: string } | null;

/** Lightweight agent info for prompt formatting */
export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  persona?: string;
}

/** Cross-page context for maintaining speech coherence */
export interface SceneGenerationContext {
  pageIndex: number;
  totalPages: number;
  allTitles: string[];
  previousSpeeches: string[];
}

// ==================== Prompt Builder ====================

/**
 * Module-level prompt builder. Defaults to a no-op that returns null.
 * Call `setPromptBuilder()` to wire in the real prompt system.
 */
let _buildPrompt: PromptBuilder = () => null;

/** Prompt IDs used internally — mirror OpenMAIC constants */
const PROMPT_IDS = {
  SLIDE_CONTENT: 'slide-content',
  QUIZ_CONTENT: 'quiz-content',
  SLIDE_ACTIONS: 'slide-actions',
  QUIZ_ACTIONS: 'quiz-actions',
  INTERACTIVE_SCIENTIFIC_MODEL: 'interactive-scientific-model',
  INTERACTIVE_HTML: 'interactive-html',
  INTERACTIVE_ACTIONS: 'interactive-actions',
} as const;

/**
 * Set the prompt builder function used by the scene generator.
 * Must be called before generating content.
 */
export function setPromptBuilder(builder: PromptBuilder): void {
  _buildPrompt = builder;
}

// ==================== JSON Parsing Utilities ====================

/**
 * Parse JSON from an AI response with multiple fallback strategies.
 */
function parseJsonResponse<T>(response: string): T | null {
  // Strategy 1: Try code blocks
  const codeBlockMatches = response.matchAll(/```(?:json)?\s*([\s\S]*?)```/g);
  for (const match of codeBlockMatches) {
    const extracted = match[1].trim();
    if (extracted.startsWith('{') || extracted.startsWith('[')) {
      const result = tryParseJson<T>(extracted);
      if (result !== null) return result;
    }
  }

  // Strategy 2: Find JSON structure directly
  const jsonStartArray = response.indexOf('[');
  const jsonStartObject = response.indexOf('{');

  if (jsonStartArray !== -1 || jsonStartObject !== -1) {
    const startIndex =
      jsonStartArray === -1
        ? jsonStartObject
        : jsonStartObject === -1
          ? jsonStartArray
          : Math.min(jsonStartArray, jsonStartObject);

    let depth = 0;
    let endIndex = -1;
    let inString = false;
    let escapeNext = false;

    for (let i = startIndex; i < response.length; i++) {
      const char = response[i];
      if (escapeNext) { escapeNext = false; continue; }
      if (char === '\\' && inString) { escapeNext = true; continue; }
      if (char === '"' && !escapeNext) { inString = !inString; continue; }
      if (!inString) {
        if (char === '[' || char === '{') depth++;
        else if (char === ']' || char === '}') {
          depth--;
          if (depth === 0) { endIndex = i; break; }
        }
      }
    }

    if (endIndex !== -1) {
      const jsonStr = response.substring(startIndex, endIndex + 1);
      const result = tryParseJson<T>(jsonStr);
      if (result !== null) return result;
    }
  }

  // Strategy 3: whole response
  const result = tryParseJson<T>(response.trim());
  if (result !== null) return result;

  console.error('Failed to parse JSON from response');
  console.error('Raw response (first 500 chars):', response.substring(0, 500));
  return null;
}

function tryParseJson<T>(jsonStr: string): T | null {
  try { return JSON.parse(jsonStr) as T; } catch { /* continue */ }

  // Fix LaTeX escapes and truncation
  try {
    let fixed = jsonStr;
    fixed = fixed.replace(/"([^"]*?)"/g, (_match, content) => {
      const fixedContent = content.replace(/\\([a-zA-Z])/g, '\\\\$1');
      return `"${fixedContent}"`;
    });
    fixed = fixed.replace(/\\([^"\\\/bfnrtu\n\r])/g, (match, char) => {
      if (/[a-zA-Z]/.test(char)) return '\\\\' + char;
      return match;
    });
    const trimmed = fixed.trim();
    if (trimmed.startsWith('[') && !trimmed.endsWith(']')) {
      const lastCompleteObj = fixed.lastIndexOf('}');
      if (lastCompleteObj > 0) fixed = fixed.substring(0, lastCompleteObj + 1) + ']';
    } else if (trimmed.startsWith('{') && !trimmed.endsWith('}')) {
      const openBraces = (fixed.match(/{/g) || []).length;
      const closeBraces = (fixed.match(/}/g) || []).length;
      if (openBraces > closeBraces) fixed += '}'.repeat(openBraces - closeBraces);
    }
    return JSON.parse(fixed) as T;
  } catch { /* continue */ }

  // jsonrepair
  try { return JSON.parse(jsonrepair(jsonStr)) as T; } catch { /* continue */ }

  // Remove control characters
  try {
    let fixed = jsonStr;
    fixed = fixed.replace(/[\x00-\x1F\x7F]/g, (char) => {
      switch (char) {
        case '\n': return '\\n';
        case '\r': return '\\r';
        case '\t': return '\\t';
        default: return '';
      }
    });
    return JSON.parse(fixed) as T;
  } catch { return null; }
}

// ==================== Action Parser ====================

/** Slide-only action types that should be stripped from non-slide scenes */
const SLIDE_ONLY_ACTION_TYPES: string[] = ['spotlight', 'laser'];

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?\s*```\s*$/i, '');
}

/**
 * Parse a complete LLM response in JSON Array format into an ordered Action[] array.
 */
function parseActionsFromStructuredOutput(
  response: string,
  sceneType?: string,
): Action[] {
  const cleaned = stripCodeFences(response.trim());
  const startIdx = cleaned.indexOf('[');
  const endIdx = cleaned.lastIndexOf(']');

  if (startIdx === -1) {
    console.log('[ActionParser] No JSON array found in response');
    return [];
  }

  const jsonStr = endIdx > startIdx ? cleaned.slice(startIdx, endIdx + 1) : cleaned.slice(startIdx);

  let items: unknown[];
  try {
    items = JSON.parse(jsonStr);
  } catch {
    try {
      items = JSON.parse(jsonrepair(jsonStr));
    } catch {
      try {
        items = parsePartialJson(
          jsonStr,
          Allow.ARR | Allow.OBJ | Allow.STR | Allow.NUM | Allow.BOOL | Allow.NULL,
        );
      } catch (e) {
        console.log('[ActionParser] Failed to parse JSON array:', (e as Error).message);
        return [];
      }
    }
  }

  if (!Array.isArray(items)) return [];

  const actions: Action[] = [];

  for (const item of items) {
    if (!item || typeof item !== 'object' || !('type' in item)) continue;
    const typedItem = item as Record<string, unknown>;

    if (typedItem.type === 'text') {
      const text = ((typedItem.content as string) || '').trim();
      if (text) {
        actions.push({ id: `action_${nanoid(8)}`, type: 'speech', text } as Action);
      }
    } else if (typedItem.type === 'action') {
      try {
        const actionName = typedItem.name || typedItem.tool_name;
        const actionParams = (typedItem.params || typedItem.parameters || {}) as Record<string, unknown>;
        actions.push({
          id: (typedItem.action_id || typedItem.tool_id || `action_${nanoid(8)}`) as string,
          type: actionName as Action['type'],
          ...actionParams,
        } as Action);
      } catch {
        // skip invalid action items
      }
    }
  }

  // discussion must be last, at most one
  const discussionIdx = actions.findIndex((a) => a.type === ('discussion' as ActionType));
  if (discussionIdx !== -1 && discussionIdx < actions.length - 1) {
    actions.splice(discussionIdx + 1);
  }

  // strip slide-only actions for non-slide scenes
  if (sceneType && sceneType !== 'slide') {
    return actions.filter((a) => !SLIDE_ONLY_ACTION_TYPES.includes(a.type));
  }

  return actions;
}

// ==================== Interactive HTML Post-Processor ====================

function postProcessInteractiveHtml(html: string): string {
  let processed = convertLatexDelimiters(html);
  if (!processed.toLowerCase().includes('katex')) {
    processed = injectKatex(processed);
  }
  return processed;
}

function convertLatexDelimiters(html: string): string {
  const scriptBlocks: string[] = [];
  let processed = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, (match) => {
    scriptBlocks.push(match);
    return `__SCRIPT_BLOCK_${scriptBlocks.length - 1}__`;
  });
  processed = processed.replace(/\$\$([^$]+)\$\$/g, '\\[$1\\]');
  processed = processed.replace(/\$([^$\n]+?)\$/g, '\\($1\\)');
  for (let i = 0; i < scriptBlocks.length; i++) {
    const placeholder = `__SCRIPT_BLOCK_${i}__`;
    const idx = processed.indexOf(placeholder);
    if (idx !== -1) {
      processed =
        processed.substring(0, idx) +
        scriptBlocks[i] +
        processed.substring(idx + placeholder.length);
    }
  }
  return processed;
}

function injectKatex(html: string): string {
  const katexInjection = `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js"></script>
<script>
document.addEventListener("DOMContentLoaded", function() {
    const katexOptions = {
        delimiters: [
            {left: '\\\\[', right: '\\\\]', display: true},
            {left: '\\\\(', right: '\\\\)', display: false},
            {left: '$$', right: '$$', display: true},
            {left: '$', right: '$', display: false}
        ],
        throwOnError: false,
        strict: false,
        trust: true
    };

    let renderTimeout;
    function safeRender() {
        if (renderTimeout) clearTimeout(renderTimeout);
        renderTimeout = setTimeout(() => {
            renderMathInElement(document.body, katexOptions);
        }, 100);
    }

    renderMathInElement(document.body, katexOptions);

    const observer = new MutationObserver((mutations) => {
        let shouldRender = false;
        mutations.forEach((mutation) => {
            if (mutation.target &&
                mutation.target.className &&
                typeof mutation.target.className === 'string' &&
                mutation.target.className.includes('katex')) {
                return;
            }
            shouldRender = true;
        });

        if (shouldRender) {
            safeRender();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
    });

    setInterval(() => {
        const text = document.body.innerText;
        if (text.includes('\\\\(') || text.includes('$$')) {
            safeRender();
        }
    }, 2000);
});
</script>`;

  const headCloseIdx = html.indexOf('</head>');
  if (headCloseIdx !== -1) {
    return (
      html.substring(0, headCloseIdx) +
      katexInjection +
      '\n</head>' +
      html.substring(headCloseIdx + 7)
    );
  }

  const bodyCloseIdx = html.indexOf('</body>');
  if (bodyCloseIdx !== -1) {
    return (
      html.substring(0, bodyCloseIdx) +
      katexInjection +
      '\n</body>' +
      html.substring(bodyCloseIdx + 7)
    );
  }

  return html + katexInjection;
}

// ==================== Prompt Formatting Utilities ====================

function buildCourseContext(ctx?: SceneGenerationContext): string {
  if (!ctx) return '';

  const lines: string[] = [];
  lines.push('Course Outline:');
  ctx.allTitles.forEach((t, i) => {
    const marker = i === ctx.pageIndex - 1 ? ' <- current' : '';
    lines.push(`  ${i + 1}. ${t}${marker}`);
  });

  lines.push('');
  lines.push(
    'IMPORTANT: All pages belong to the SAME class session. Do NOT greet again after the first page.',
  );
  lines.push('');

  if (ctx.pageIndex === 1) {
    lines.push('Position: This is the FIRST page. Open with a greeting and course introduction.');
  } else if (ctx.pageIndex === ctx.totalPages) {
    lines.push('Position: This is the LAST page. Conclude the course with a summary and closing.');
    lines.push('Transition: Continue naturally from the previous page. Do NOT greet or re-introduce.');
  } else {
    lines.push(`Position: Page ${ctx.pageIndex} of ${ctx.totalPages} (middle of the course).`);
    lines.push('Transition: Continue naturally from the previous page. Do NOT greet or re-introduce.');
  }

  if (ctx.previousSpeeches.length > 0) {
    lines.push('');
    lines.push('Previous page speech (for transition reference):');
    const lastSpeech = ctx.previousSpeeches[ctx.previousSpeeches.length - 1];
    lines.push(`  "...${lastSpeech.slice(-150)}"`);
  }

  return lines.join('\n');
}

function formatAgentsForPrompt(agents?: AgentInfo[]): string {
  if (!agents || agents.length === 0) return '';
  const lines = ['Classroom Agents:'];
  for (const a of agents) {
    const personaPart = a.persona ? ` -- ${a.persona}` : '';
    lines.push(`- id: "${a.id}", name: "${a.name}", role: ${a.role}${personaPart}`);
  }
  return lines.join('\n');
}

function formatTeacherPersonaForPrompt(agents?: AgentInfo[]): string {
  if (!agents || agents.length === 0) return '';
  const teacher = agents.find((a) => a.role === 'teacher');
  if (!teacher?.persona) return '';
  return `Teacher Persona:\nName: ${teacher.name}\n${teacher.persona}\n\nPlease adapt the content style and tone to match this teacher's personality and teaching approach.`;
}

// ==================== Element Processing ====================

/**
 * Fix elements with missing required fields.
 * Adds default values for fields that AI might not have generated correctly.
 */
function fixElementDefaults(
  elements: GeneratedSlideData['elements'],
): GeneratedSlideData['elements'] {
  return elements.map((el) => {
    if (el.type === 'line') {
      const lineEl = el as Record<string, unknown>;
      if (!lineEl.points || !Array.isArray(lineEl.points) || lineEl.points.length !== 2) {
        lineEl.points = ['', ''] as [string, string];
      }
      if (!lineEl.start || !Array.isArray(lineEl.start)) {
        lineEl.start = [el.left ?? 0, el.top ?? 0];
      }
      if (!lineEl.end || !Array.isArray(lineEl.end)) {
        lineEl.end = [(el.left ?? 0) + (el.width ?? 100), (el.top ?? 0) + (el.height ?? 0)];
      }
      if (!lineEl.style) lineEl.style = 'solid';
      if (!lineEl.color) lineEl.color = '#333333';
      return lineEl as typeof el;
    }

    if (el.type === 'text') {
      const textEl = el as Record<string, unknown>;
      if (!textEl.defaultFontName) textEl.defaultFontName = 'Microsoft YaHei';
      if (!textEl.defaultColor) textEl.defaultColor = '#333333';
      if (!textEl.content) textEl.content = '';
      return textEl as typeof el;
    }

    if (el.type === 'image') {
      const imageEl = el as Record<string, unknown>;
      if (imageEl.fixedRatio === undefined) imageEl.fixedRatio = true;
      return imageEl as typeof el;
    }

    if (el.type === 'shape') {
      const shapeEl = el as Record<string, unknown>;
      if (!shapeEl.viewBox) shapeEl.viewBox = `0 0 ${el.width ?? 100} ${el.height ?? 100}`;
      if (!shapeEl.path) {
        const w = el.width ?? 100;
        const h = el.height ?? 100;
        shapeEl.path = `M0 0 L${w} 0 L${w} ${h} L0 ${h} Z`;
      }
      if (!shapeEl.fill) shapeEl.fill = '#5b9bd5';
      if (shapeEl.fixedRatio === undefined) shapeEl.fixedRatio = false;
      return shapeEl as typeof el;
    }

    return el;
  });
}

// ==================== Content Generators ====================

/**
 * Step 1: Generate content based on outline.
 *
 * Returns slide, quiz, or interactive content depending on the outline type.
 */
export async function generateSceneContent(
  outline: SceneOutline,
  aiCall: AICallFn,
  agents?: AgentInfo[],
): Promise<GeneratedSlideContent | GeneratedQuizContent | GeneratedInteractiveContent | null> {
  // Interactive without config falls back to slide
  if (outline.type === 'interactive' && !outline.interactiveConfig) {
    console.log(
      `Interactive outline "${outline.title}" missing interactiveConfig, falling back to slide`,
    );
    const fallbackOutline = { ...outline, type: 'slide' as const };
    return generateSlideContent(fallbackOutline, aiCall, agents);
  }

  switch (outline.type) {
    case 'slide':
      return generateSlideContent(outline, aiCall, agents);
    case 'quiz':
      return generateQuizContent(outline, aiCall);
    case 'interactive':
      return generateInteractiveContent(outline, aiCall, outline.language);
    default:
      return null;
  }
}

/**
 * Generate slide content.
 */
async function generateSlideContent(
  outline: SceneOutline,
  aiCall: AICallFn,
  agents?: AgentInfo[],
): Promise<GeneratedSlideContent | null> {
  const canvasWidth = 1000;
  const canvasHeight = 562.5;

  const teacherContext = formatTeacherPersonaForPrompt(agents);

  const prompts = _buildPrompt(PROMPT_IDS.SLIDE_CONTENT, {
    title: outline.title,
    description: outline.description,
    keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
    elements: '(auto-generated from key points)',
    assignedImages: 'No images available, do not insert any image elements',
    canvas_width: canvasWidth,
    canvas_height: canvasHeight,
    teacherContext,
  });

  if (!prompts) {
    console.error(`Failed to build slide prompt for: ${outline.title}`);
    return null;
  }

  console.log(`Generating slide content for: ${outline.title}`);
  const response = await aiCall(prompts.system, prompts.user);
  const generatedData = parseJsonResponse<GeneratedSlideData>(response);

  if (!generatedData || !generatedData.elements || !Array.isArray(generatedData.elements)) {
    console.error(`Failed to parse AI response for: ${outline.title}`);
    return null;
  }

  console.log(`Got ${generatedData.elements.length} elements for: ${outline.title}`);

  // Fix elements with missing required fields
  const fixedElements = fixElementDefaults(generatedData.elements);

  // Process elements, assign unique IDs
  const processedElements: PPTElement[] = fixedElements.map((el) => ({
    ...el,
    id: `${el.type}_${nanoid(8)}`,
    rotate: 0,
  })) as PPTElement[];

  // Process background
  let background: SlideBackground | undefined;
  if (generatedData.background) {
    if (generatedData.background.type === 'solid' && generatedData.background.color) {
      background = { type: 'solid', color: generatedData.background.color };
    } else if (generatedData.background.type === 'gradient' && generatedData.background.gradient) {
      background = {
        type: 'gradient',
        gradient: generatedData.background.gradient,
      };
    }
  }

  return {
    elements: processedElements,
    background,
    remark: generatedData.remark || outline.description,
  };
}

/**
 * Generate quiz content.
 */
async function generateQuizContent(
  outline: SceneOutline,
  aiCall: AICallFn,
): Promise<GeneratedQuizContent | null> {
  const quizConfig = outline.quizConfig || {
    questionCount: 3,
    difficulty: 'medium',
    questionTypes: ['single'],
  };

  const prompts = _buildPrompt(PROMPT_IDS.QUIZ_CONTENT, {
    title: outline.title,
    description: outline.description,
    keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
    questionCount: quizConfig.questionCount,
    difficulty: quizConfig.difficulty,
    questionTypes: quizConfig.questionTypes.join(', '),
  });

  if (!prompts) {
    console.error(`Failed to build quiz prompt for: ${outline.title}`);
    return null;
  }

  console.log(`Generating quiz content for: ${outline.title}`);
  const response = await aiCall(prompts.system, prompts.user);
  const generatedQuestions = parseJsonResponse<QuizQuestion[]>(response);

  if (!generatedQuestions || !Array.isArray(generatedQuestions)) {
    console.error(`Failed to parse AI response for: ${outline.title}`);
    return null;
  }

  console.log(`Got ${generatedQuestions.length} questions for: ${outline.title}`);

  const questions: QuizQuestion[] = generatedQuestions.map((q) => {
    const isText = q.type === 'short_answer';
    return {
      ...q,
      id: q.id || `q_${nanoid(8)}`,
      options: isText ? undefined : normalizeQuizOptions(q.options),
      answer: isText ? undefined : normalizeQuizAnswer(q as unknown as Record<string, unknown>),
      hasAnswer: isText ? false : true,
    };
  });

  return { questions };
}

function normalizeQuizOptions(
  options: unknown[] | undefined,
): { value: string; label: string }[] | undefined {
  if (!options || !Array.isArray(options)) return undefined;

  return options.map((opt, index) => {
    const letter = String.fromCharCode(65 + index);
    if (typeof opt === 'string') return { value: letter, label: opt };
    if (typeof opt === 'object' && opt !== null) {
      const obj = opt as Record<string, unknown>;
      return {
        value: typeof obj.value === 'string' ? obj.value : letter,
        label: typeof obj.label === 'string' ? obj.label : String(obj.value || obj.text || letter),
      };
    }
    return { value: letter, label: String(opt) };
  });
}

function normalizeQuizAnswer(question: Record<string, unknown>): string[] | undefined {
  const raw = question.answer ?? question.correctAnswer ?? question.correct_answer;
  if (!raw) return undefined;
  if (Array.isArray(raw)) return raw.map(String);
  return [String(raw)];
}

/**
 * Generate interactive page content.
 *
 * Two AI calls + post-processing:
 * 1. Scientific modeling -> ScientificModel (with fallback)
 * 2. HTML generation with constraints -> post-processed HTML
 */
async function generateInteractiveContent(
  outline: SceneOutline,
  aiCall: AICallFn,
  language: 'zh-CN' | 'en-US' = 'zh-CN',
): Promise<GeneratedInteractiveContent | null> {
  const config = outline.interactiveConfig!;

  // Step 1: Scientific modeling (with fallback on failure)
  let scientificModel: ScientificModel | undefined;
  try {
    const modelPrompts = _buildPrompt(PROMPT_IDS.INTERACTIVE_SCIENTIFIC_MODEL, {
      subject: config.subject || '',
      conceptName: config.conceptName,
      conceptOverview: config.conceptOverview,
      keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
      designIdea: config.designIdea,
    });

    if (modelPrompts) {
      console.log(`Step 1: Scientific modeling for: ${outline.title}`);
      const modelResponse = await aiCall(modelPrompts.system, modelPrompts.user);
      const parsed = parseJsonResponse<ScientificModel>(modelResponse);
      if (parsed && parsed.core_formulas) {
        scientificModel = parsed;
        console.log(
          `Scientific model: ${parsed.core_formulas.length} formulas, ${parsed.constraints?.length || 0} constraints`,
        );
      }
    }
  } catch (error) {
    console.log(`Scientific modeling failed, continuing without: ${error}`);
  }

  // Format scientific constraints for HTML generation prompt
  let scientificConstraints = 'No specific scientific constraints available.';
  if (scientificModel) {
    const lines: string[] = [];
    if (scientificModel.core_formulas?.length) {
      lines.push(`Core Formulas: ${scientificModel.core_formulas.join('; ')}`);
    }
    if (scientificModel.mechanism?.length) {
      lines.push(`Mechanisms: ${scientificModel.mechanism.join('; ')}`);
    }
    if (scientificModel.constraints?.length) {
      lines.push(`Must Obey: ${scientificModel.constraints.join('; ')}`);
    }
    if (scientificModel.forbidden_errors?.length) {
      lines.push(`Forbidden Errors: ${scientificModel.forbidden_errors.join('; ')}`);
    }
    scientificConstraints = lines.join('\n');
  }

  // Step 2: HTML generation
  const htmlPrompts = _buildPrompt(PROMPT_IDS.INTERACTIVE_HTML, {
    conceptName: config.conceptName,
    subject: config.subject || '',
    conceptOverview: config.conceptOverview,
    keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
    scientificConstraints,
    designIdea: config.designIdea,
    language,
  });

  if (!htmlPrompts) {
    console.error(`Failed to build HTML prompt for: ${outline.title}`);
    return null;
  }

  console.log(`Step 2: Generating HTML for: ${outline.title}`);
  const htmlResponse = await aiCall(htmlPrompts.system, htmlPrompts.user);
  const rawHtml = extractHtml(htmlResponse);
  if (!rawHtml) {
    console.error(`Failed to extract HTML from response for: ${outline.title}`);
    return null;
  }

  // Step 3: Post-process HTML
  const processedHtml = postProcessInteractiveHtml(rawHtml);
  console.log(`Post-processed HTML (${processedHtml.length} chars) for: ${outline.title}`);

  return { html: processedHtml, scientificModel };
}

/**
 * Extract HTML document from AI response.
 */
function extractHtml(response: string): string | null {
  // Strategy 1: Find complete HTML document
  const doctypeStart = response.indexOf('<!DOCTYPE html>');
  const htmlTagStart = response.indexOf('<html');
  const start = doctypeStart !== -1 ? doctypeStart : htmlTagStart;

  if (start !== -1) {
    const htmlEnd = response.lastIndexOf('</html>');
    if (htmlEnd !== -1) return response.substring(start, htmlEnd + 7);
  }

  // Strategy 2: Extract from code block
  const codeBlockMatch = response.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    const content = codeBlockMatch[1].trim();
    if (content.includes('<html') || content.includes('<!DOCTYPE')) return content;
  }

  // Strategy 3: response itself looks like HTML
  const trimmed = response.trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) return trimmed;

  console.error('Could not extract HTML from response');
  return null;
}

// ==================== Action Generators ====================

/**
 * Step 2: Generate actions based on content and outline.
 */
export async function generateSceneActions(
  outline: SceneOutline,
  content: GeneratedSlideContent | GeneratedQuizContent | GeneratedInteractiveContent,
  aiCall: AICallFn,
  ctx?: SceneGenerationContext,
  agents?: AgentInfo[],
): Promise<Action[]> {
  const agentsText = formatAgentsForPrompt(agents);

  if (outline.type === 'slide' && 'elements' in content) {
    const elementsText = formatElementsForPrompt(content.elements);
    const prompts = _buildPrompt(PROMPT_IDS.SLIDE_ACTIONS, {
      title: outline.title,
      keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
      description: outline.description,
      elements: elementsText,
      courseContext: buildCourseContext(ctx),
      agents: agentsText,
      userProfile: '',
    });

    if (!prompts) return generateDefaultSlideActions(outline, content.elements);

    const response = await aiCall(prompts.system, prompts.user);
    const actions = parseActionsFromStructuredOutput(response, outline.type);
    if (actions.length > 0) return processActions(actions, content.elements, agents);
    return generateDefaultSlideActions(outline, content.elements);
  }

  if (outline.type === 'quiz' && 'questions' in content) {
    const questionsText = formatQuestionsForPrompt(content.questions);
    const prompts = _buildPrompt(PROMPT_IDS.QUIZ_ACTIONS, {
      title: outline.title,
      keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
      description: outline.description,
      questions: questionsText,
      courseContext: buildCourseContext(ctx),
      agents: agentsText,
    });

    if (!prompts) return generateDefaultQuizActions(outline);

    const response = await aiCall(prompts.system, prompts.user);
    const actions = parseActionsFromStructuredOutput(response, outline.type);
    if (actions.length > 0) return processActions(actions, [], agents);
    return generateDefaultQuizActions(outline);
  }

  if (outline.type === 'interactive' && 'html' in content) {
    const config = outline.interactiveConfig;
    const prompts = _buildPrompt(PROMPT_IDS.INTERACTIVE_ACTIONS, {
      title: outline.title,
      keyPoints: (outline.keyPoints || []).map((p, i) => `${i + 1}. ${p}`).join('\n'),
      description: outline.description,
      conceptName: config?.conceptName || outline.title,
      designIdea: config?.designIdea || '',
      courseContext: buildCourseContext(ctx),
      agents: agentsText,
    });

    if (!prompts) return generateDefaultInteractiveActions(outline);

    const response = await aiCall(prompts.system, prompts.user);
    const actions = parseActionsFromStructuredOutput(response, outline.type);
    if (actions.length > 0) return processActions(actions, [], agents);
    return generateDefaultInteractiveActions(outline);
  }

  return [];
}

// ==================== Formatting Helpers ====================

function formatElementsForPrompt(elements: PPTElement[]): string {
  return elements
    .map((el) => {
      let summary = '';
      if (el.type === 'text' && 'content' in el) {
        const textContent = ((el.content as string) || '').replace(/<[^>]*>/g, '').substring(0, 50);
        summary = `Content summary: "${textContent}${textContent.length >= 50 ? '...' : ''}"`;
      } else if (el.type === 'chart' && 'chartType' in el) {
        summary = `Chart type: ${el.chartType}`;
      } else if (el.type === 'image') {
        summary = 'Image element';
      } else if (el.type === 'shape' && 'shapeName' in el) {
        summary = `Shape: ${(el as Record<string, unknown>).shapeName || 'unknown'}`;
      } else if (el.type === 'latex' && 'latex' in el) {
        summary = `Formula: ${((el.latex as string) || '').substring(0, 30)}`;
      } else {
        summary = `${el.type} element`;
      }
      return `- id: "${el.id}", type: "${el.type}", ${summary}`;
    })
    .join('\n');
}

function formatQuestionsForPrompt(questions: QuizQuestion[]): string {
  return questions
    .map((q, i) => {
      const optionsText = q.options ? `Options: ${q.options.map((o) => o.label).join(', ')}` : '';
      return `Q${i + 1} (${q.type}): ${q.question}\n${optionsText}`;
    })
    .join('\n\n');
}

// ==================== Action Processing ====================

function processActions(actions: Action[], elements: PPTElement[], _agents?: AgentInfo[]): Action[] {
  const elementIds = new Set(elements.map((el) => el.id));

  return actions.map((action) => {
    const processedAction: Action = {
      ...action,
      id: action.id || `action_${nanoid(8)}`,
    };

    // Validate spotlight elementId
    if (processedAction.type === 'spotlight') {
      if (!processedAction.elementId || !elementIds.has(processedAction.elementId)) {
        if (elements.length > 0) {
          processedAction.elementId = elements[0].id;
        }
      }
    }

    return processedAction;
  });
}

// ==================== Default Action Generators (Fallback) ====================

function generateDefaultSlideActions(outline: SceneOutline, elements: PPTElement[]): Action[] {
  const actions: Action[] = [];

  const textElements = elements.filter((el) => el.type === 'text');
  if (textElements.length > 0) {
    actions.push({
      id: `action_${nanoid(8)}`,
      type: 'spotlight',
      elementId: textElements[0].id,
    } as Action);
  }

  const speechText = outline.keyPoints?.length
    ? outline.keyPoints.join('. ') + '.'
    : outline.description || outline.title;
  actions.push({
    id: `action_${nanoid(8)}`,
    type: 'speech',
    text: speechText,
  } as Action);

  return actions;
}

function generateDefaultQuizActions(_outline: SceneOutline): Action[] {
  return [
    {
      id: `action_${nanoid(8)}`,
      type: 'speech',
      text: 'Now let us take a short quiz to check what we have learned.',
    } as Action,
  ];
}

function generateDefaultInteractiveActions(_outline: SceneOutline): Action[] {
  return [
    {
      id: `action_${nanoid(8)}`,
      type: 'speech',
      text: 'Now let us explore this concept through an interactive visualization. Try manipulating the elements on the page and observe how they change.',
    } as Action,
  ];
}
