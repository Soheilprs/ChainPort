FROM node:22-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=/backend
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY packages ./packages
COPY apps/web ./apps/web
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @chainport/shared --filter @chainport/chain-registry build
RUN pnpm --filter @chainport/web build

FROM node:22-alpine
WORKDIR /app
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.revision=$GIT_SHA
ENV NODE_ENV=production
ENV CHAINPORT_GIT_SHA=$GIT_SHA
ENV API_INTERNAL_URL=http://127.0.0.1:3001
RUN addgroup -S chainport && adduser -S chainport -G chainport
COPY --from=build /app /app
USER chainport
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://127.0.0.1:3000 || exit 1
WORKDIR /app/apps/web
CMD ["node", "node_modules/next/dist/bin/next", "start", "--port", "3000"]
