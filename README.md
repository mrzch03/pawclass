# PawClass

教学云应用 — 错题管理 + 个性化教学大纲 + 互动课堂播放。

PawClass 是 [ClawBox](https://github.com/mrzch03/clawbox) 生态的教学云应用，将错题本管理与 AI 驱动的互动课堂融为一体。Agent 通过 CLI 控制教学流程，应用自主生成课件并播放，关键事件通过系统通知回到聊天流。

## 核心功能

- **错题管理**：记录错题、追踪薄弱知识点、间隔重复复习
- **教学大纲生成**：基于学生错题数据，LLM 生成个性化教学大纲
- **互动课堂**：幻灯片、白板、测验、TTS 语音讲解，自主播放
- **学习闭环**：测验结果 → 错题录入 → 下次教学参考

## 致谢

PawClass 的课件生成管线（场景生成、动作解析、Prompt 模板）基于 [OpenMAIC](https://github.com/openmaic/openmaic) 项目改编。OpenMAIC 是一个开源的 AI 课件生成引擎，采用 AGPL-3.0 协议。PawClass 同样以 AGPL-3.0 协议开源。

## 快速开始

```bash
# 安装依赖
bun install

# 配置环境变量
cp .env.example .env

# 推送数据库 schema
bun run db:push

# 启动服务
bun run dev
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | — |
| `PAWCLASS_PORT` | HTTP 端口 | 9801 |
| `PAWCLASS_AI_API_KEY` | AI API Key（大纲生成 + 课件生成） | — |
| `PAWCLASS_AI_MODEL` | AI 模型 | gpt-4o |
| `PAWCLASS_AI_BASE_URL` | AI API Base URL（可选） | — |
| `CLAWBOX_BACKEND_URL` | ClawBox Backend 地址（事件通知） | — |
| `APP_SECRET` | 应用密钥（事件通知认证） | — |

## API

### 错题管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/mistake | 查询错题列表 |
| POST | /api/mistake | 添加错题 |
| GET | /api/mistake/:id | 查询单条 |
| PATCH | /api/mistake/:id | 更新错题 |
| DELETE | /api/mistake/:id | 删除错题 |
| POST | /api/mistake/:id/master | 标记已掌握 |
| POST | /api/mistake/:id/review | 提交复习结果 |
| GET | /api/review/due | 获取待复习列表 |
| GET | /api/stats | 统计数据 |

### 教学大纲

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/teaching/outline | 生成个性化教学大纲 |

### 教学 Session

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/session | 创建 session，传入大纲 |
| GET | /api/session/:id | 查询状态 |
| POST | /api/session/:id/play | 开始播放 |
| POST | /api/session/:id/pause | 暂停 |
| POST | /api/session/:id/resume | 继续 |
| POST | /api/session/:id/goto | 跳到指定步骤 |
| POST | /api/session/:id/stop | 结束 |
| GET | /api/session/:id/results | 测验结果 |
| GET | /api/session/:id/stream | SSE 播放事件流 |
| GET | /session/:id | 教学前端页面 |

## CLI

```bash
pawclass serve                              # 启动服务
pawclass migrate                            # 数据库迁移
pawclass session load --outline <json>      # 创建教学 session
pawclass session status <id>                # 查询状态
pawclass session play <id>                  # 开始播放
pawclass session pause <id>                 # 暂停
pawclass session resume <id>                # 继续
pawclass session stop <id>                  # 结束
pawclass session results <id>               # 测验结果
```

## 部署

```bash
docker build -t pawclass .
docker run -p 9801:9801 --env-file .env pawclass
```

## License

[AGPL-3.0](LICENSE)

Content generation pipeline adapted from [OpenMAIC](https://github.com/openmaic/openmaic) (AGPL-3.0).
