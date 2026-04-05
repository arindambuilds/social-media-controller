# --- Build ---
FROM node:22-alpine AS builder
WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json package-lock.json* ./

# Copy prisma BEFORE npm ci — postinstall runs prisma generate
COPY prisma ./prisma

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

# --- Run ---
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache openssl \
  && addgroup -g 1001 -S nodejs \
  && adduser -S nodejs -u 1001 -G nodejs

ENV NODE_ENV=production

COPY --from=builder /app/package.json /app/package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

RUN chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 10000

# migrate deploy needs live DATABASE_URL at container start, not build time
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
