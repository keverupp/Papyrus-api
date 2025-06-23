"use strict";

const fp = require("fastify-plugin");

module.exports = fp(async (app) => {
  app.register(require("@fastify/rate-limit"), {
    max: async (request, key) => {
      // Se não tem API key, usa limite baixo padrão
      if (!request.apiKey) {
        return 5; // Muito restritivo para requisições sem API key válida
      }

      // Retorna o limite específico da API key
      const limit = request.apiKey.requests_per_minute;

      // Se é 0, significa unlimited
      return limit === 0 ? false : limit;
    },

    timeWindow: "1 minute",

    // Usa a API key como identificador ao invés do IP
    keyGenerator: (request) => {
      if (request.apiKey) {
        return `api_key:${request.apiKey.hash}`;
      }

      // Fallback para IP se não tiver API key válida
      return `ip:${request.ip}`;
    },

    // Mensagem de erro personalizada
    errorResponseBuilder: (request, context) => {
      const keyInfo = request.apiKey
        ? {
            api_key_name: request.apiKey.name,
            api_key_type: request.apiKey.type,
            requests_per_minute: request.apiKey.requests_per_minute,
          }
        : {};

      return {
        statusCode: 429,
        error: "Too Many Requests",
        message: "Limite de requisições excedido",
        details: {
          ...keyInfo,
          ttl: context.ttl, // Tempo até reset em ms
          max: context.max, // Limite máximo
          totalHits: context.totalHits, // Total de requests feitas
        },
      };
    },

    // Skip rate limit para algumas situações
    skip: (request, key) => {
      // Pula para chaves unlimited (requests_per_minute = 0)
      if (request.apiKey && request.apiKey.requests_per_minute === 0) {
        return true;
      }

      // Pula para rotas de health check
      if (request.url.startsWith("/health")) {
        return true;
      }

      return false;
    },

    // Headers personalizados
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
  });

  // Decorator para verificar limites programaticamente
  app.decorate("checkRateLimit", async (apiKeyHash) => {
    try {
      // Implementar lógica para verificar limite atual da key
      // Útil para dashboards ou monitoramento
      return {
        current: 0, // requests atuais no minuto
        limit: 100, // limite da key
        reset_time: new Date(),
      };
    } catch (error) {
      app.log.error("Erro ao verificar rate limit:", error);
      throw error;
    }
  });
});
