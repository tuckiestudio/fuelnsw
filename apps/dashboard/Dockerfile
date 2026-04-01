FROM node:22-slim AS builder
WORKDIR /app
COPY package*.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/dashboard/package.json ./apps/dashboard/
RUN npm ci --workspace=@fuelnsw/shared --workspace=dashboard
COPY packages/shared ./packages/shared
COPY apps/dashboard ./apps/dashboard
RUN npm run build --workspace=dashboard
RUN npm prune --production --workspace=dashboard

FROM node:22-slim
WORKDIR /app
COPY --from=builder /app/apps/dashboard/build ./build
COPY --from=builder /app/apps/dashboard/node_modules ./node_modules
COPY --from=builder /app/apps/dashboard/package.json .
COPY --from=builder /app/apps/dashboard/static ./static
COPY --from=builder /app/packages/shared ./packages/shared
RUN mkdir -p /app/data && chown -R node:node /app
USER node
EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001
VOLUME /app/data
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-3001}/api/dashboard/regions || exit 1
CMD ["node", "build"]
