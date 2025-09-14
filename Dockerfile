# ===========================================
# STAGE 1: Dependencies
# ===========================================
ARG NODE_VERSION=18-alpine
FROM node:${NODE_VERSION} AS dependencies

# Define diretório de trabalho
WORKDIR /app

# Copia arquivos de dependências
COPY package*.json ./

# Instala apenas dependências de produção
RUN npm install --only=production && npm cache clean --force

# ===========================================
# STAGE 2: Build
# ===========================================
FROM node:${NODE_VERSION} AS build

WORKDIR /app

# Copia arquivos de dependências
COPY package*.json ./

# Instala todas as dependências (incluindo dev)
RUN npm install

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

# Instala o binário do Typst
RUN apk add --no-cache curl tar \
    && curl -L https://github.com/typst/typst/releases/download/v0.11.0/typst-x86_64-unknown-linux-musl.tar.xz \
      | tar -xJ \
    && mv typst-x86_64-unknown-linux-musl/typst /usr/local/bin/typst \
    && chmod +x /usr/local/bin/typst \
    && rm -rf typst-x86_64-unknown-linux-musl

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

# Configuração de ambiente
ENV NODE_ENV=production

# Expõe porta
EXPOSE 4000

# Muda para usuário não-root
USER nodejs

# Comando para iniciar a aplicação
CMD ["node", "app.js"]

