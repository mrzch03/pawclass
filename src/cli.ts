#!/usr/bin/env node

/**
 * PawClass — 教学云应用
 *
 * 融合错题管理 + 教学大纲生成 + 互动课堂播放
 *
 * 用法:
 *   pawclass serve              启动 HTTP 服务
 *   pawclass migrate            执行数据库迁移
 *   pawclass session <command>  教学 session 管理
 *   pawclass help               显示帮助
 */

import { createDB } from "./db/connection.js";
import { startServer } from "./server.js";

const DB_URL = process.env.DATABASE_URL;
const PAWCLASS_BASE_URL = process.env.PAWCLASS_BASE_URL || `http://localhost:${process.env.PAWCLASS_PORT || 9801}`;

function usage(): void {
  console.log(`pawclass — 教学云应用（错题本 + 互动课堂）

用法:
  pawclass serve                              启动 HTTP 服务
  pawclass migrate                            执行数据库迁移
  pawclass session load --outline <json>      创建教学 session
  pawclass session status <id>                查询 session 状态
  pawclass session play <id>                  开始播放
  pawclass session pause <id>                 暂停播放
  pawclass session resume <id>                继续播放
  pawclass session goto <id> --step <n>       跳到某步
  pawclass session stop <id>                  结束 session
  pawclass session results <id>               查看测验结果
  pawclass help                               显示帮助

环境变量:
  DATABASE_URL            PostgreSQL 连接字符串
  PAWCLASS_PORT           HTTP 端口 (默认 9801)
  PAWCLASS_BASE_URL       外部访问地址
  PAWCLASS_AI_API_KEY     AI API Key
  PAWCLASS_AI_MODEL       AI 模型 (默认 gpt-4o)
  CLAWBOX_BACKEND_URL     Backend 地址 (事件通知)
  APP_SECRET              应用密钥`);
}

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

async function apiRequest(method: string, path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${PAWCLASS_BASE_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(typeof data === "object" && data && "error" in data ? (data as any).error : `HTTP ${res.status}`);
  }
  return data;
}

async function handleSession(subCommand: string, rest: string[]) {
  const { flags, positional } = parseArgs(rest);

  switch (subCommand) {
    case "load": {
      let outlineStr = flags.outline;
      if (!outlineStr) { console.error("错误: --outline 参数必须提供"); process.exit(1); }
      if (outlineStr.startsWith("@")) {
        const { readFileSync } = await import("node:fs");
        outlineStr = readFileSync(outlineStr.slice(1), "utf-8");
      }
      let outline: unknown;
      try { outline = JSON.parse(outlineStr); } catch { console.error("错误: outline 不是有效的 JSON"); process.exit(1); }
      const data = await apiRequest("POST", "/api/session", { outline });
      process.stderr.write(`[pawclass] Session 已创建\n`);
      console.log(JSON.stringify(data, null, 2));
      break;
    }
    case "status": {
      const id = positional[0];
      if (!id) { console.error("用法: pawclass session status <id>"); process.exit(1); }
      console.log(JSON.stringify(await apiRequest("GET", `/api/session/${id}`), null, 2));
      break;
    }
    case "play": {
      const id = positional[0];
      if (!id) { console.error("用法: pawclass session play <id>"); process.exit(1); }
      const data = await apiRequest("POST", `/api/session/${id}/play`);
      process.stderr.write(`[pawclass] 开始播放\n`);
      console.log(JSON.stringify(data, null, 2));
      break;
    }
    case "pause": {
      const id = positional[0];
      if (!id) { console.error("用法: pawclass session pause <id>"); process.exit(1); }
      await apiRequest("POST", `/api/session/${id}/pause`);
      process.stderr.write(`[pawclass] 已暂停\n`);
      break;
    }
    case "resume": {
      const id = positional[0];
      if (!id) { console.error("用法: pawclass session resume <id>"); process.exit(1); }
      await apiRequest("POST", `/api/session/${id}/resume`);
      process.stderr.write(`[pawclass] 已继续\n`);
      break;
    }
    case "goto": {
      const id = positional[0];
      const stepIndex = parseInt(flags.step ?? "", 10);
      if (!id || isNaN(stepIndex)) { console.error("用法: pawclass session goto <id> --step <n>"); process.exit(1); }
      await apiRequest("POST", `/api/session/${id}/goto`, { stepIndex });
      process.stderr.write(`[pawclass] 跳转到步骤 ${stepIndex}\n`);
      break;
    }
    case "stop": {
      const id = positional[0];
      if (!id) { console.error("用法: pawclass session stop <id>"); process.exit(1); }
      await apiRequest("POST", `/api/session/${id}/stop`);
      process.stderr.write(`[pawclass] 已结束\n`);
      break;
    }
    case "results": {
      const id = positional[0];
      if (!id) { console.error("用法: pawclass session results <id>"); process.exit(1); }
      console.log(JSON.stringify(await apiRequest("GET", `/api/session/${id}/results`), null, 2));
      break;
    }
    default:
      console.error(`未知子命令: ${subCommand}`);
      process.exit(1);
  }
}

async function main() {
  const command = process.argv[2];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    usage();
    process.exit(0);
  }

  if (command === "session") {
    const subCommand = process.argv[3];
    if (!subCommand) { console.error("用法: pawclass session <load|status|play|pause|resume|goto|stop|results>"); process.exit(1); }
    await handleSession(subCommand, process.argv.slice(4));
    return;
  }

  if (!DB_URL) {
    console.error("错误: DATABASE_URL 未设置");
    process.exit(1);
  }

  switch (command) {
    case "serve": {
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
