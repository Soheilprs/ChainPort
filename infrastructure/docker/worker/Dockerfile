FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @chainport/worker build

FROM node:22-alpine
WORKDIR /app
RUN addgroup -S chainport && adduser -S chainport -G chainport
COPY --from=build /app /app
USER chainport
CMD ["node", "apps/worker/dist/main.js"]
