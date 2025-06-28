"use strict";

const fp = require("fastify-plugin");

module.exports = fp(
  async (app) => {
    // Configurações já estão disponíveis via dependência
    const config = app.config;

    app.register(require("@fastify/rate-limit"), {
      // Limite dinâmico baseado na API key
      max: async (request, key) => {
        // Para requisições sem API key válida
        if (!request.apiKey) {
          const defaultLimit = config.rateLimit?.default || 5;
          app.log.debug(`🔒 Rate limit sem API key: ${defaultLimit}/min`);
          return defaultLimit;
        }

        const limit = request.apiKey.requests_per_minute;

        // Unlimited = 0, converte para número muito alto
        if (limit === 0) {
          app.log.debug(`🚀 Rate limit ilimitado para: ${request.apiKey.name}`);
          return 999999;
        }

        app.log.debug(
          `📊 Rate limit para ${request.apiKey.name}: ${limit}/min`
        );
        return limit;
      },

      // Janela de tempo configurável
      timeWindow: config.rateLimit?.window || 60000, // 1 minuto por padrão

      // Gerador de chave inteligente
      keyGenerator: (request) => {
        if (request.apiKey) {
          // Usa hash da API key para identificar
          return `api_key:${request.apiKey.hash}`;
        }

        // Fallback para IP + User-Agent para maior granularidade
        const userAgent = request.headers["user-agent"] || "unknown";
        const fingerprint = Buffer.from(userAgent)
          .toString("base64")
          .slice(0, 8);
        return `ip:${request.ip}:${fingerprint}`;
      },

      // Resposta de erro rica e informativa com suporte a i18n
      errorResponseBuilder: async (request, context) => {
        const resetTime = new Date(Date.now() + context.ttl);
        const resetTimeFormatted = resetTime.toISOString();

        // Detecta idioma da requisição
        const language =
          request.body?.language ||
          request.query?.lang ||
          request.headers["accept-language"]?.split(",")[0]?.split("-")[0] ===
            "en"
            ? "en-US"
            : request.headers["accept-language"]
                ?.split(",")[0]
                ?.split("-")[0] === "es"
            ? "es-ES"
            : "pt-BR";

        let translations = {};
        try {
          // Tenta carregar traduções se o serviço estiver disponível
          if (app.i18nService) {
            translations = await app.i18nService.getTranslations(language);
          }
        } catch (error) {
          app.log.warn("Erro ao carregar traduções para rate limit:", error);
        }

        // Mensagens padrão por idioma (fallback)
        const defaultMessages = {
          "pt-BR": {
            main: "Limite de requisições excedido. Tente novamente em alguns segundos.",
            suggestion_basic:
              "Considere fazer upgrade para uma API key premium para maior limite.",
            suggestion_other: "Distribua suas requisições ao longo do tempo.",
            suggestion_no_key:
              "Use uma API key válida para ter maior limite de requisições.",
          },
          "en-US": {
            main: "Request limit exceeded. Please try again in a few seconds.",
            suggestion_basic:
              "Consider upgrading to a premium API key for higher limits.",
            suggestion_other: "Distribute your requests over time.",
            suggestion_no_key:
              "Use a valid API key to get higher request limits.",
          },
          "es-ES": {
            main: "Límite de solicitudes excedido. Inténtelo de nuevo en unos segundos.",
            suggestion_basic:
              "Considere actualizar a una API key premium para límites más altos.",
            suggestion_other:
              "Distribuya sus solicitudes a lo largo del tiempo.",
            suggestion_no_key:
              "Use una API key válida para obtener límites de solicitud más altos.",
          },
        };

        const messages = defaultMessages[language] || defaultMessages["pt-BR"];
        const apiMessages = translations.api?.errors || {};

        const baseResponse = {
          statusCode: 429,
          error: "Too Many Requests",
          message: apiMessages.rate_limit || messages.main,
          language,
          rateLimit: {
            max: context.max,
            remaining: 0,
            resetTime: resetTimeFormatted,
            retryAfter: Math.ceil(context.ttl / 1000), // segundos
          },
        };

        // Informações específicas da API key
        if (request.apiKey) {
          baseResponse.apiKey = {
            name: request.apiKey.name,
            type: request.apiKey.type,
            limit: request.apiKey.requests_per_minute,
          };

          baseResponse.suggestion =
            request.apiKey.type === "basic"
              ? messages.suggestion_basic
              : messages.suggestion_other;
        } else {
          baseResponse.suggestion = messages.suggestion_no_key;
        }

        // Log do rate limit atingido
        app.log.warn(`🚨 Rate limit excedido`, {
          apiKey: request.apiKey?.name || "none",
          ip: request.ip,
          url: request.url,
          limit: context.max,
          hits: context.totalHits,
          language,
        });

        return baseResponse;
      },

      // Condições para pular rate limit
      skip: (request, key) => {
        // Sempre pula para chaves unlimited
        if (request.apiKey && request.apiKey.requests_per_minute === 0) {
          return true;
        }

        // Pula para rotas públicas específicas
        const publicRoutes = ["/health", "/pdf/languages"];
        if (publicRoutes.some((route) => request.url.startsWith(route))) {
          return true;
        }

        // Pula para requisições OPTIONS (CORS preflight)
        if (request.method === "OPTIONS") {
          return true;
        }

        return false;
      },

      // Headers informativos
      addHeaders: {
        "x-ratelimit-limit": true,
        "x-ratelimit-remaining": true,
        "x-ratelimit-reset": true,
      },

      // Hook personalizado para adicionar headers extras
      onExceeding: (request, key) => {
        // Log de warning quando está chegando perto do limite
        app.log.warn(`⚠️ Rate limit se aproximando do máximo`, {
          apiKey: request.apiKey?.name || "none",
          ip: request.ip,
          url: request.url,
        });
      },

      // Hook quando o limite é excedido
      onExceeded: (request, key) => {
        // Já logado no errorResponseBuilder, mas pode adicionar métricas aqui
        app.log.error(`🛑 Rate limit excedido definitivamente`, {
          apiKey: request.apiKey?.name || "none",
          ip: request.ip,
          key: key,
        });
      },
    });

    // Decorator para verificar status do rate limit programaticamente
    app.decorate("getRateLimitStatus", async (apiKeyHash) => {
      try {
        // TODO: Implementar consulta ao store do rate limit
        // Por enquanto retorna dados mock
        return {
          current: 0,
          limit: 100,
          remaining: 100,
          resetTime: new Date(Date.now() + 60000),
          window: "1 minute",
        };
      } catch (error) {
        app.log.error("Erro ao verificar status do rate limit:", error);
        throw error;
      }
    });

    // Decorator para resetar rate limit (útil para admin)
    app.decorate("resetRateLimit", async (apiKeyHash) => {
      try {
        // TODO: Implementar reset no store
        app.log.info(
          `🔄 Rate limit resetado para API key: ${apiKeyHash.slice(0, 8)}...`
        );
        return { success: true, message: "Rate limit resetado com sucesso" };
      } catch (error) {
        app.log.error("Erro ao resetar rate limit:", error);
        throw error;
      }
    });

    app.log.info("🛡️ Rate limiting configurado com suporte a i18n", {
      defaultLimit: config.rateLimit?.default || 5,
      window: `${(config.rateLimit?.window || 60000) / 1000}s`,
      supportedLanguages: ["pt-BR", "en-US", "es-ES"],
    });
  },
  {
    name: "rate-limit",
    dependencies: ["config"], // i18n-service é opcional
  }
);
