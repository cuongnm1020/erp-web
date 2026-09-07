# syntax=docker/dockerfile:1.7
# Next.js standalone (next.config.ts output: 'standalone'). Build bởi .github/workflows/deploy.yml.
# NEXT_PUBLIC_* được inline LÚC BUILD → truyền qua build-arg, đổi giá trị = build lại image.

FROM node:20-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install -g pnpm@10.33.0
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store-web,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile
COPY . .
ARG NEXT_PUBLIC_API_URL
# env.ts fail-fast nếu thiếu — bắt ngay ở build thay vì lúc chạy.
RUN test -n "$NEXT_PUBLIC_API_URL" || { echo "Thiếu build-arg NEXT_PUBLIC_API_URL" >&2; exit 1; }
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NODE_ENV=production
RUN pnpm build

FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
