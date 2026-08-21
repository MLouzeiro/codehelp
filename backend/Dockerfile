# =============================================================================
# Dockerfile — CodeHelp Backend (Fly.io)
# Multi-stage build para imagem otimizada
# =============================================================================

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar package.json e package-lock.json
COPY backend/package.json backend/package-lock.json* ./

# Instalar dependencias
RUN npm install

# Copiar Prisma schema e gerar client
COPY backend/prisma ./prisma
RUN npx prisma generate

# Copiar codigo-fonte
COPY backend/src ./src
COPY backend/tsconfig.json ./

# Compilar TypeScript
RUN npx tsc

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

# Instalar dependencias de producao
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev

# Copiar Prisma schema e gerar client
COPY backend/prisma ./prisma
RUN npx prisma generate

# Copiar build compilado
COPY --from=builder /app/dist ./dist

# Copiar arquivos estaticos necessarios
COPY backend/storage ./storage

# Criar diretorios para uploads e sessoes
RUN mkdir -p /app/storage/uploads /app/storage/pdfs /app/whatsapp-session

# Porta padrao
EXPOSE 3010

# Comando de inicializacao
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/server.js"]
