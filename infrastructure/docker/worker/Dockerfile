FROM node:22-alpine AS build
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm db:generate && pnpm --filter @chainport/worker build

FROM node:22-alpine
WORKDIR /app
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.revision=$GIT_SHA
ENV NODE_ENV=production
ENV CHAINPORT_GIT_SHA=$GIT_SHA
# docker CLI talks to a host-mounted daemon. Sandbox containers never receive the socket.
RUN apk add --no-cache docker-cli \
  && addgroup -S chainport \
  && adduser -S chainport -G chainport
COPY --from=build /app /app
USER chainport
CMD ["node", "apps/worker/dist/main.js"]
