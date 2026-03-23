import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "hono/bun";
import { stream } from "hono/streaming";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createApiRoutes } from "./routes/api.js";
import { createTeachingRoutes } from "./routes/teaching.js";
import { createOAuthRoutes } from "./routes/oauth.js";
import { createCliDistRoutes } from "./routes/cli-dist.js";
import { createCourseRoutes } from "./routes/course.js";
import { createSessionRouter } from "./stage/session-router.js";
import { sessionStore } from "./stage/session-store.js";
import { courseStore, initCourseStore } from "./stage/course-store.js";
import { ServerPlaybackEngine } from "./stage/playback/server-engine.js";
import { createEventEmitter } from "./stage/events/event-emitter.js";
import { getAudioPath } from "./stage/tts/tts-generator.js";
import type { DB } from "./db/connection.js";
import { createMistakeRepo } from "./repo/mistake-repo.js";
import { createReviewRepo } from "./repo/review-repo.js";
import { authMiddleware } from "./auth/middleware.js";
import type { AuthVariables } from "./auth/types.js";
import type { QuizResult } from "./stage/types.js";

export function createServer(db: DB): Hono {
  // Init course store with DB for persistence
  initCourseStore(db);

  // Load Vite-built frontend index.html (used for course/session pages)
  const frontendIndexPath = resolve(dirname(fileURLToPath(import.meta.url)), "../frontend/dist/index.html");
  const frontendHtml = existsSync(frontendIndexPath) ? readFileSync(frontendIndexPath, "utf-8") : null;

  const app = new Hono();

  app.use("/*", cors());

  // Health check (public, no auth)
  app.get("/healthz", (c) => c.json({ status: "ok", app: "pawclass" }));

  // --- Public OAuth2 Provider routes (no auth) ---
  app.route("/oauth", createOAuthRoutes());

  // --- Public CLI distribution routes (no auth) ---
  app.route("/cli", createCliDistRoutes());

  // Repos
  const mistakeRepo = createMistakeRepo(db);
  const reviewRepo = createReviewRepo(db);

  // --- Authenticated API routes ---
  const apiApp = new Hono<{ Variables: AuthVariables }>();
  apiApp.use("/*", authMiddleware);

  // Mistakes CRUD + review
  apiApp.route("/", createApiRoutes({ mistakeRepo, reviewRepo }));

  // Teaching outline generation
  apiApp.route("/teaching", createTeachingRoutes({ mistakeRepo }));

  app.route("/api", apiApp);

  // --- Stage session routes (public, accessed by CLI with session IDs) ---
  const eventEmitter = process.env.CLAWBOX_BACKEND_URL
    ? createEventEmitter({
        backendUrl: process.env.CLAWBOX_BACKEND_URL,
        appSecret: process.env.APP_SECRET || "pawclass-secret",
        agentImUserId: process.env.AGENT_IM_USER_ID || "",
        targetUserId: process.env.TARGET_USER_ID,
        targetGroupId: process.env.TARGET_GROUP_ID,
      })
    : null;

  const engine = new ServerPlaybackEngine(eventEmitter);

  const sessionRouter = createSessionRouter({
    onSessionCreated: (sessionId) => {
      console.log(`[pawclass] Session ${sessionId} created, generating content...`);
      // Content generation will be triggered here when the generation pipeline is ready
    },
    onPlay: (sessionId) => engine.play(sessionId),
    onPause: (sessionId) => engine.pause(sessionId),
    onResume: (sessionId) => engine.resume(sessionId),
    onGoto: (sessionId, stepIndex) => engine.gotoStep(sessionId, stepIndex),
    onStop: (sessionId) => {
      engine.stop(sessionId);
      eventEmitter?.emit({ type: "session_end", sessionId, summary: "教学结束" });
    },
  });

  app.route("/api/session", sessionRouter);

  // --- Course routes ---
  const baseUrl = process.env.PAWCLASS_BASE_URL || `http://localhost:${process.env.PAWCLASS_PORT || "9801"}`;

  // Public course endpoints (no auth — accessed by browser)
  app.get("/api/course/:id/stream", (c) => {
    const courseId = c.req.param("id");
    const course = courseStore.get(courseId);
    if (!course) return c.json({ error: "course not found" }, 404);

    return stream(c, async (s) => {
      c.header("Content-Type", "text/event-stream");
      c.header("Cache-Control", "no-cache");
      c.header("Connection", "keep-alive");

      const unsubscribe = engine.subscribe(courseId, (event) => {
        try { s.write(`data: ${JSON.stringify(event)}\n\n`); } catch {}
      });

      s.write(`data: ${JSON.stringify({
        type: "init",
        status: course.status,
        currentStepIndex: course.currentStepIndex,
        totalSteps: course.scenes.length,
        scenes: course.scenes,
      })}\n\n`);

      s.onAbort(() => unsubscribe());
      await new Promise(() => {});
    });
  });
  app.post("/api/course/:id/step-complete", async (c) => {
    const body = await c.req.json<{ stepIndex: number }>();
    await engine.onStepComplete(c.req.param("id"), body.stepIndex);
    return c.json({ ok: true });
  });
  app.post("/api/course/:id/quiz-submit", async (c) => {
    const body = await c.req.json<{ stepIndex: number; result: QuizResult }>();
    await engine.onQuizSubmit(c.req.param("id"), body.stepIndex, body.result);
    return c.json({ ok: true });
  });

  // Authenticated course endpoints (Bearer auth — called by CLI)
  // Pass authMiddleware to createCourseRoutes so it applies per-route
  app.route("/api/course", createCourseRoutes({ engine, baseUrl, authMiddleware }));

  // Course frontend page
  app.get("/course/:id", (c) => {
    if (!frontendHtml) return c.text("Frontend not built. Run: cd frontend && bun run build", 500);
    const html = frontendHtml.replace(
      "</head>",
      `<script>window.__STAGE_SESSION_ID__="${c.req.param("id")}";window.__STAGE_MODE__="course"</script></head>`
    );
    return c.html(html);
  });

  // SSE streaming
  app.get("/api/session/:id/stream", (c) => {
    const sessionId = c.req.param("id");
    const session = sessionStore.get(sessionId);
    if (!session) return c.json({ error: "session not found" }, 404);

    return stream(c, async (s) => {
      c.header("Content-Type", "text/event-stream");
      c.header("Cache-Control", "no-cache");
      c.header("Connection", "keep-alive");

      const unsubscribe = engine.subscribe(sessionId, (event) => {
        try { s.write(`data: ${JSON.stringify(event)}\n\n`); } catch {}
      });

      s.write(`data: ${JSON.stringify({
        type: "init",
        status: session.status,
        currentStepIndex: session.currentStepIndex,
        totalSteps: session.scenes.length,
      })}\n\n`);

      s.onAbort(() => unsubscribe());
      await new Promise(() => {});
    });
  });

  // Frontend report endpoints
  app.post("/api/session/:id/step-complete", async (c) => {
    const body = await c.req.json<{ stepIndex: number }>();
    await engine.onStepComplete(c.req.param("id"), body.stepIndex);
    return c.json({ ok: true });
  });
  app.post("/api/session/:id/quiz-submit", async (c) => {
    const body = await c.req.json<{ stepIndex: number; result: QuizResult }>();
    await engine.onQuizSubmit(c.req.param("id"), body.stepIndex, body.result);
    return c.json({ ok: true });
  });
  app.post("/api/session/:id/help-request", async (c) => {
    const body = await c.req.json<{ stepIndex: number }>();
    await engine.onHelpRequest(c.req.param("id"), body.stepIndex);
    return c.json({ ok: true });
  });
  app.post("/api/session/:id/student-exit", async (c) => {
    await engine.onStudentExit(c.req.param("id"));
    return c.json({ ok: true });
  });

  // Audio serving
  app.get("/api/session/:id/audio/:actionId", (c) => {
    const { id, actionId } = c.req.param();
    const audioPath = getAudioPath(id, actionId);
    if (!existsSync(audioPath)) return c.json({ error: "audio not found" }, 404);
    return new Response(readFileSync(audioPath), {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=86400" },
    });
  });

  // Stage frontend page
  app.get("/session/:id", (c) => {
    if (!frontendHtml) return c.text("Frontend not built. Run: cd frontend && bun run build", 500);
    const html = frontendHtml.replace(
      "</head>",
      `<script>window.__STAGE_SESSION_ID__="${c.req.param("id")}"</script></head>`
    );
    return c.html(html);
  });

  // Serve frontend SPA static files (Vite build output → frontend/dist/)
  app.use("/frontend/*", serveStatic({ root: "./frontend/dist", rewriteRequestPath: (path) => path.replace(/^\/frontend/, "") }));

  // Web UI routes (mistakes management pages)
  app.get("/", (c) => c.html(getIndexHtml()));
  app.get("/dashboard", (c) => c.html(getDashboardHtml()));
  app.get("/review", (c) => c.html(getReviewHtml()));

  return app;
}

export function startServer(db: DB, port?: number) {
  const resolvedPort = port ?? parseInt(process.env.PAWCLASS_PORT || "9801", 10);
  const app = createServer(db);
  const server = Bun.serve({
    port: resolvedPort,
    fetch: app.fetch,
  });
  console.log(`pawclass running on http://localhost:${server.port}`);
  return server;
}

// ---------------------------------------------------------------------------
// Embedded HTML pages
// ---------------------------------------------------------------------------

function getIndexHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>错题本</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <style>
    [x-cloak] { display: none !important; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
<div x-data="mistakeApp()" x-init="init()" x-cloak class="max-w-4xl mx-auto px-4 py-6">

  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-gray-800">错题本</h1>
    <div class="flex gap-2">
      <a href="/dashboard" class="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">统计面板</a>
      <a href="/review" class="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200">复习模式</a>
    </div>
  </div>

  <!-- Filter bar -->
  <div class="bg-white rounded-lg shadow-sm p-4 mb-4 flex flex-wrap gap-3 items-center">
    <select x-model="filters.subject" @change="loadMistakes()" class="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      <option value="">所有科目</option>
      <template x-for="s in subjects" :key="s">
        <option :value="s" x-text="s"></option>
      </template>
    </select>
    <input type="text" x-model="filters.topic" @input.debounce.300ms="loadMistakes()" placeholder="搜索知识点..." class="border border-gray-300 rounded-md px-3 py-1.5 text-sm flex-1 min-w-[150px] focus:outline-none focus:ring-2 focus:ring-blue-500">
    <label class="flex items-center gap-1.5 text-sm text-gray-600">
      <input type="checkbox" x-model="filters.showMastered" @change="loadMistakes()" class="rounded">
      <span>显示已掌握</span>
    </label>
    <span class="text-xs text-gray-400" x-text="mistakes.length + ' 条记录'"></span>
  </div>

  <!-- Mistake cards -->
  <div class="space-y-3">
    <template x-for="m in mistakes" :key="m.id">
      <div class="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden">
        <!-- Card header (always visible) -->
        <div @click="toggle(m.id)" class="p-4 cursor-pointer hover:bg-gray-50 transition-colors">
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="inline-block px-2 py-0.5 text-xs font-medium rounded-full" :class="subjectColor(m.subject)" x-text="m.subject"></span>
                <span x-show="m.topic" class="text-xs text-gray-500" x-text="m.topic"></span>
              </div>
              <p class="text-sm text-gray-700 truncate" x-text="m.problem_text.length > 100 ? m.problem_text.slice(0, 100) + '...' : m.problem_text"></p>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-xs" x-text="'★'.repeat(m.difficulty) + '☆'.repeat(5 - m.difficulty)"></span>
              <span x-show="m.mastered" class="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">已掌握</span>
            </div>
          </div>
        </div>

        <!-- Card detail (expanded) -->
        <div x-show="expanded === m.id" x-transition class="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <div>
            <h4 class="text-xs font-medium text-gray-500 mb-1">题目</h4>
            <p class="text-sm text-gray-800 whitespace-pre-wrap" x-text="m.problem_text"></p>
          </div>
          <div x-show="m.wrong_answer">
            <h4 class="text-xs font-medium text-red-500 mb-1">错误答案</h4>
            <p class="text-sm text-gray-700 whitespace-pre-wrap" x-text="m.wrong_answer"></p>
          </div>
          <div x-show="m.correct_answer">
            <h4 class="text-xs font-medium text-green-600 mb-1">正确答案</h4>
            <p class="text-sm text-gray-700 whitespace-pre-wrap" x-text="m.correct_answer"></p>
          </div>
          <div x-show="m.explanation">
            <h4 class="text-xs font-medium text-blue-600 mb-1">解析</h4>
            <p class="text-sm text-gray-700 whitespace-pre-wrap" x-text="m.explanation"></p>
          </div>
          <div class="flex gap-2 pt-2">
            <button x-show="!m.mastered" @click.stop="markMastered(m.id)" class="px-3 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600">标记已掌握</button>
            <button @click.stop="deleteMistake(m.id)" class="px-3 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100">删除</button>
          </div>
        </div>
      </div>
    </template>

    <div x-show="mistakes.length === 0 && !loading" class="text-center py-12 text-gray-400">
      <p class="text-lg mb-1">暂无错题</p>
      <p class="text-sm">通过 CLI 或 API 添加错题后会显示在这里</p>
    </div>

    <div x-show="loading" class="text-center py-12 text-gray-400">
      <p>加载中...</p>
    </div>
  </div>
</div>

<script>
function mistakeApp() {
  const colors = [
    'bg-red-100 text-red-700',
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-yellow-100 text-yellow-800',
    'bg-pink-100 text-pink-700',
    'bg-indigo-100 text-indigo-700',
    'bg-teal-100 text-teal-700',
    'bg-orange-100 text-orange-700',
  ];
  const colorMap = {};

  return {
    mistakes: [],
    subjects: [],
    expanded: null,
    loading: false,
    filters: {
      subject: '',
      topic: '',
      showMastered: false,
    },

    async init() {
      await this.loadSubjects();
      await this.loadMistakes();
    },

    async loadSubjects() {
      const all = await fetch('/api/mistake').then(r => r.json());
      const set = new Set(all.map(m => m.subject));
      this.subjects = [...set].sort();
    },

    async loadMistakes() {
      this.loading = true;
      const params = new URLSearchParams();
      if (this.filters.subject) params.set('subject', this.filters.subject);
      if (this.filters.topic) params.set('topic', this.filters.topic);
      if (!this.filters.showMastered) params.set('mastered', 'false');
      const url = '/api/mistake' + (params.toString() ? '?' + params : '');
      this.mistakes = await fetch(url).then(r => r.json());
      this.loading = false;
    },

    toggle(id) {
      this.expanded = this.expanded === id ? null : id;
    },

    subjectColor(subject) {
      if (!colorMap[subject]) {
        colorMap[subject] = colors[Object.keys(colorMap).length % colors.length];
      }
      return colorMap[subject];
    },

    async markMastered(id) {
      await fetch('/api/mistake/' + id + '/master', { method: 'POST' });
      await this.loadMistakes();
    },

    async deleteMistake(id) {
      if (!confirm('确定删除这条错题？')) return;
      await fetch('/api/mistake/' + id, { method: 'DELETE' });
      this.expanded = null;
      await this.loadMistakes();
    },
  };
}
</script>
</body>
</html>`;
}

function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>错题本 - 统计面板</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <style>
    [x-cloak] { display: none !important; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
<div x-data="dashboardApp()" x-init="init()" x-cloak class="max-w-4xl mx-auto px-4 py-6">

  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-gray-800">统计面板</h1>
    <div class="flex gap-2">
      <a href="/" class="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">错题列表</a>
      <a href="/review" class="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200">复习模式</a>
    </div>
  </div>

  <!-- Overview cards -->
  <div class="grid grid-cols-3 gap-4 mb-6">
    <div class="bg-white rounded-lg shadow-sm p-5 text-center">
      <p class="text-3xl font-bold text-gray-800" x-text="stats.total">0</p>
      <p class="text-sm text-gray-500 mt-1">总题数</p>
    </div>
    <div class="bg-white rounded-lg shadow-sm p-5 text-center">
      <p class="text-3xl font-bold text-green-600" x-text="stats.mastered">0</p>
      <p class="text-sm text-gray-500 mt-1">已掌握</p>
    </div>
    <div class="bg-white rounded-lg shadow-sm p-5 text-center">
      <p class="text-3xl font-bold text-red-500" x-text="stats.unmastered">0</p>
      <p class="text-sm text-gray-500 mt-1">待攻克</p>
    </div>
  </div>

  <!-- Subject distribution -->
  <div class="bg-white rounded-lg shadow-sm p-5 mb-6">
    <h2 class="text-lg font-semibold text-gray-700 mb-4">科目分布</h2>
    <div x-show="stats.bySubject.length === 0" class="text-center text-gray-400 py-6 text-sm">暂无数据</div>
    <div class="space-y-3">
      <template x-for="s in stats.bySubject" :key="s.subject">
        <div>
          <div class="flex items-center justify-between text-sm mb-1">
            <span class="font-medium text-gray-700" x-text="s.subject"></span>
            <span class="text-gray-500">
              <span x-text="s.mastered"></span>/<span x-text="s.count"></span>
              <span class="text-xs ml-1" x-text="s.count > 0 ? Math.round(s.mastered / s.count * 100) + '%' : '0%'"></span>
            </span>
          </div>
          <div class="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div class="h-3 rounded-full transition-all duration-500"
              :class="subjectBarColor(s.subject)"
              :style="'width: ' + (s.count > 0 ? (s.mastered / s.count * 100) : 0) + '%'">
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>

  <!-- Weak topics -->
  <div class="bg-white rounded-lg shadow-sm p-5">
    <h2 class="text-lg font-semibold text-gray-700 mb-4">薄弱知识点</h2>
    <div x-show="stats.weakTopics.length === 0" class="text-center text-gray-400 py-6 text-sm">暂无薄弱知识点</div>
    <div class="divide-y divide-gray-100">
      <template x-for="(t, idx) in stats.weakTopics" :key="t.topic">
        <div class="flex items-center justify-between py-2.5">
          <div class="flex items-center gap-3">
            <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
              :class="idx < 3 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'"
              x-text="idx + 1"></span>
            <span class="text-sm text-gray-700" x-text="t.topic"></span>
          </div>
          <span class="text-sm font-medium text-red-500" x-text="t.count + ' 题待攻克'"></span>
        </div>
      </template>
    </div>
  </div>
</div>

<script>
function dashboardApp() {
  const barColors = [
    'bg-blue-500', 'bg-purple-500', 'bg-teal-500', 'bg-orange-500',
    'bg-pink-500', 'bg-indigo-500', 'bg-red-500', 'bg-yellow-500',
  ];
  const colorMap = {};

  return {
    stats: { total: 0, mastered: 0, unmastered: 0, bySubject: [], weakTopics: [] },

    async init() {
      this.stats = await fetch('/api/stats').then(r => r.json());
    },

    subjectBarColor(subject) {
      if (!colorMap[subject]) {
        colorMap[subject] = barColors[Object.keys(colorMap).length % barColors.length];
      }
      return colorMap[subject];
    },
  };
}
</script>
</body>
</html>`;
}

function getReviewHtml(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>错题本 - 复习模式</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
  <style>
    [x-cloak] { display: none !important; }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
<div x-data="reviewApp()" x-init="init()" x-cloak class="max-w-2xl mx-auto px-4 py-6">

  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-gray-800">复习模式</h1>
    <div class="flex gap-2">
      <a href="/" class="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">错题列表</a>
      <a href="/dashboard" class="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">统计面板</a>
    </div>
  </div>

  <!-- Filter -->
  <div class="mb-4">
    <select x-model="subjectFilter" @change="loadNext()" class="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
      <option value="">所有科目</option>
      <template x-for="s in subjects" :key="s">
        <option :value="s" x-text="s"></option>
      </template>
    </select>
  </div>

  <!-- Flashcard -->
  <template x-if="current">
    <div class="bg-white rounded-xl shadow-md overflow-hidden">
      <!-- Card header -->
      <div class="px-6 pt-5 pb-3 border-b border-gray-100">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded-full" x-text="current.subject"></span>
            <span x-show="current.topic" class="text-xs text-gray-500" x-text="current.topic"></span>
          </div>
          <div class="flex items-center gap-2 text-xs text-gray-400">
            <span x-text="'复习 ' + current.reviewCount + ' 次'"></span>
            <span x-text="'★'.repeat(current.difficulty)"></span>
          </div>
        </div>
      </div>

      <!-- Problem -->
      <div class="px-6 py-5">
        <h3 class="text-xs font-medium text-gray-400 mb-2">题目</h3>
        <p class="text-gray-800 whitespace-pre-wrap leading-relaxed" x-text="current.problemText"></p>
      </div>

      <!-- Answer (hidden by default) -->
      <div x-show="showAnswer" x-transition class="px-6 pb-5 space-y-4 border-t border-gray-100 pt-4">
        <div x-show="currentFull && currentFull.correct_answer">
          <h4 class="text-xs font-medium text-green-600 mb-1">正确答案</h4>
          <p class="text-sm text-gray-700 whitespace-pre-wrap" x-text="currentFull?.correct_answer"></p>
        </div>
        <div x-show="currentFull && currentFull.explanation">
          <h4 class="text-xs font-medium text-blue-600 mb-1">解析</h4>
          <p class="text-sm text-gray-700 whitespace-pre-wrap" x-text="currentFull?.explanation"></p>
        </div>
        <div x-show="currentFull && currentFull.wrong_answer">
          <h4 class="text-xs font-medium text-red-500 mb-1">之前的错误答案</h4>
          <p class="text-sm text-gray-600 whitespace-pre-wrap" x-text="currentFull?.wrong_answer"></p>
        </div>
      </div>

      <!-- Actions -->
      <div class="px-6 pb-5">
        <template x-if="!showAnswer">
          <button @click="revealAnswer()" class="w-full py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium">
            显示答案
          </button>
        </template>
        <template x-if="showAnswer">
          <div class="flex gap-3">
            <button @click="submitReview('correct')" class="flex-1 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium text-sm">
              correct
            </button>
            <button @click="submitReview('partial')" class="flex-1 py-2.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors font-medium text-sm">
              partial
            </button>
            <button @click="submitReview('wrong')" class="flex-1 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium text-sm">
              wrong
            </button>
          </div>
        </template>
      </div>
    </div>
  </template>

  <!-- Empty state -->
  <div x-show="!current && !loading" class="text-center py-20">
    <p class="text-lg text-gray-600 font-medium">没有需要复习的题目</p>
    <p class="text-sm text-gray-400 mt-1">所有错题都已复习完毕，继续保持！</p>
    <a href="/" class="inline-block mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm">返回错题列表</a>
  </div>

  <!-- Loading -->
  <div x-show="loading" class="text-center py-20 text-gray-400">
    <p>加载中...</p>
  </div>

  <!-- Review count -->
  <div x-show="reviewedCount > 0" class="mt-6 text-center text-sm text-gray-400">
    本次已复习 <span class="font-medium text-gray-600" x-text="reviewedCount"></span> 题
  </div>
</div>

<script>
function reviewApp() {
  return {
    current: null,
    currentFull: null,
    showAnswer: false,
    loading: false,
    subjectFilter: '',
    subjects: [],
    reviewedCount: 0,

    async init() {
      // Load subjects
      const all = await fetch('/api/mistake').then(r => r.json());
      const set = new Set(all.map(m => m.subject));
      this.subjects = [...set].sort();
      await this.loadNext();
    },

    async loadNext() {
      this.loading = true;
      this.showAnswer = false;
      this.currentFull = null;
      const params = new URLSearchParams({ limit: '1' });
      if (this.subjectFilter) params.set('subject', this.subjectFilter);
      const items = await fetch('/api/review/due?' + params).then(r => r.json());
      this.current = items.length > 0 ? items[0] : null;
      this.loading = false;
    },

    async revealAnswer() {
      if (!this.current) return;
      // Fetch full mistake details for answer/explanation
      this.currentFull = await fetch('/api/mistake/' + this.current.id).then(r => r.json());
      this.showAnswer = true;
    },

    async submitReview(result) {
      if (!this.current) return;
      await fetch('/api/mistake/' + this.current.id + '/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      });
      this.reviewedCount++;
      await this.loadNext();
    },
  };
}
</script>
</body>
</html>`;
}
