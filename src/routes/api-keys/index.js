"use strict";

module.exports = async (app) => {
  // Schema para criação de API key
  const createKeySchema = {
    body: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", minLength: 3, maxLength: 100 },
        type: {
          type: "string",
          enum: ["basic", "premium", "unlimited"],
          default: "basic",
        },
        requests_per_minute: { type: "integer", minimum: 0, maximum: 10000 },
        description: { type: "string", maxLength: 500 },
      },
    },
  };

  // Middleware de autorização admin (apenas para keys unlimited)
  const requireAdmin = async (request, reply) => {
    if (request.apiKey.type !== "unlimited") {
      return reply.code(403).send({
        error: "Forbidden",
        message: "Apenas API keys unlimited podem gerenciar outras keys",
      });
    }
  };

  // POST /api-keys - Criar nova API key (apenas admin)
  app.route({
    method: "POST",
    url: "/",
    schema: createKeySchema,
    preHandler: requireAdmin,
    handler: async (request, reply) => {
      try {
        const { name, type, requests_per_minute, description } = request.body;

        // Verifica se já existe uma key com esse nome
        const existingKeys = await app.apiKeyService.listKeys();
        const nameExists = existingKeys.some(
          (key) => key.name.toLowerCase() === name.toLowerCase()
        );

        if (nameExists) {
          return reply.code(409).send({
            error: "Conflict",
            message: "Já existe uma API key com esse nome",
          });
        }

        // Cria a nova key
        const newKey = await app.apiKeyService.createApiKey({
          name,
          type,
          requests_per_minute,
          description,
        });

        app.log.info("Nova API key criada", {
          created_by: request.apiKey.name,
          new_key_name: newKey.name,
          new_key_type: newKey.type,
        });

        return reply.code(201).send({
          success: true,
          message: "API key criada com sucesso",
          data: {
            id: newKey.id,
            api_key: newKey.api_key, // Retorna apenas na criação
            name: newKey.name,
            type: newKey.type,
            requests_per_minute: newKey.requests_per_minute,
            created_at: newKey.created_at,
          },
        });
      } catch (error) {
        app.log.error("Erro ao criar API key:", error);

        return reply.code(500).send({
          error: "Internal Server Error",
          message: error.message,
        });
      }
    },
  });

  // GET /api-keys - Listar todas as API keys (apenas admin)
  app.route({
    method: "GET",
    url: "/",
    preHandler: requireAdmin,
    handler: async (request, reply) => {
      try {
        const keys = await app.apiKeyService.listKeys();

        return reply.send({
          success: true,
          data: keys,
          total: keys.length,
        });
      } catch (error) {
        app.log.error("Erro ao listar API keys:", error);

        return reply.code(500).send({
          error: "Internal Server Error",
          message: error.message,
        });
      }
    },
  });

  // GET /api-keys/current - Informações da API key atual
  app.route({
    method: "GET",
    url: "/current",
    handler: async (request, reply) => {
      try {
        const apiKey = request.apiKey;

        // Busca informações completas da key
        const keys = await app.apiKeyService.listKeys();
        const currentKey = keys.find((k) => k.id === apiKey.id);

        if (!currentKey) {
          return reply.code(404).send({
            error: "Not Found",
            message: "API key não encontrada",
          });
        }

        return reply.send({
          success: true,
          data: {
            id: currentKey.id,
            name: currentKey.name,
            type: currentKey.type,
            requests_per_minute: currentKey.requests_per_minute,
            is_active: currentKey.is_active,
            description: currentKey.description,
            created_at: currentKey.created_at,
            last_used_at: currentKey.last_used_at,
          },
        });
      } catch (error) {
        app.log.error("Erro ao buscar API key atual:", error);

        return reply.code(500).send({
          error: "Internal Server Error",
          message: error.message,
        });
      }
    },
  });

  // PUT /api-keys/:id/deactivate - Desativar API key (apenas admin)
  app.route({
    method: "PUT",
    url: "/:id/deactivate",
    schema: {
      params: {
        type: "object",
        properties: {
          id: { type: "integer" },
        },
      },
    },
    preHandler: requireAdmin,
    handler: async (request, reply) => {
      try {
        const { id } = request.params;

        // Não permite desativar a própria key
        if (id === request.apiKey.id) {
          return reply.code(400).send({
            error: "Bad Request",
            message: "Não é possível desativar sua própria API key",
          });
        }

        const deactivatedKey = await app.apiKeyService.deactivateKey(id);

        if (!deactivatedKey) {
          return reply.code(404).send({
            error: "Not Found",
            message: "API key não encontrada",
          });
        }

        app.log.info("API key desativada", {
          deactivated_by: request.apiKey.name,
          deactivated_key_id: id,
          deactivated_key_name: deactivatedKey.name,
        });

        return reply.send({
          success: true,
          message: "API key desativada com sucesso",
          data: {
            id: deactivatedKey.id,
            name: deactivatedKey.name,
            is_active: deactivatedKey.is_active,
          },
        });
      } catch (error) {
        app.log.error("Erro ao desativar API key:", error);

        return reply.code(500).send({
          error: "Internal Server Error",
          message: error.message,
        });
      }
    },
  });

  // GET /api-keys/types - Lista os tipos de API keys disponíveis
  app.route({
    method: "GET",
    url: "/types",
    handler: async (request, reply) => {
      const types = [
        {
          type: "basic",
          name: "Básica",
          default_limit: 10,
          description: "Para uso básico e testes",
        },
        {
          type: "premium",
          name: "Premium",
          default_limit: 100,
          description: "Para uso comercial com limite ampliado",
        },
        {
          type: "unlimited",
          name: "Ilimitada",
          default_limit: 0,
          description: "Sem limites, para administradores e parceiros",
        },
      ];

      return reply.send({
        success: true,
        data: types,
      });
    },
  });
};
