FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --production
COPY . .
# Build CLI bundle
RUN bun build src/cli.ts --outdir dist --target node
# Build frontend SPA
RUN cd frontend && bun install && bun run build
EXPOSE 9801
CMD ["bun", "run", "src/cli.ts", "serve"]
