# Mistakes — 错题本云应用

独立部署的错题本 SaaS，支持记录错题、追踪薄弱知识点、间隔重复复习。

## 架构定位

Mistakes 是 ClawBox 生态的第一个独立云应用（Cloud App），遵循 [Cloud App + Agent Adapter](https://github.com/mrzch03/clawbox/blob/main/docs/cloud-app-architecture.md) 架构：

- **独立部署**，不依赖 ClawBox workspace 生命周期
- **自有认证**（Logto OIDC），用户直接登录使用
- **Agent 通过 `clawapp` CLI 操作**，走 delegation token 授权

## 快速开始

```bash
# 安装依赖
bun install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入 DATABASE_URL 等

# 推送数据库 schema
bun run db:push

# 启动开发服务器
bun run dev
```

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | — |
| `MISTAKES_JWT_SECRET` | JWT 验证密钥 | — |
| `MISTAKES_PORT` | HTTP 端口 | 9801 |
| `LOGTO_ISSUER` | Logto OIDC Issuer URL | — |

## API

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

## 部署

```bash
docker build -t mistakes .
docker run -p 9801:9801 --env-file .env mistakes
```
