# Etapa 1: Build do Frontend (Vite)
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

# Etapa 2: Build do Backend (Node/Fastify)
FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa 3: Produção
FROM node:20-bookworm-slim AS runner

# Instalar dependências para o Puppeteer (Chromium), conversão de vídeo (FFMPEG) e display virtual (xvfb)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libnss3 \
    libasound2 \
    ffmpeg \
    xvfb \
    xauth \
    libgbm1 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    DISPLAY=:99

WORKDIR /app

# Copiar arquivos do backend
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/package*.json ./

# Instalar dependências de produção do backend
RUN npm ci --omit=dev

# Copiar o build do frontend para a pasta 'public' servida pelo Fastify
COPY --from=frontend-builder /app/frontend/dist ./public

# Variáveis de Ambiente base
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["sh", "-c", "Xvfb :99 -screen 0 1280x720x24 -ac -nolisten tcp & sleep 1 && node dist/server.js"]
