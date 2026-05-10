# syntax=docker/dockerfile:1.7

FROM node:22-bookworm-slim

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy workspace manifests first (better layer caching)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json     ./apps/api/
COPY apps/web/package.json     ./apps/web/

# Skip the project's postinstall Playwright download — we'll do it explicitly
# below in a way that also installs the matching system libs.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
RUN pnpm install --frozen-lockfile

# Now install Chromium + the Linux deps it needs.
RUN cd apps/api && pnpm exec playwright install --with-deps chromium

# Copy actual source
COPY packages/shared ./packages/shared
COPY apps/api        ./apps/api

EXPOSE 4000
WORKDIR /app/apps/api
CMD ["pnpm", "dev"]