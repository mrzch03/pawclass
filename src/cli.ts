#!/usr/bin/env node

/**
 * Mistakes 云应用入口
 *
 * 用法:
 *   bun run src/cli.ts serve     # 启动 HTTP 服务
 *   bun run src/cli.ts migrate   # 执行数据库迁移
 */

import { createDB } from "./db/connection.js";
import { startServer } from "./server.js";

const DB_URL = process.env.DATABASE_URL;

function usage(): void {
  console.log(`mistakes — 错题本云应用

用法:
  mistakes serve     启动 HTTP 服务
  mistakes migrate   执行数据库迁移
  mistakes help      显示帮助

环境变量:
  DATABASE_URL          PostgreSQL 连接字符串
  MISTAKES_JWT_SECRET   JWT 验证密钥
  MISTAKES_PORT         HTTP 端口 (默认 9801)
  LOGTO_ISSUER          Logto OIDC Issuer URL`);
}

async function main() {
  const command = process.argv[2];

  if (!command || command === "help" || command === "--help" || command === "-h") {
    usage();
    process.exit(0);
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
