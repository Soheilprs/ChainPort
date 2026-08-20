FROM node:22-alpine
WORKDIR /app
COPY packages/deployment/scripts/rpc-proxy.mjs /app/rpc-proxy.mjs
USER 65532:65532
EXPOSE 8545
CMD ["node", "/app/rpc-proxy.mjs"]
