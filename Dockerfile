FROM oven/bun:1
WORKDIR /app

# Install dependencies
COPY package.json bun.lockb* ./
RUN bun install --production

# Copy source
COPY src/ src/
COPY drizzle/ drizzle/
COPY drizzle.config.ts tsconfig.json ./
COPY SKILL.md ./

# Build frontend SPA
COPY frontend/package.json frontend/bun.lockb* frontend/
RUN cd frontend && bun install
COPY frontend/ frontend/
RUN cd frontend && bun run build

EXPOSE 9801

# KNOWLEDGE_BASE_PATH defaults to /data/knowledge-base (mounted via PVC)
ENV KNOWLEDGE_BASE_PATH=/data/knowledge-base

CMD ["bun", "run", "src/cli.ts", "serve"]
