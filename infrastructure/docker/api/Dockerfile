FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm db:generate && pnpm --filter @chainport/api build

FROM node:22-alpine
WORKDIR /app
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.revision=$GIT_SHA
ENV NODE_ENV=production
ENV CHAINPORT_GIT_SHA=$GIT_SHA
RUN addgroup -S chainport && adduser -S chainport -G chainport
COPY --from=build /app /app
USER chainport
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:3001/health || exit 1
CMD ["node", "apps/api/dist/server.js"]
