"use strict";

const fp = require("fastify-plugin");

module.exports = fp(async (app) => {
  // Hook que roda antes de todas as requisições para verificar API key
  app.addHook("onRequest", async (request, reply) => {
    // Rotas que não precisam de API key (se houver)
    const publicRoutes = ["/health", "/docs", "/swagger"];

    // Verifica se é uma rota pública
    const isPublicRoute = publicRoutes.some((route) =>
      request.url.startsWith(route)
    );

    if (isPublicRoute) {
      return; // Pula verificação para rotas públicas
    }

    try {
      // Busca API key no header
      const apiKey = request.headers["x-api-key"];

      if (!apiKey) {
        return reply.code(401).send({
          error: "API Key Required",
          message: "Header x-api-key é obrigatório",
        });
      }

      // Valida a API key usando o service
      const keyData = await app.apiKeyService.validateKey(apiKey);

      if (!keyData) {
        return reply.code(401).send({
          error: "Invalid API Key",
          message: "API key inválida ou inativa",
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

      // Atualiza último uso da key (async, não bloqueia)
      app.apiKeyService
        .updateLastUsed(keyData.key_hash)
        .catch((err) => app.log.error("Erro ao atualizar último uso:", err));
    } catch (error) {
      app.log.error("Erro na verificação de API key:", error);

      return reply.code(500).send({
        error: "Internal Server Error",
        message: "Erro interno na verificação da API key",
      });
    }
  });

  // Hook para log de requisições com API key
  app.addHook("onResponse", async (request, reply) => {
    if (request.apiKey) {
      app.log.info(
        {
          api_key_name: request.apiKey.name,
          api_key_type: request.apiKey.type,
          method: request.method,
          url: request.url,
          status_code: reply.statusCode,
          response_time: reply.elapsedTime,
        },
        "API Request completed"
      );
    }
  });
});
