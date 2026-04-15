#!/usr/bin/env node

/**
 * PawClass CLI — Agent 内容创作工具
 *
 * 原子命令逐步构建课程，支持渐进式加载。
 *
 * 用法:
 *   pawclass course <command>     课程管理
 *   pawclass slide add <id>       添加幻灯片
 *   pawclass code add <id>        添加代码块
 *   pawclass quiz add <id>        添加测验
 *   pawclass interactive add <id> 添加互动
 *   pawclass narration add <id>   添加旁白
 *   pawclass whiteboard add <id>  添加白板元素
 *   pawclass mistake <command>    错题管理
 *   pawclass stats                统计数据
 *   pawclass serve                启动 HTTP 服务
 *   pawclass migrate              数据库迁移
 */

const PAWCLASS_BASE_URL = process.env.PAWCLASS_BASE_URL || "https://pawclass.teachclaw.app";
const TOKEN = process.env.PAWCLASS_TOKEN || "";

// ---------------------------------------------------------------------------
// Arg parser
// ---------------------------------------------------------------------------

function parseArgs(args: string[]): { flags: Record<string, string>; positional: string[] } {
  const flags: Record<string, string> = {};
  const positional: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && i + 1 < args.length && !args[i + 1].startsWith("--")) {
      flags[args[i].slice(2)] = args[i + 1];
      i++;
    } else if (!args[i].startsWith("--")) {
      positional.push(args[i]);
    }
  }
  return { flags, positional };
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

function apiHeaders(body?: unknown): Record<string, string> {
  const h: Record<string, string> = {};
  if (TOKEN) h["Authorization"] = `Bearer ${TOKEN}`;
  if (body) h["Content-Type"] = "application/json";
  return h;
}

async function api(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${PAWCLASS_BASE_URL}${path}`, {
    method,
    headers: apiHeaders(body),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(typeof data === "object" && data && "error" in data ? (data as any).error : `HTTP ${res.status}`);
  }
  return data;
}

/** stdout: JSON for Agent consumption */
function out(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

/** stderr: human-readable status */
function info(msg: string): void {
  process.stderr.write(`[pawclass] ${msg}\n`);
}

// ---------------------------------------------------------------------------
// Course commands
// ---------------------------------------------------------------------------

async function handleCourse(action: string, rest: string[]) {
  const { flags, positional } = parseArgs(rest);

  switch (action) {
    case "create": {
      const title = flags.title;
      if (!title) { console.error("用法: pawclass course create --title <标题>"); process.exit(1); }
      const data = await api("POST", "/api/course", { title });
      info("课程已创建");
      out(data);
      break;
    }
    case "status": {
      const id = positional[0];
      if (!id) { console.error("用法: pawclass course status <id>"); process.exit(1); }
      out(await api("GET", `/api/course/${id}`));
      break;
    }
    case "finalize": {
      const id = positional[0];
      if (!id) { console.error("用法: pawclass course finalize <id>"); process.exit(1); }
      const data = await api("POST", `/api/course/${id}/finalize`);
      info("课程已定稿");
      out(data);
      break;
    }
    case "play": {
      const id = positional[0];
      if (!id) { console.error("用法: pawclass course play <id>"); process.exit(1); }
      // Auto-finalize if still in draft
      const courseInfo = await api("GET", `/api/course/${id}`) as any;
      if (courseInfo.status === "draft") {
        info("课程尚未定稿，自动定稿中...");
        const finResult = await api("POST", `/api/course/${id}/finalize`) as any;
        info(`定稿完成，生成 ${finResult.ttsGenerated || 0} 个语音文件`);
      }
      const data = await api("POST", `/api/course/${id}/play`);
      info("开始播放");
      out(data);
      break;
    }
    case "pause": {
      const id = positional[0];
      if (!id) { console.error("用法: pawclass course pause <id>"); process.exit(1); }
      const data = await api("POST", `/api/course/${id}/pause`);
      info("已暂停");
      out(data);
      break;
    }
    case "resume": {
      const id = positional[0];
      if (!id) { console.error("用法: pawclass course resume <id>"); process.exit(1); }
      const data = await api("POST", `/api/course/${id}/resume`);
      info("已继续");
      out(data);
      break;
    }
    case "stop": {
      const id = positional[0];
      if (!id) { console.error("用法: pawclass course stop <id>"); process.exit(1); }
      const data = await api("POST", `/api/course/${id}/stop`);
      info("已结束");
      out(data);
      break;
    }
    case "results": {
      const id = positional[0];
      if (!id) { console.error("用法: pawclass course results <id>"); process.exit(1); }
      out(await api("GET", `/api/course/${id}/results`));
      break;
    }
    default:
      console.error(`未知 course 子命令: ${action}`);
      process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Content addition commands (slide, code, quiz, interactive, narration, whiteboard)
// ---------------------------------------------------------------------------

async function handleSlide(action: string, rest: string[]) {
  if (action !== "add") { console.error("用法: pawclass slide add <courseId> --title <标题> --content <markdown>"); process.exit(1); }
  const { flags, positional } = parseArgs(rest);
  const courseId = positional[0];
  if (!courseId || !flags.title || !flags.content) {
    console.error("用法: pawclass slide add <courseId> --title <标题> --content <markdown>");
    process.exit(1);
  }
  const data = await api("POST", `/api/course/${courseId}/slide`, { title: flags.title, content: flags.content });
  info("幻灯片已添加");
  out(data);
}

async function handleCode(action: string, rest: string[]) {
  if (action !== "add") { console.error("用法: pawclass code add <courseId> --language <lang> --content <code>"); process.exit(1); }
  const { flags, positional } = parseArgs(rest);
  const courseId = positional[0];
  if (!courseId || !flags.language || !flags.content) {
    console.error("用法: pawclass code add <courseId> --language <lang> --content <code>");
    process.exit(1);
  }
  const data = await api("POST", `/api/course/${courseId}/code`, {
    language: flags.language,
    content: flags.content,
    title: flags.title,
  });
  info("代码块已添加");
  out(data);
}

async function handleQuiz(action: string, rest: string[]) {
  if (action !== "add") { console.error("用法: pawclass quiz add <courseId> --question <问题> --options <A,B,C> --answer <index>"); process.exit(1); }
  const { flags, positional } = parseArgs(rest);
  const courseId = positional[0];
  if (!courseId || !flags.question || !flags.options || flags.answer == null) {
    console.error("用法: pawclass quiz add <courseId> --question <问题> --options <A,B,C> --answer <index>");
    process.exit(1);
  }
  const options = flags.options.split(",").map((s) => s.trim());
  const answer = parseInt(flags.answer, 10);
  if (isNaN(answer)) { console.error("错误: --answer 必须是数字索引"); process.exit(1); }
  const data = await api("POST", `/api/course/${courseId}/quiz`, { question: flags.question, options, answer });
  info("测验已添加");
  out(data);
}

async function handleInteractive(action: string, rest: string[]) {
  if (action !== "add") { console.error("用法: pawclass interactive add <courseId> --type <type> [--language <lang>]"); process.exit(1); }
  const { flags, positional } = parseArgs(rest);
  const courseId = positional[0];
  if (!courseId || !flags.type) {
    console.error("用法: pawclass interactive add <courseId> --type <type> [--language <lang>]");
    process.exit(1);
  }
  const data = await api("POST", `/api/course/${courseId}/interactive`, { type: flags.type, language: flags.language });
  info("互动场景已添加");
  out(data);
}

async function handleNarration(action: string, rest: string[]) {
  if (action !== "add") { console.error("用法: pawclass narration add <courseId> --text <旁白文字>"); process.exit(1); }
  const { flags, positional } = parseArgs(rest);
  const courseId = positional[0];
  if (!courseId || !flags.text) {
    console.error("用法: pawclass narration add <courseId> --text <旁白文字>");
    process.exit(1);
  }
  const data = await api("POST", `/api/course/${courseId}/narration`, { text: flags.text });
  info("旁白已添加");
  out(data);
}

async function handleWhiteboard(action: string, rest: string[]) {
  if (action !== "add") { console.error("用法: pawclass whiteboard add <courseId> --type <text|shape|latex|line> --content <内容> --x <x> --y <y>"); process.exit(1); }
  const { flags, positional } = parseArgs(rest);
  const courseId = positional[0];
  if (!courseId || !flags.type || flags.x == null || flags.y == null) {
    console.error("用法: pawclass whiteboard add <courseId> --type <text|shape|latex|line> --x <x> --y <y> [--content <内容>] [--width <w>] [--height <h>] [--color <color>]");
    process.exit(1);
  }

  const body: Record<string, unknown> = {
    type: flags.type,
    x: parseFloat(flags.x),
    y: parseFloat(flags.y),
  };
  if (flags.content) body.content = flags.content;
  if (flags.width) body.width = parseFloat(flags.width);
  if (flags.height) body.height = parseFloat(flags.height);
  if (flags.fontSize) body.fontSize = parseFloat(flags.fontSize);
  if (flags.color) body.color = flags.color;
  if (flags.shape) body.shape = flags.shape;

  const data = await api("POST", `/api/course/${courseId}/whiteboard`, body);
  info("白板元素已添加");
  out(data);
}

// ---------------------------------------------------------------------------
// Mistake commands (wrap existing /api/mistake endpoints)
// ---------------------------------------------------------------------------

async function handleMistake(action: string, rest: string[]) {
  const { flags, positional } = parseArgs(rest);

  switch (action) {
    case "add": {
      if (!flags.subject || !flags.problem) {
        console.error("用法: pawclass mistake add --subject <科目> --problem <题目> [--answer <正确答案>] [--wrong <错误答案>] [--topic <知识点>]");
        process.exit(1);
      }
      const body: Record<string, unknown> = {
        subject: flags.subject,
        problem_text: flags.problem,
      };
      if (flags.answer) body.correct_answer = flags.answer;
      if (flags.wrong) body.wrong_answer = flags.wrong;
      if (flags.topic) body.topic = flags.topic;
      if (flags.difficulty) body.difficulty = parseInt(flags.difficulty, 10);
      const data = await api("POST", "/api/mistake", body);
      info("错题已添加");
      out(data);
      break;
    }
    case "list": {
      const params = new URLSearchParams();
      if (flags.subject) params.set("subject", flags.subject);
      if (flags.topic) params.set("topic", flags.topic);
      if (flags.limit) params.set("limit", flags.limit);
      const qs = params.toString();
      out(await api("GET", `/api/mistake${qs ? `?${qs}` : ""}`));
      break;
    }
    case "master": {
      const id = positional[0];
      if (!id) { console.error("用法: pawclass mistake master <id>"); process.exit(1); }
      const data = await api("POST", `/api/mistake/${id}/master`);
      info("已标记掌握");
      out(data);
      break;
    }
    default:
      console.error(`未知 mistake 子命令: ${action}`);
      process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Help
// ---------------------------------------------------------------------------

function usage(): void {
  console.log(`pawclass — Agent 内容创作工具

课程管理:
  pawclass course create --title <标题>                                   创建课程
  pawclass course finalize <id>                                          定稿
  pawclass course status <id>                                            查询状态
  pawclass course play|pause|resume|stop <id>                            播放控制
  pawclass course results <id>                                           测验结果

内容添加:
  pawclass slide add <id> --title <标题> --content <markdown>            幻灯片
  pawclass code add <id> --language <lang> --content <代码> [--title <t>] 代码块
  pawclass quiz add <id> --question <问题> --options <A,B,C> --answer <n> 测验
  pawclass interactive add <id> --type <type> [--language <lang>]        互动场景
  pawclass narration add <id> --text <旁白文字>                           旁白
  pawclass whiteboard add <id> --type <text|shape|latex|line> --x --y    白板元素

错题管理:
  pawclass mistake add --subject <科目> --problem <题目> [--answer <答案>] 添加错题
  pawclass mistake list [--subject <科目>] [--topic <知识点>]             列出错题
  pawclass mistake master <id>                                           标记掌握
  pawclass stats                                                         统计数据

服务管理:
  pawclass serve                                                         启动服务
  pawclass migrate                                                       数据库迁移

环境变量:
  PAWCLASS_BASE_URL     服务地址 (默认 https://pawclass.teachclaw.app)
  PAWCLASS_TOKEN        OAuth access token → Authorization: Bearer header`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// --- Learning system commands ---

async function handleLearner(action: string, rest: string[]) {
  const { flags } = parseArgs(rest);
  const course = flags.course || "middle/grade7-up/english";

  switch (action) {
    case "profile":
      out(await api("GET", `/api/learner/profile?course=${course}`));
      break;
    case "mastery": {
      const concept = flags.concept ? `&concept=${flags.concept}` : "";
      out(await api("GET", `/api/learner/mastery?course=${course}${concept}`));
      break;
    }
    case "due": {
      const limit = flags.limit || "10";
      out(await api("GET", `/api/learner/due?course=${course}&limit=${limit}`));
      break;
    }
    case "stats":
      out(await api("GET", `/api/learner/stats?course=${course}`));
      break;
    default:
      console.error("用法: pawclass learner <profile|mastery|due|stats>");
      process.exit(1);
  }
}

async function handlePractice(action: string, rest: string[]) {
  const { flags } = parseArgs(rest);

  switch (action) {
    case "create": {
      const course = flags.course || "middle/grade7-up/english";
      const mode = flags.mode || "practice";
      const concepts = flags.concepts ? flags.concepts.split(",") : undefined;
      const count = flags.count ? parseInt(flags.count) : 10;
      out(await api("POST", "/api/practice", { courseId: course, mode, concepts, count }));
      break;
    }
    case "status": {
      const id = rest.find(a => !a.startsWith("--")) || flags.id;
      if (!id) { console.error("用法: pawclass practice status <id>"); process.exit(1); }
      out(await api("GET", `/api/practice/${id}`));
      break;
    }
    case "results": {
      const id = rest.find(a => !a.startsWith("--")) || flags.id;
      if (!id) { console.error("用法: pawclass practice results <id>"); process.exit(1); }
      out(await api("GET", `/api/practice/${id}/results`));
      break;
    }
    default:
      console.error("用法: pawclass practice <create|status|results>");
      process.exit(1);
  }
}

async function handlePlan(action: string, rest: string[]) {
  const { flags } = parseArgs(rest);
  const course = flags.course || "middle/grade7-up/english";

  switch (action) {
    case "today":
      out(await api("GET", `/api/plan/today?course=${course}`));
      break;
    case "create": {
      const tasks = flags.tasks ? JSON.parse(flags.tasks) : [];
      const date = flags.date;
      const totalMinutes = flags.minutes ? parseInt(flags.minutes) : undefined;
      out(await api("POST", "/api/plan", { courseId: course, tasks, date, totalMinutes }));
      break;
    }
    default:
      console.error("用法: pawclass plan <today|create>");
      process.exit(1);
  }
}

async function handleKb(action: string, rest: string[]) {
  const { flags } = parseArgs(rest);
  const course = flags.course || "middle/grade7-up/english";

  switch (action) {
    case "concepts":
      out(await api("GET", `/api/kb/${course}/concepts`));
      break;
    case "exercises": {
      const concept = flags.concept;
      if (!concept) { console.error("用法: pawclass kb exercises --concept <id>"); process.exit(1); }
      const limit = flags.limit || "10";
      out(await api("GET", `/api/kb/${course}/exercises/${concept}?limit=${limit}`));
      break;
    }
    case "syllabus":
      out(await api("GET", `/api/kb/${course}/syllabus`));
      break;
    default:
      console.error("用法: pawclass kb <concepts|exercises|syllabus>");
      process.exit(1);
  }
}

async function main() {
  const command = process.argv[2];
  const subCommand = process.argv[3];
  const rest = process.argv.slice(4);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    usage();
    process.exit(0);
  }

  switch (command) {
    case "course":
      if (!subCommand) { console.error("用法: pawclass course <create|finalize|status|play|pause|resume|stop|results>"); process.exit(1); }
      await handleCourse(subCommand, rest);
      break;

    case "slide":
      if (!subCommand) { console.error("用法: pawclass slide add <courseId> ..."); process.exit(1); }
      await handleSlide(subCommand, rest);
      break;

    case "code":
      if (!subCommand) { console.error("用法: pawclass code add <courseId> ..."); process.exit(1); }
      await handleCode(subCommand, rest);
      break;

    case "quiz":
      if (!subCommand) { console.error("用法: pawclass quiz add <courseId> ..."); process.exit(1); }
      await handleQuiz(subCommand, rest);
      break;

    case "interactive":
      if (!subCommand) { console.error("用法: pawclass interactive add <courseId> ..."); process.exit(1); }
      await handleInteractive(subCommand, rest);
      break;

    case "narration":
      if (!subCommand) { console.error("用法: pawclass narration add <courseId> ..."); process.exit(1); }
      await handleNarration(subCommand, rest);
      break;

    case "whiteboard":
      if (!subCommand) { console.error("用法: pawclass whiteboard add <courseId> ..."); process.exit(1); }
      await handleWhiteboard(subCommand, rest);
      break;

    case "mistake":
      if (!subCommand) { console.error("用法: pawclass mistake <add|list|master>"); process.exit(1); }
      await handleMistake(subCommand, rest);
      break;

    case "learner":
      if (!subCommand) { console.error("用法: pawclass learner <profile|mastery|due|stats>"); process.exit(1); }
      await handleLearner(subCommand, rest);
      break;

    case "practice":
      if (!subCommand) { console.error("用法: pawclass practice <create|status|results>"); process.exit(1); }
      await handlePractice(subCommand, rest);
      break;

    case "plan":
      if (!subCommand) { console.error("用法: pawclass plan <today|create>"); process.exit(1); }
      await handlePlan(subCommand, rest);
      break;

    case "kb":
      if (!subCommand) { console.error("用法: pawclass kb <concepts|exercises|syllabus>"); process.exit(1); }
      await handleKb(subCommand, rest);
      break;

    case "stats":
      out(await api("GET", "/api/stats"));
      break;

    case "serve": {
      const DB_URL = process.env.DATABASE_URL;
      if (!DB_URL) { console.error("错误: DATABASE_URL 未设置"); process.exit(1); }
      const { createDB } = await import("./db/connection.js");
      const { startServer } = await import("./server.js");
      const db = createDB(DB_URL);
      startServer(db);
      break;
    }

    case "migrate": {
      const { runMigrations } = await import("./db/migrate.js");
      await runMigrations();
      break;
    }

    default:
      console.error(`未知命令: ${command}`);
      usage();
      process.exit(2);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
