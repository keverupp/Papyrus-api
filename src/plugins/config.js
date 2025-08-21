"use strict";

const fp = require("fastify-plugin");

module.exports = fp(
  async (app) => {
    // Carrega configurações do .env e define defaults
    const config = {
      // Servidor
      server: {
        port: parseInt(process.env.PORT) || 4000,
        host: process.env.HOST || "0.0.0.0",
        env: process.env.NODE_ENV || "development",
      },

      // Banco de dados
      database: {
        client: process.env.DB_CLIENT || "pg",
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT) || 5432,
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "",
        database: process.env.DB_DATABASE || "papyrus",
      },

      // Rate limiting
      rateLimit: {
        default: parseInt(process.env.RATE_LIMIT_DEFAULT) || 5,
        window: parseInt(process.env.RATE_LIMIT_WINDOW) || 60000, // 1 minuto
      },

      // PDF Generation
      pdf: {
        engine: process.env.PDF_ENGINE || "puppeteer",
        timeout: parseInt(process.env.PDF_TIMEOUT) || 30000,
        quality: process.env.PDF_QUALITY || "high",
      },

      // Cache
      cache: {
        templates: process.env.CACHE_TEMPLATES === "true",
        duration: parseInt(process.env.CACHE_DURATION) || 30000,
      },

      // Logging
      logging: {
        level: process.env.LOG_LEVEL || "debug",
        toFile: process.env.LOG_TO_FILE === "true",
      },

      // Security
      security: {
        corsOrigin: process.env.CORS_ORIGIN || "*",
        helmetEnabled: process.env.HELMET_ENABLED !== "false",
      },

      // JWT
      jwt: {
        secret: process.env.JWT_SECRET || "secret",
      },

      // Performance
      performance: {
        compression: process.env.ENABLE_COMPRESSION !== "false",
      },

      // API Keys administrativas (para seeds/bootstrap)
      adminKeys: process.env.ADMIN_API_KEYS
        ? process.env.ADMIN_API_KEYS.split(",").map((keyPair) => {
            const [key, limit] = keyPair.split(":");
            return {
              key: key.trim(),
              limit: parseInt(limit) || 10,
            };
          })
        : [
            { key: "demo-key", limit: 10 },
            { key: "premium-key", limit: 100 },
            { key: "unlimited-key", limit: 0 },
          ],
    };

    // Valida configurações críticas
    validateConfig(config, app);

    // Decora o Fastify com as configurações
    app.decorate("config", config);

    // Ajusta o nível do logger conforme configuração
    app.log.level = config.logging.level;

    // Log das configurações na inicialização
    app.log.info("📋 Configurações carregadas:", {
      env: config.server.env,
      port: config.server.port,
      database: config.database.database,
      pdfEngine: config.pdf.engine,
      cacheEnabled: config.cache.templates,
      compressionEnabled: config.performance.compression,
    });
  },
  {
    name: "config", // ← ESTA linha estava faltando!
  }
);

/**
 * Valida as configurações essenciais
 */
function validateConfig(config, app) {
  const errors = [];

  // Validações críticas
  if (!config.database.database) {
    errors.push("❌ DB_DATABASE é obrigatório");
  }

  if (!config.server.port || config.server.port < 1000) {
    errors.push("❌ PORT deve ser >= 1000");
  }

  if (config.pdf.timeout < 5000) {
    errors.push("⚠️ PDF_TIMEOUT muito baixo, recomendado >= 5000ms");
  }

  // Log de erros ou warnings
  if (errors.length > 0) {
    errors.forEach((error) => {
      if (error.startsWith("❌")) {
        app.log.error(error);
      } else {
        app.log.warn(error);
      }
    });

    // Para em caso de erros críticos
    const criticalErrors = errors.filter((e) => e.startsWith("❌"));
    if (criticalErrors.length > 0) {
      throw new Error(`Configuração inválida: ${criticalErrors.join(", ")}`);
    }
  }

  // Validações de ambiente
  if (config.server.env === "production") {
    if (config.database.password === "") {
      app.log.warn("⚠️ Senha do banco vazia em produção!");
    }

    if (config.security.corsOrigin === "*") {
      app.log.warn("⚠️ CORS aberto (*) em produção!");
    }
  }
}
