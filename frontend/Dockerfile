FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Set public vars before build — Next.js bakes NEXT_PUBLIC_* into the JS bundle
# at npm run build time, NOT at container start. If unset here, the fallback
# http://localhost:8000 gets embedded and external users hit their own localhost.
ENV NEXT_PUBLIC_API_URL=/api/backend
ENV NEXT_PUBLIC_AI_URL=/api/ai
ENV NEXT_PUBLIC_WS_URL=/ws
# Server-side rewrite destinations — also evaluated at build time in next.config.mjs.
# Must point to Docker service names since this runs inside the compose network.
ENV API_INTERNAL_URL=http://backend:8000
ENV AI_INTERNAL_URL=http://ai-service:8001
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
