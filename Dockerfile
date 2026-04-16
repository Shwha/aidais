FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@10.8.1 --activate
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/web/package.json packages/web/
RUN pnpm install --frozen-lockfile

# Build web frontend
FROM deps AS web-build
COPY packages/shared/ packages/shared/
COPY packages/web/ packages/web/
COPY tsconfig.base.json ./
RUN pnpm --filter @aidais/web build

# Production image
FROM base AS production
RUN addgroup --system --gid 1001 aidais && \
    adduser --system --uid 1001 --ingroup aidais aidais

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/server/node_modules ./packages/server/node_modules
COPY package.json pnpm-workspace.yaml ./
COPY packages/shared/ packages/shared/
COPY packages/server/ packages/server/
COPY --from=web-build /app/packages/web/dist packages/web/dist
COPY tsconfig.base.json ./

# Non-root user
USER aidais

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["pnpm", "--filter", "@aidais/server", "dev"]
