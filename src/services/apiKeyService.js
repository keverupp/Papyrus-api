"use strict";

const fp = require("fastify-plugin");
const crypto = require("crypto");

module.exports = fp(async (app) => {
  app.decorate("apiKeyService", {
    generateKey: generateKey,
    createApiKey: createApiKey,
    validateKey: validateKey,
    updateLastUsed: updateLastUsed,
    listKeys: listKeys,
    deactivateKey: deactivateKey,
  });

  /**
   * Gera uma nova API key aleatória
   */
  function generateKey() {
    return crypto.randomBytes(32).toString("hex");
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
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

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
        })
        .returning("*");

      return {
        id: result.id,
        api_key: apiKey, // Retorna só na criação
        name: result.name,
        type: result.type,
        requests_per_minute: result.requests_per_minute,
        created_at: result.created_at,
      };
    } catch (error) {
      throw new Error(`Erro ao criar API key: ${error.message}`);
    }
  }

  /**
   * Valida uma API key e retorna dados da key
   */
  async function validateKey(apiKey) {
    if (!apiKey) return null;

    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");

    try {
      const keyData = await app
        .knex("api_keys")
        .where({ key_hash: keyHash, is_active: true })
        .first();

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
      await app
        .knex("api_keys")
        .where({ key_hash: keyHash })
        .update({ last_used_at: new Date() });
    } catch (error) {
      app.log.error("Erro ao atualizar último uso:", error);
    }
  }

  /**
   * Lista todas as keys (sem mostrar a key real)
   */
  async function listKeys() {
    try {
      return await app
        .knex("api_keys")
        .select(
          "id",
          "name",
          "type",
          "requests_per_minute",
          "is_active",
          "description",
          "created_at",
          "last_used_at"
        )
        .orderBy("created_at", "desc");
    } catch (error) {
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
        .update({ is_active: false })
        .returning("*");

      return result;
    } catch (error) {
      throw new Error(`Erro ao desativar API key: ${error.message}`);
    }
  }
});
