# ---------------------------------------------------------------------------
# Build-stage: installeert alle dependencies (incl. dev) en bouwt de Next.js
# app met `output: 'standalone'`. python3/make/g++ zijn nodig om de native
# module better-sqlite3 voor Alpine (musl) te compileren. Omdat npm ci en de
# build hier op Alpine draaien, worden de juiste musl-varianten van de native
# modules (better-sqlite3, @node-rs/argon2) geïnstalleerd en meegetraced.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS builder

RUN apk add --no-cache python3 make g++

WORKDIR /app

# Eerst alleen de manifesten kopiëren voor een goed benutte layer-cache.
COPY package.json package-lock.json ./
RUN npm ci

# Daarna de rest van de broncode.
COPY . .

# SESSION_SECRET is bij het bouwen niet nodig (de sessiesleutel wordt lazy
# opgelost), maar NODE_ENV=production is wél gewenst tijdens de build.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---------------------------------------------------------------------------
# Runtime-stage: minimaal Alpine-image dat als non-root user `node` draait.
# Alleen de standalone-server, statics, public en drizzle-migraties worden
# meegenomen. De native better-sqlite3-module zit al in de getracede
# node_modules van .next/standalone.
# ---------------------------------------------------------------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_PATH=/data/boekhouden.db

# Standalone-output: server.js + getracede node_modules (incl. better-sqlite3
# en de juiste @node-rs/argon2-musl-variant).
COPY --from=builder --chown=node:node /app/.next/standalone ./
# Statische assets en publieke bestanden staan niet in de standalone-output.
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
# SQL-migraties: nodig voor migrate-on-boot (resolved t.o.v. process.cwd()).
COPY --from=builder --chown=node:node /app/drizzle ./drizzle

# Persistente datamap voor de SQLite-database (compose mount ./data hierop).
RUN mkdir -p /data && chown -R node:node /data
VOLUME /data

USER node

EXPOSE 3000

# Migrate + seed draaien bij boot via src/instrumentation.ts (in server.js
# gebundeld). Daarna serveert de standalone Next-server op poort 3000.
CMD ["node", "server.js"]
