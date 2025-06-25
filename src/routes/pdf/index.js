"use strict";

module.exports = async (app) => {
  // Schema de validação para geração de PDF
  const pdfSchema = {
    body: {
      type: "object",
      required: ["type"],
      properties: {
        type: {
          type: "string",
          enum: [
            "blank",
            "logo",
            "watermark",
            "exam",
            "assessment",
            "quiz",
            "budget",
            "budget-premium",
            "report",
            "invoice",
            "anamnesis",
            "prescription",
            "clinical_form",
          ],
        },
        title: { type: "string" },
        data: { type: "object" },
        config: {
          type: "object",
          properties: {
            format: { type: "string", enum: ["A4", "A5", "Letter", "Legal"] },
            orientation: { type: "string", enum: ["portrait", "landscape"] },
            margin: {
              type: "object",
              properties: {
                top: { type: "string" },
                right: { type: "string" },
                bottom: { type: "string" },
                left: { type: "string" },
              },
            },
          },
        },
      },
    },
  };

  // Rota principal para geração de PDF
  app.route({
    method: "POST",
    url: "/",
    schema: pdfSchema,
    handler: async (request, reply) => {
      try {
        // Valida dados da requisição
        const validation = app.pdfGeneratorService.validatePdfRequest(
          request.body
        );
        if (!validation.isValid) {
          return reply.code(400).send({
            error: "Validation Error",
            message: "Dados da requisição inválidos",
            details: validation.errors,
            statusCode: 400,
          });
        }

        // Log da requisição
        app.log.info("Processando geração de PDF", {
          api_key: request.apiKey?.name || "none",
          template_type: request.body.type,
          title: request.body.title,
        });

        // Gera o PDF usando o service
        const result = await app.pdfGeneratorService.generateFullPDF(
          request.body
        );

        // Headers para download
        reply
          .type(result.contentType)
          .header(
            "Content-Disposition",
            `attachment; filename="${result.filename}"`
          )
          .header("Content-Length", result.buffer.length);

        return reply.send(result.buffer);
      } catch (error) {
        app.log.error("Erro ao gerar PDF:", error);

        return reply.code(500).send({
          error: "PDF Generation Failed",
          message: error.message,
          type: "generation_error",
          statusCode: 500,
        });
      }
    },
  });

  // Rota para listar templates disponíveis
  app.route({
    method: "GET",
    url: "/templates",
    handler: async (request, reply) => {
      try {
        const templates = await app.templateService.getAvailableTemplates();

        return reply.send({
          success: true,
          templates,
          total: Object.values(templates).flat().length,
        });
      } catch (error) {
        app.log.error("Erro ao listar templates:", error);

        return reply.code(500).send({
          error: "Templates List Failed",
          message: error.message,
          statusCode: 500,
        });
      }
    },
  });

  // Rota para visualizar dados de um template específico
  app.route({
    method: "GET",
    url: "/templates/:type",
    schema: {
      params: {
        type: "object",
        properties: {
          type: { type: "string" },
        },
        required: ["type"],
      },
    },
    handler: async (request, reply) => {
      try {
        const { type } = request.params;

        const templateData = await app.templateService.getTemplateData(type);

        if (!templateData) {
          return reply.code(404).send({
            error: "Template Not Found",
            message: `Template '${type}' não encontrado`,
            statusCode: 404,
          });
        }

        return reply.send({
          success: true,
          template: templateData,
        });
      } catch (error) {
        app.log.error("Erro ao buscar template:", error);

        return reply.code(500).send({
          error: "Template Fetch Failed",
          message: error.message,
          statusCode: 500,
        });
      }
    },
  });

  // Rota para preview HTML (útil para debug)
  app.route({
    method: "POST",
    url: "/preview",
    schema: pdfSchema,
    handler: async (request, reply) => {
      try {
        // Valida dados da requisição
        const validation = app.pdfGeneratorService.validatePdfRequest(
          request.body
        );
        if (!validation.isValid) {
          return reply.code(400).send({
            error: "Validation Error",
            message: "Dados da requisição inválidos",
            details: validation.errors,
            statusCode: 400,
          });
        }

        app.log.info("Gerando preview HTML", {
          api_key: request.apiKey?.name || "none",
          template_type: request.body.type,
        });

        // Gera preview HTML usando o service
        const htmlContent = await app.pdfGeneratorService.generatePreviewHTML(
          request.body
        );

        return reply.type("text/html").send(htmlContent);
      } catch (error) {
        app.log.error("Erro ao gerar preview:", error);

        return reply.code(500).send({
          error: "Preview Generation Failed",
          message: error.message,
          statusCode: 500,
        });
      }
    },
  });

  // Rota para estatísticas da API key atual
  app.route({
    method: "GET",
    url: "/stats",
    handler: async (request, reply) => {
      try {
        // Busca informações da key atual
        const keyInfo = await app.apiKeyService.listKeys();
        const currentKey = keyInfo.find((k) => k.id === request.apiKey.id);

        if (!currentKey) {
          return reply.code(404).send({
            error: "API Key Not Found",
            message: "API key não encontrada",
            statusCode: 404,
          });
        }

        return reply.send({
          success: true,
          api_key: {
            name: currentKey.name,
            type: currentKey.type,
            requests_per_minute: currentKey.requests_per_minute,
            is_active: currentKey.is_active,
            last_used_at: currentKey.last_used_at,
            created_at: currentKey.created_at,
          },
        });
      } catch (error) {
        app.log.error("Erro ao buscar estatísticas:", error);

        return reply.code(500).send({
          error: "Stats Fetch Failed",
          message: error.message,
          statusCode: 500,
        });
      }
    },
  });

  app.log.info("📄 Rotas de PDF registradas");
};
