FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/
RUN npm ci --workspace=@fuelnsw/shared --workspace=web
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web
RUN npm run build --workspace=web
RUN npm prune --production --workspace=web

FROM node:22-slim
WORKDIR /app
COPY --from=builder /app/apps/web/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/package.json .
COPY --from=builder /app/apps/web/static ./static
COPY --from=builder /app/packages/shared ./packages/shared
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
VOLUME /app/data
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 3000) + '/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"
CMD ["node", "build"]
