# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json     ./apps/api/
COPY apps/web/package.json     ./apps/web/

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN pnpm install --frozen-lockfile

COPY packages/shared ./packages/shared
COPY apps/web        ./apps/web

EXPOSE 3000
WORKDIR /app/apps/web
CMD ["pnpm", "dev"]