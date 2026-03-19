import { Hono } from "hono";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Resolve project root paths
// ---------------------------------------------------------------------------

function getProjectRoot(): string {
  // When running from source: src/routes/cli-dist.ts -> project root is ../../
  // When running from dist: dist/cli.js -> project root is ../
  // We look for clawbox-app.json as the anchor
  const candidates = [
    resolve(dirname(fileURLToPath(import.meta.url)), "../.."),  // from src/routes/
    resolve(dirname(fileURLToPath(import.meta.url)), ".."),     // from dist/
    process.cwd(),                                               // fallback to cwd
  ];
  for (const dir of candidates) {
    if (existsSync(resolve(dir, "clawbox-app.json"))) {
      return dir;
    }
  }
  return process.cwd();
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export function createCliDistRoutes(): Hono {
  const app = new Hono();
  const projectRoot = getProjectRoot();

  // GET /manifest — serve clawbox-app.json
  app.get("/manifest", (c) => {
    const manifestPath = resolve(projectRoot, "clawbox-app.json");
    if (!existsSync(manifestPath)) {
      return c.json({ error: "clawbox-app.json not found" }, 404);
    }
    const content = readFileSync(manifestPath, "utf-8");
    return c.json(JSON.parse(content));
  });

  // GET /bundle — serve the built CLI bundle
  app.get("/bundle", (c) => {
    const bundlePath = resolve(projectRoot, "dist/cli.js");
    if (!existsSync(bundlePath)) {
      return c.json(
        { error: "CLI not built. Run: bun build src/cli.ts --target=node --outfile=dist/cli.js" },
        404
      );
    }
    const content = readFileSync(bundlePath);
    return new Response(content, {
      headers: {
        "Content-Type": "application/javascript",
        "Content-Disposition": 'attachment; filename="pawclass"',
      },
    });
  });

  // GET /skill — serve SKILL.md
  app.get("/skill", (c) => {
    const skillPath = resolve(projectRoot, "SKILL.md");
    if (!existsSync(skillPath)) {
      return c.json({ error: "SKILL.md not found" }, 404);
    }
    const content = readFileSync(skillPath, "utf-8");
    return new Response(content, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
      },
    });
  });

  return app;
}
