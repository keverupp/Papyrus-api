("use strict");

const fp = require("fastify-plugin");

module.exports = fp(
  async (app) => {
    const secret =
      app.config?.jwt?.secret || process.env.JWT_SECRET || "secret";

    app.register(require("@fastify/jwt"), {
      secret,
    });
  },
  {
    name: "jwt",
    dependencies: ["config"],
  }
);
