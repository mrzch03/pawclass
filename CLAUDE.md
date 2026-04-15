# PawClass 开发规范

## 0. 项目定位

PawClass 是 ClawBox 生态的**教学云应用**，服务两个角色：
- **老师/Agent** — 通过 CLI 创建课程、布置练习、查看学习数据
- **学生** — 通过 Web 前端上课、做题、复习

PawClass 不是独立产品，它是 ClawBox Agent 的一个工具。Agent 通过 CLI + delegation token 调用 PawClass API，代表学生操作。

### 两大功能域

1. **互动课堂**（已有）— Agent 创建课件，SSE 流式播放，学生实时互动
2. **学习系统**（新增）— 知识库驱动的练习、复习、每日计划

### 做决策时的优先级

```
学生体验 > 开发效率 > 技术优雅
数据准确性 > 功能丰富度
无 Agent 也能用 > 强依赖 Agent
```

## 1. 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Bun + Hono |
| 数据库 | PostgreSQL 16 + Drizzle ORM |
| 前端 | React 19 + Vite + Zustand + Tailwind 3 |
| 认证 | JWT (jose)，支持 Logto OAuth + delegation token |
| 课件播放 | SSE streaming + TTS 语音 |
| AI | OpenAI SDK (大纲生成 + 课件生成) |
| CLI | 内置于 src/cli.ts，Agent 通过 CLI 调用 |

## 2. 项目结构

```
pawclass/
├── src/
│   ├── cli.ts                  ← CLI 入口（Agent 调用的所有命令）
│   ├── server.ts               ← HTTP server（Hono，路由挂载）
│   ├── db/
│   │   ├── schema.ts           ← 所有表定义（唯一真相源）
│   │   ├── connection.ts
│   │   └── migrate.ts
│   ├── routes/
│   │   ├── api.ts              ← 错题 CRUD + 统计
│   │   ├── course.ts           ← 课程生命周期
│   │   ├── teaching.ts         ← 教学大纲生成
│   │   ├── knowledge.ts        ← 知识库 API（读 knowledge-base 文件）
│   │   ├── learner.ts          ← 学生状态 API（掌握度、待复习、画像）
│   │   ├── practice.ts         ← 练习会话 API（创建、提交、完成）
│   │   └── plan.ts             ← 每日计划 API（Agent 制定 + 自动生成）
│   ├── knowledge/
│   │   └── knowledge-service.ts ← 从文件系统读 knowledge-base（只读）
│   ├── learning/
│   │   └── priority.ts          ← 优先级评分 + 间隔复习 + 掌握度计算
│   ├── auth/
│   │   ├── middleware.ts        ← JWT 验证中间件
│   │   └── types.ts
│   ├── repo/                    ← 数据访问层
│   ├── stage/                   ← 课件播放引擎（Session/Course）
│   └── llm/                     ← AI 调用
├── frontend/
│   └── src/
│       ├── App.tsx              ← 路由（pathname 匹配，无 react-router）
│       ├── pages/
│       │   ├── DashboardPage.tsx  ← 学习仪表盘
│       │   ├── PracticePage.tsx   ← 练习会话播放器
│       │   ├── ConceptsPage.tsx   ← 知识点浏览器
│       │   ├── PlanPage.tsx       ← 每日计划
│       │   └── LoginPage.tsx      ← 登录
│       ├── components/
│       │   ├── SessionPage.tsx    ← 课件播放（已有）
│       │   └── exercises/
│       │       └── ExerciseCard.tsx ← 做题卡片
│       ├── store/
│       │   ├── playback-store.ts  ← 课件播放状态
│       │   ├── stage-store.ts     ← 场景状态
│       │   └── practice-store.ts  ← 练习会话状态
│       ├── lib/
│       │   └── auth.ts            ← token 管理 + authFetch
│       └── types/
│           ├── stage.ts           ← 课件类型
│           └── learning.ts        ← 学习系统类型
├── projects/data-refinery/        ← 数据清洗 pipeline（独立子项目）
│   ├── knowledge-base/            ← pipeline 产出，PawClass 只读
│   ├── tools/                     ← Python pipeline 脚本
│   └── workbench/                 ← Next.js 可视化工作台
├── SKILL.md                       ← Agent 使用说明（OpenClaw 加载）
└── .env                           ← 环境变量（不入 Git）
```

## 3. 数据模型

所有表定义在 `src/db/schema.ts`，这是唯一真相源。

### 已有表

- `mistakes` — 错题记录
- `reviews` — 复习历史
- `courses` — 课程持久化

### 学习系统新增表

- `concept_mastery` — 知识点掌握度（per user × concept × course）
  - 跟踪：总次数、正确数、错误数、连对数、掌握等级、下次复习时间
  - 掌握等级：new → learning → practiced → mastered
- `exercise_attempts` — 每次做题记录
- `practice_sessions` — 练习会话（一组题目的容器）
- `daily_plans` — 每日学习计划（Agent 制定或自动生成）

## 4. 架构边界

### knowledge-base 是只读的

PawClass 通过 `KnowledgeService`（src/knowledge/knowledge-service.ts）从文件系统读取 knowledge-base 目录。**永远不写入**。写入权属于 data-refinery pipeline。

路径通过 `KNOWLEDGE_BASE_PATH` 环境变量配置。

### knowledge-base 数据结构

```
knowledge-base/
├── registry.json                      ← 课程注册表
└── middle/grade7-up/english/          ← courseId = "middle/grade7-up/english"
    ├── syllabus.md                    ← Unit → 知识点映射
    ├── concepts/
    │   ├── be-verb.md                 ← 知识点：规则、易错点、例句
    │   └── noun-plural.md
    ├── exercises/
    │   ├── index.json                 ← 题目索引（per concept 统计）
    │   ├── be-verb/
    │   │   ├── 001.json              ← 单道题目 JSON
    │   │   └── 002.json
    │   └── noun-plural/
    └── assets/
        └── unit_1_you_and_me.json     ← 课件素材（对话、短文）
```

### exercise JSON 结构

```json
{
  "id": "u1-fill-003",
  "type": "fill_blank",
  "question": "Those ___ (student) teacher is very kind.",
  "answer": "students'",
  "explanation": "those 后跟名词复数...",
  "concepts": ["noun-possessive"],
  "difficulty": 2
}
```

exercise.id 是稳定标识符，被 exercise_attempts 表引用。data-refinery 必须保证 ID 稳定。

### Agent 是可选的

所有 API 都可以被学生自己的前端调用（通过 JWT 认证）。Agent 通过 CLI + delegation token 调用同一套 API，增加智能规划层。

daily_plans 的 `source` 字段区分：
- `"auto"` — 学生打开 dashboard 时自动生成
- `"agent"` — Agent 通过 `pawclass plan create` 主动制定

### 课件和练习是两个独立系统

- **课件**（Course/Session）— Agent 创建场景 → SSE 流式播放 → 幻灯片+白板+TTS
- **练习**（Practice）— 从 knowledge-base 抽题 → 学生做题 → 更新掌握度

两者共享前端框架（React SPA）但数据流完全独立。

## 5. 学习系统核心算法

### 掌握度计算（src/learning/priority.ts）

```
new → learning:      首次练习
learning → practiced: 准确率 >= 60% 且做题 >= 5
practiced → mastered: 连对 >= 3 且准确率 >= 80% 且做题 >= 5
任何 → learning:     连对中断
```

### 间隔复习

```
答错:           明天复习
learning+连对0:  +1 天
learning+连对1:  +2 天
practiced+连对≤1: +3 天
practiced+连对2+: +7 天
mastered:        +14 天
```

### 优先级评分

```
score = wrongCount × 16
      + (wrongCount >= 2 ? 70 : 0)
      + (到复习时间 ? 80 : 0)
      + overdueDays × 6
      + (new ? 10 : 0)
      - streak × 4
```

## 6. API 路由索引

认证：需要 `Authorization: Bearer <JWT>` 的路由通过 authMiddleware 保护。知识库 API 无需认证。

| 前缀 | 文件 | 认证 | 说明 |
|------|------|------|------|
| /api/mistake | routes/api.ts | 需要 | 错题 CRUD |
| /api/review | routes/api.ts | 需要 | 复习记录 |
| /api/stats | routes/api.ts | 需要 | 统计 |
| /api/teaching | routes/teaching.ts | 需要 | 大纲生成 |
| /api/course | routes/course.ts | 混合 | 课程生命周期 |
| /api/session | stage/session-router.ts | 无 | Session 管理 |
| /api/kb | routes/knowledge.ts | 无 | 知识库（只读文件） |
| /api/learner | routes/learner.ts | 需要 | 学生状态 |
| /api/practice | routes/practice.ts | 需要 | 练习会话 |
| /api/plan | routes/plan.ts | 需要 | 每日计划 |
| /api/auth/login | server.ts | 无 | 本地登录（开发用） |

## 7. 前端路由

```
/dashboard        → DashboardPage（学习仪表盘）
/practice/:id     → PracticePage（做题）
/concepts         → ConceptsPage（知识点浏览）
/plan             → PlanPage（每日计划）
/course/:id       → SessionPage（课件播放）
/session/:id      → SessionPage（Session 播放）
```

路由匹配在 `frontend/src/App.tsx`，基于 pathname 判断，无 react-router。

学习系统页面需要登录（检查 localStorage 里的 token）。

## 8. CLI 命令索引

Agent 通过 CLI 调用，完整命令定义在 `src/cli.ts`。

| 命令 | 说明 |
|------|------|
| `pawclass course create/finalize/play/stop` | 课程生命周期 |
| `pawclass slide/quiz/narration add` | 添加课件内容 |
| `pawclass learner profile` | 学生画像 |
| `pawclass learner mastery` | 知识点掌握度 |
| `pawclass learner due` | 待复习知识点 |
| `pawclass practice create` | 创建练习会话 |
| `pawclass practice results` | 练习结果 |
| `pawclass plan today` | 今日计划 |
| `pawclass plan create` | Agent 制定计划 |
| `pawclass kb concepts/exercises/syllabus` | 查询知识库 |

## 9. Data Refinery 子项目

`projects/data-refinery/` 是独立的 Python 项目，负责将 PDF 教材/习题转换为 knowledge-base。

### pipeline 流程

```
raw PDF → extract (markitdown / PaddleOCR) → cleanup → split_units → structurize (DeepSeek API) → knowledge-base/
```

### 关键工具

| 命令 | 说明 |
|------|------|
| `python -m tools.pipeline run-all` | 处理所有注册资料 |
| `python -m tools.pipeline status` | 查看处理状态 |
| `python -m tools.rebuild_kb --course ...` | 重建知识库（不重新 OCR） |

### 环境变量

```
LLM_API_KEY      — DeepSeek API key
LLM_BASE_URL     — https://api.deepseek.com/v1
LLM_MODEL        — deepseek-chat
```

### 工作台

`projects/data-refinery/workbench/` 是 Next.js 可视化工作台：

```bash
cd projects/data-refinery/workbench && bun run dev
```

## 10. 环境变量

| 变量 | 必须 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接字符串 |
| `MISTAKES_JWT_SECRET` | 是 | JWT 签名密钥 |
| `KNOWLEDGE_BASE_PATH` | 否 | knowledge-base 路径（默认 ./projects/data-refinery/knowledge-base） |
| `PAWCLASS_PORT` | 否 | HTTP 端口（默认 9801） |
| `PAWCLASS_AI_API_KEY` | 否 | AI API Key（课件生成用） |
| `CLAWBOX_BACKEND_URL` | 否 | ClawBox Backend（事件通知用） |

## 11. 开发命令

```bash
# 启动服务
bun run dev                        # 或 bun run src/cli.ts serve

# 前端开发
cd frontend && bun run dev         # Vite dev server (HMR)
cd frontend && bun run build       # 生产构建

# 数据库
bun run db:push                    # 推送 schema（开发用）
bun run db:generate                # 生成 migration
bun run src/cli.ts migrate         # 执行 migration

# 测试
bun run test                       # vitest
```

## 12. Git 提交规范

```
<type>(<scope>): <简短描述>
```

| type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修复 |
| `refactor` | 重构 |
| `docs` | 文档 |
| `chore` | 构建/依赖 |

## 13. 线上部署

PawClass 作为 ClawBox 云应用独立部署：
- 域名：`pawclass.teachclaw.app`
- 数据库：ClawBox K8s 集群的 PostgreSQL（M6 节点）
- Agent 通过 delegation token 认证

本地开发通过 SSH 隧道连线上 PG：
```bash
ssh -i ~/.ssh/new.pem -L 5433:localhost:5432 -N root@43.131.234.2 &
# 同时在 M1 上 port-forward
kubectl port-forward -n clawbox pod/postgres-0 5432:5432 --address=0.0.0.0
```

## 14. 架构决策记录

### ADR-001: knowledge-base 用文件系统而非数据库

**决策**：PawClass 通过文件系统读取 knowledge-base，不导入 PostgreSQL。

**原因**：
- data-refinery pipeline 拥有写入权，避免两套同步机制
- 规模小（41 知识点、~1600 题），文件读取足够快
- 修改知识库只需重跑 pipeline，不需要额外的导入步骤

### ADR-002: 内置调度算法，Agent 可选

**决策**：间隔复习和优先级评分算法内置于 PawClass，不依赖 Agent。

**原因**：
- 学生可以在没有 Agent 的情况下自学
- Agent 提供智能规划层（制定计划），但基础调度不依赖它
- daily_plans 表的 source 字段区分 "auto" 和 "agent"

### ADR-003: 练习和课件是独立系统

**决策**：Practice（做题）和 Course（课件播放）共享前端框架但数据流独立。

**原因**：
- 课件是 Agent 创作的富内容（幻灯片+白板+TTS），通过 SSE 推送
- 练习是从知识库抽题，学生自主操作，通过 REST API 交互
- 两者场景不同，强耦合会增加复杂度
