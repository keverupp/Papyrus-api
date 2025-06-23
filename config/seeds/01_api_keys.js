const crypto = require("crypto");

/**
 * Gera uma API key aleatória
 */
function generateApiKey() {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Gera hash da API key para armazenar no banco
 */
function hashApiKey(apiKey) {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

exports.seed = async function (knex) {
  // Limpa tabela existente
  await knex("api_keys").del();

  // API Keys de exemplo
  const apiKeys = [
    {
      name: "Demo Key",
      type: "basic",
      requests_per_minute: 10,
      description: "Chave de demonstração para testes básicos",
      is_active: true,
    },
    {
      name: "Premium Test",
      type: "premium",
      requests_per_minute: 100,
      description: "Chave premium para testes avançados",
      is_active: true,
    },
    {
      name: "Unlimited Dev",
      type: "unlimited",
      requests_per_minute: 0, // 0 = sem limite
      description: "Chave ilimitada para desenvolvimento",
      is_active: true,
    },
    {
      name: "Educational Free",
      type: "basic",
      requests_per_minute: 20,
      description: "Chave para instituições educacionais",
      is_active: true,
    },
    {
      name: "Business Starter",
      type: "premium",
      requests_per_minute: 50,
      description: "Chave para pequenas empresas",
      is_active: true,
    },
  ];

  // Gera as API keys e insere no banco
  const keysToInsert = [];
  const generatedKeys = [];

  for (const keyData of apiKeys) {
    const apiKey = generateApiKey();
    const keyHash = hashApiKey(apiKey);

    keysToInsert.push({
      key_hash: keyHash,
      name: keyData.name,
      type: keyData.type,
      requests_per_minute: keyData.requests_per_minute,
      description: keyData.description,
      is_active: keyData.is_active,
      created_at: new Date(),
      updated_at: new Date(),
    });

    // Salva a key gerada para exibir no console
    generatedKeys.push({
      name: keyData.name,
      type: keyData.type,
      api_key: apiKey,
      requests_per_minute: keyData.requests_per_minute,
    });
  }

  // Insere no banco
  await knex("api_keys").insert(keysToInsert);

  // Exibe as keys geradas no console para facilitar os testes
  console.log("\n🔑 API Keys geradas com sucesso!\n");
  console.log("=".repeat(80));

  generatedKeys.forEach((key) => {
    console.log(`📛 Nome: ${key.name}`);
    console.log(`🏷️  Tipo: ${key.type}`);
    console.log(
      `⚡ Limite: ${
        key.requests_per_minute === 0
          ? "Ilimitado"
          : key.requests_per_minute + " req/min"
      }`
    );
    console.log(`🔐 API Key: ${key.api_key}`);
    console.log("-".repeat(80));
  });

  console.log(
    '\n💡 Use essas API keys no header "x-api-key" para testar a API'
  );
  console.log("📖 Exemplo de teste:");
  console.log(`curl -X GET http://localhost:4000/pdf/templates \\`);
  console.log(`  -H "x-api-key: ${generatedKeys[0].api_key}"`);
  console.log("\n");
};
