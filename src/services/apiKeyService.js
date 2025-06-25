"use strict";

const fp = require("fastify-plugin");
const crypto = require("crypto");

module.exports = fp(
  async (app) => {
    app.decorate("apiKeyService", {
      generateKey: generateKey,
      createApiKey: createApiKey,
      validateKey: validateKey,
      updateLastUsed: updateLastUsed,
      listKeys: listKeys,
      deactivateKey: deactivateKey,
      hashApiKey: hashApiKey,
    });

    /**
     * Gera uma nova API key aleatória
     */
    function generateKey() {
      return crypto.randomBytes(32).toString("hex");
    }

    /**
     * Gera hash da API key para armazenar no banco (reutilizável)
     */
    function hashApiKey(apiKey) {
      return crypto.createHash("sha256").update(apiKey).digest("hex");
    }

    /**
     * Cria uma nova API key no banco
     */
    async function createApiKey(data) {
      const {
        name,
        type = "basic",
        requests_per_minute = 10,
        description,
      } = data;

      // Gera a key
      const apiKey = generateKey();

      // Hash da key para armazenar no banco (segurança)
      const keyHash = hashApiKey(apiKey);

      // Define limites por tipo
      const limits = {
        basic: 10,
        premium: 100,
        unlimited: 0, // 0 = sem limite
      };

      const finalLimit = requests_per_minute || limits[type] || 10;

      try {
        const [result] = await app
          .knex("api_keys")
          .insert({
            key_hash: keyHash,
            name,
            type,
            requests_per_minute: finalLimit,
            description,
            is_active: true,
            created_at: new Date(),
            updated_at: new Date(),
          })
          .returning("*");

        app.log.info("Nova API key criada", {
          id: result.id,
          name: result.name,
          type: result.type,
          limit: result.requests_per_minute,
        });

        return {
          id: result.id,
          api_key: apiKey, // Retorna só na criação
          name: result.name,
          type: result.type,
          requests_per_minute: result.requests_per_minute,
          created_at: result.created_at,
        };
      } catch (error) {
        app.log.error("Erro ao criar API key:", error);
        throw new Error(`Erro ao criar API key: ${error.message}`);
      }
    }

    /**
     * Valida uma API key e retorna dados da key
     */
    async function validateKey(apiKey) {
      if (!apiKey) return null;

      const keyHash = hashApiKey(apiKey);

      try {
        const keyData = await app
          .knex("api_keys")
          .where({ key_hash: keyHash, is_active: true })
          .first();

        if (keyData) {
          app.log.debug("API key validada com sucesso", {
            id: keyData.id,
            name: keyData.name,
            type: keyData.type,
          });
        }

        return keyData || null;
      } catch (error) {
        app.log.error("Erro ao validar API key:", error);
        return null;
      }
    }

    /**
     * Atualiza o último uso da key
     */
    async function updateLastUsed(keyHash) {
      try {
        await app.knex("api_keys").where({ key_hash: keyHash }).update({
          last_used_at: new Date(),
          updated_at: new Date(),
        });

        app.log.debug("Último uso da API key atualizado", {
          key_hash_preview: keyHash.slice(0, 8) + "...",
        });
      } catch (error) {
        app.log.error("Erro ao atualizar último uso:", error);
        // Não joga erro para não quebrar o fluxo principal
      }
    }

    /**
     * Lista todas as keys (sem mostrar a key real)
     */
    async function listKeys() {
      try {
        const keys = await app
          .knex("api_keys")
          .select(
            "id",
            "name",
            "type",
            "requests_per_minute",
            "is_active",
            "description",
            "created_at",
            "last_used_at",
            "updated_at"
          )
          .orderBy("created_at", "desc");

        app.log.debug("API keys listadas", { count: keys.length });

        return keys;
      } catch (error) {
        app.log.error("Erro ao listar API keys:", error);
        throw new Error(`Erro ao listar API keys: ${error.message}`);
      }
    }

    /**
     * Desativa uma API key
     */
    async function deactivateKey(keyId) {
      try {
        const [result] = await app
          .knex("api_keys")
          .where({ id: keyId })
          .update({
            is_active: false,
            updated_at: new Date(),
          })
          .returning("*");

        if (result) {
          app.log.info("API key desativada", {
            id: result.id,
            name: result.name,
          });
        }

        return result;
      } catch (error) {
        app.log.error("Erro ao desativar API key:", error);
        throw new Error(`Erro ao desativar API key: ${error.message}`);
      }
    }

    app.log.info("🔑 API Key Service registrado");
  },
  {
    name: "api-key-service", // ← Nome correto do plugin
    dependencies: ["knex"], // Depende do plugin knex
  }
);
