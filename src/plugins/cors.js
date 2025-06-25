"use strict";

const fp = require("fastify-plugin");

module.exports = fp(
  async (app) => {
    const origin = app.config?.security?.corsOrigin || "*";

    app.register(require("@fastify/cors"), {
      origin,
    });
  },
  { name: "cors", dependencies: ["config"] }
);
