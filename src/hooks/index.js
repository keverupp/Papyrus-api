"use strict";

const fp = require("fastify-plugin");

module.exports = fp(
  async (app) => {
    // Hook de validação de API key (DEVE ser o primeiro)
    app.addHook("onRequest", async (request, reply) => {
      // Rotas que não precisam de API key (públicas)
      const publicRoutes = ["/health"];

      // Verifica se é uma rota pública
      const isPublicRoute = publicRoutes.some((route) =>
        request.url.startsWith(route)
      );

      if (isPublicRoute) {
        // Para rotas públicas, apenas adiciona startTime
        request.startTime = Date.now();
        return;
      }

      try {
        // Adiciona startTime para todas as requisições
        request.startTime = Date.now();

        // Busca API key no header
        const apiKey = request.headers["x-api-key"];

        if (!apiKey) {
          return reply.code(401).send({
            error: "API Key Required",
            message: "Header x-api-key é obrigatório",
            statusCode: 401,
          });
        }

        // Valida a API key usando o service (verifica se existe)
        if (!app.apiKeyService) {
          app.log.error("apiKeyService não está disponível ainda");
          return reply.code(500).send({
            error: "Internal Server Error",
            message: "Serviço de validação não disponível",
            statusCode: 500,
          });
        }

        const keyData = await app.apiKeyService.validateKey(apiKey);

        if (!keyData) {
          return reply.code(401).send({
            error: "Invalid API Key",
            message: "API key inválida ou inativa",
            statusCode: 401,
          });
        }

        // Adiciona os dados da key na request para uso posterior
        request.apiKey = {
          id: keyData.id,
          hash: keyData.key_hash,
          name: keyData.name,
          type: keyData.type,
          requests_per_minute: keyData.requests_per_minute,
        };

        // Log para debug
        app.log.debug("API key validada com sucesso:", {
          name: keyData.name,
          type: keyData.type,
          id: keyData.id,
        });

        // Atualiza último uso da key (async, não bloqueia)
        app.apiKeyService
          .updateLastUsed(keyData.key_hash)
          .catch((err) =>
            app.log.error("Erro ao atualizar último uso da API key:", err)
          );
      } catch (error) {
        app.log.error("Erro na verificação de API key:", error);

        return reply.code(500).send({
          error: "Internal Server Error",
          message: "Erro interno na verificação da API key",
          statusCode: 500,
        });
      }
    });

    // Hook global para adicionar headers de resposta úteis
    app.addHook("onSend", async (request, reply, payload) => {
      // Adiciona header de tempo de resposta
      if (request.startTime) {
        const responseTime = Date.now() - request.startTime;
        reply.header("x-response-time", `${responseTime}ms`);
      }

      // Adiciona header da versão da API
      reply.header("x-api-version", "1.0.0");

      // Header de segurança adicional
      reply.header("x-powered-by", "Papyrus API");

      return payload;
    });

    // Hook global para log de requests completados
    app.addHook("onResponse", async (request, reply) => {
      const responseTime = Date.now() - (request.startTime || Date.now());

      // Log estruturado da requisição
      app.log.info(
        {
          method: request.method,
          url: request.url,
          statusCode: reply.statusCode,
          responseTime: `${responseTime}ms`,
          userAgent: request.headers["user-agent"] || "unknown",
          ip: request.ip,
          api_key_name: request.apiKey?.name || "none",
          api_key_type: request.apiKey?.type || "none",
        },
        "Request completed"
      );
    });

    // Hook global para tratamento de erros não capturados
    app.addHook("onError", async (request, reply, error) => {
      // Log detalhado do erro
      app.log.error(
        {
          method: request.method,
          url: request.url,
          error: {
            message: error.message,
            stack: error.stack,
            code: error.code,
          },
          apiKey: request.apiKey?.name || "none",
        },
        "Request error occurred"
      );
    });

    app.log.info("🎯 Hooks globais e API key registrados");
  },
  {
    name: "global-hooks",
    // dependencies: ["api-key-service"], // Removido - não podemos garantir ordem com autoload
  }
);
