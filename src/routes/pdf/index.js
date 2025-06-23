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
        const {
          type,
          title = "Documento",
          data = {},
          config = {},
        } = request.body;

        // Log da requisição
        app.log.info("Gerando PDF", {
          api_key: request.apiKey.name,
          template_type: type,
          title,
        });

        // Monta os dados para o template
        const templateData = {
          title,
          ...data,
        };

        // Renderiza o template HTML
        const htmlContent = await app.templateService.renderTemplate(
          type,
          templateData
        );

        // Configurações do PDF
        const pdfConfig = {
          templateType: type,
          format: config.format || "A4",
          landscape: config.orientation === "landscape",
          margin: config.margin,
          ...config,
        };

        // Gera o PDF
        const pdfBuffer = await app.pdfService.generatePDF(
          htmlContent,
          pdfConfig
        );

        // Headers para download
        reply
          .type("application/pdf")
          .header("Content-Disposition", `attachment; filename="${title}.pdf"`)
          .header("Content-Length", pdfBuffer.length);

        return reply.send(pdfBuffer);
      } catch (error) {
        app.log.error("Erro ao gerar PDF:", error);

        return reply.code(500).send({
          error: "PDF Generation Failed",
          message: error.message,
          type: "generation_error",
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
        const { type, title = "Documento", data = {} } = request.body;

        // Monta os dados para o template
        const templateData = {
          title,
          ...data,
        };

        // Renderiza o template HTML
        const htmlContent = await app.templateService.renderTemplate(
          type,
          templateData
        );

        return reply.type("text/html").send(htmlContent);
      } catch (error) {
        app.log.error("Erro ao gerar preview:", error);

        return reply.code(500).send({
          error: "Preview Generation Failed",
          message: error.message,
        });
      }
    },
  });

  // Rota para estatísticas da API key
  app.route({
    method: "GET",
    url: "/stats",
    handler: async (request, reply) => {
      try {
        const apiKey = request.apiKey;

        // Busca informações da key (sem mostrar a key real)
        const keyInfo = await app.apiKeyService.listKeys();
        const currentKey = keyInfo.find((k) => k.id === apiKey.id);

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
        });
      }
    },
  });
};
