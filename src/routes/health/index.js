"use strict";

module.exports = async (app) => {
  // Health check básico
  app.route({
    method: "GET",
    url: "/",
    handler: async (request, reply) => {
      try {
        // Testa conexão com banco
        await app.knex.raw("SELECT 1");

        // Testa engine typst
        await app.typstEngine.checkEngine();

        return reply.send({
          status: "healthy",
          timestamp: new Date().toISOString(),
          version: "1.0.0",
          services: {
            database: "connected",
            pdf_engine: "ready",
            templates: "loaded",
          },
        });
      } catch (error) {
        app.log.error("Health check failed:", error);

        return reply.code(503).send({
          status: "unhealthy",
          timestamp: new Date().toISOString(),
          error: error.message,
          services: {
            database: "disconnected",
            pdf_engine: "error",
            templates: "error",
          },
        });
      }
    },
  });

  // Status detalhado dos services
  app.route({
    method: "GET",
    url: "/detailed",
    handler: async (request, reply) => {
      const services = {};

      // Testa banco
      try {
        const result = await app.knex.raw(
          "SELECT COUNT(*) as count FROM api_keys"
        );
        services.database = {
          status: "connected",
          api_keys_count: parseInt(result.rows[0].count),
        };
      } catch (error) {
        services.database = {
          status: "error",
          error: error.message,
        };
      }

      // Testa templates
      try {
        const templates = await app.templateService.getAvailableTemplates();
        services.templates = {
          status: "loaded",
          total_templates: Object.values(templates).flat().length,
          categories: Object.keys(templates),
        };
      } catch (error) {
        services.templates = {
          status: "error",
          error: error.message,
        };
      }

      // Testa PDF engine
      try {
        await app.typstEngine.checkEngine();
        services.pdf_engine = {
          status: "ready",
          engine: "typst",
        };
      } catch (error) {
        services.pdf_engine = {
          status: "error",
          error: error.message,
        };
      }

      const allHealthy = Object.values(services).every(
        (service) =>
          service.status === "connected" ||
          service.status === "loaded" ||
          service.status === "ready"
      );

      return reply.code(allHealthy ? 200 : 503).send({
        status: allHealthy ? "healthy" : "partial",
        timestamp: new Date().toISOString(),
        services,
      });
    },
  });
};
