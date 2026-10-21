# =============================================================================
# REVOLUTION X — Imagem de PRODUÇÃO (multi-stage)
#
# node:20-slim (LTS) — satisfaz "engines: >=18" do package.json e casa com
# @types/node ^20. Slim (Debian) mantém openssl + ca-certs que a CLI do
# Prisma precisa; sem camadas extras.
#
# Estratégia NÃO INVASIVA: a imagem serve o build com `npm run start`
# (next start, o comando de produção atual do package.json). Não há
# `output: 'standalone'` no next.config.mjs e não o adicionamos — ver
# README-DOCKER.md §Melhorias futuras.
#
# Camadas:
#   deps   → npm ci determinístico (package-lock.json) + prisma generate
#   build  → next build (segredos de runtime NUNCA entram na imagem final)
#   runner → imagem mínima com .next + node_modules, usuário não-root
# =============================================================================

##############################
# 1/3 — dependências
##############################
FROM node:20-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# O postinstall (`prisma generate`) precisa do schema + config ANTES do npm ci.
COPY package.json package-lock.json ./
COPY prisma/ ./prisma/
COPY prisma.config.ts ./

# `npm ci` é determinístico (lockfile) — nunca `npm install` em produção.
RUN npm ci

##############################
# 2/3 — build
##############################
FROM node:20-slim AS build
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./

# Contexto completo (limitado por .dockerignore — sem .env, node_modules, .git).
COPY . .

# Variáveis NEXT_PUBLIC_* são INLINE-ADAS no bundle client no build (comportamento
# do Next.js) — recebem-se via ARG e só existem nesta camada intermediária.
# DATABASE_URL/DIRECT_URL podem ser lidas no build; nunca chegam ao runner.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG DATABASE_URL
ARG DIRECT_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL \
    DATABASE_URL=$DATABASE_URL \
    DIRECT_URL=$DIRECT_URL

RUN npm run build

##############################
# 3/3 — runner (imagem final)
##############################
FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000

# Só o essencial para `next start` + operações de runtime (migrate/persist).
COPY --from=deps /app/node_modules ./node_modules
# DESTINO EXPLÍCITO (.next): `COPY --from=build /app/.next ./` (destino `./`
# = WORKDIR) espalha o CONTEÚDO do .next direto em /app em vez de criar
# /app/.next, deixando a imagem sem BUILD_ID e `next start` crash-loopando.
# Com destino `.next` o conteúdo entra em /app/.next corretamente.
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.mjs ./
COPY --from=build /app/package.json ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/.env.example ./.env.example

# Prisma/Next podem escrever cache em runtime.
RUN mkdir -p .next/cache && chown -R node:node /app

# Usuário não-root já presente na imagem (uid 1000).
USER node

EXPOSE 3000

# Liveness: GET / (landing pública, sem auth). Verifica o processo, não o banco.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "const p=process.env.PORT||3000;require('http').get('http://127.0.0.1:'+p+'/',r=>{process.exit(r.statusCode>=200&&r.statusCode<500?0:1)}).on('error',()=>process.exit(1))"

CMD ["npm", "run", "start"]
