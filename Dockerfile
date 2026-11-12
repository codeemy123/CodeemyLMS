# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM base AS builder
ENV DOCKER_BUILD=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json next.config.mjs jsconfig.json ./
COPY public ./public
COPY src ./src
COPY prisma ./prisma
COPY prisma7.config.js ./
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=8080 \
    HOSTNAME=0.0.0.0

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 8080
CMD ["node", "server.js"]
