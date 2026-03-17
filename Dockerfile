FROM oven/bun:1
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --production
COPY . .
RUN bun build src/cli.ts --outdir dist --target node
EXPOSE 9801
CMD ["bun", "run", "src/cli.ts", "serve"]
