# ===========================================
# STAGE 1: Dependencies
# ===========================================
ARG NODE_VERSION=18-alpine
FROM node:${NODE_VERSION} AS dependencies

# Instala dependências do sistema necessárias para Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    freetype-dev \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dumb-init

# Define diretório de trabalho
WORKDIR /app

# Copia arquivos de dependências
COPY package*.json ./

# Instala apenas dependências de produção
RUN npm ci --only=production && \
    npm cache clean --force

# ===========================================
# STAGE 2: Build
# ===========================================
FROM node:${NODE_VERSION} AS build

WORKDIR /app

# Copia arquivos de dependências
COPY package*.json ./

# Instala todas as dependências (incluindo dev)
RUN npm ci

# Copia código fonte
COPY . .

# Remove arquivos desnecessários
RUN rm -rf .git .github .vscode tests coverage \
    && find . -name "*.test.js" -delete \
    && find . -name "*.spec.js" -delete

# ===========================================
# STAGE 3: Production
# ===========================================
FROM node:${NODE_VERSION} AS production

# Instala apenas o necessário para runtime
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    dumb-init \
    tini \
    && rm -rf /var/cache/apk/*

# Cria usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copia dependências do stage 1
COPY --from=dependencies --chown=nodejs:nodejs /app/node_modules ./node_modules

# Copia código buildado do stage 2
COPY --from=build --chown=nodejs:nodejs /app/src ./src
COPY --from=build --chown=nodejs:nodejs /app/config ./config
COPY --from=build --chown=nodejs:nodejs /app/app.js ./
COPY --from=build --chown=nodejs:nodejs /app/package*.json ./

# Cria diretórios necessários
RUN mkdir -p cache logs uploads custom-templates \
    && chown -R nodejs:nodejs cache logs uploads custom-templates

# Configura Puppeteer para usar Chromium do sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); });"

# Expõe porta
EXPOSE 4000

# Muda para usuário não-root
USER nodejs

# Labels para metadata
LABEL maintainer="Papyrus Team <dev@papyrus.api>" \
    version="1.0.0" \
    description="Papyrus PDF Generation API" \
    org.opencontainers.image.source="https://github.com/keverupp/papyrus-api" \
    org.opencontainers.image.vendor="Papyrus" \
    org.opencontainers.image.title="Papyrus API" \
    org.opencontainers.image.description="Open-source PDF generation API with customizable templates" \
    org.opencontainers.image.version="1.0.0" \
    org.opencontainers.image.created="${BUILD_DATE}" \
    org.opencontainers.image.revision="${VCS_REF}" \
    com.centurylinklabs.watchtower.enable="true" \
    portainer.webhook="true"

# Usa dumb-init para gerenciar processos corretamente
ENTRYPOINT ["dumb-init", "--"]

# Comando para iniciar a aplicação
CMD ["node", "app.js"]