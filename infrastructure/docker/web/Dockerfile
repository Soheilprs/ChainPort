FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY packages/shared packages/shared
COPY packages/chain-registry packages/chain-registry
COPY apps/web ./apps/web
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @chainport/web build

FROM node:22-alpine
WORKDIR /app
RUN addgroup -S chainport && adduser -S chainport -G chainport
COPY --from=build /app /app
USER chainport
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:3000 || exit 1
CMD ["pnpm", "--filter", "@chainport/web", "start"]
