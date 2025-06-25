"use strict";

const path = require("path");
const autoload = require("@fastify/autoload");

const fastify = require("fastify");

const app = fastify({
  logger: {
    level: "info",
  },
});

app.register(autoload, {
  dir: path.join(__dirname, "src/plugins"),
});

app.register(autoload, {
  dir: path.join(__dirname, "src/hooks"),
});

app.register(autoload, {
  dir: path.join(__dirname, "src/services"),
});

app.register(autoload, {
  dir: path.join(__dirname, "src/routes"),
});

app
  .listen({ host: "0.0.0.0", port: 4000 })
  .then((address) => {
    console.log(`🚀 Servidor rodando em: ${address}`);
  })
  .catch((err) => {
    console.error("❌ Erro ao iniciar o servidor:", err);
    process.exit(1);
  });
