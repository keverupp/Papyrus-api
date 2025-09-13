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
        language: {
          type: "string",
          enum: ["pt-BR", "en-US", "es-ES"],
          default: "pt-BR",
        },
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

  // Query schema para parâmetros de idioma
  const languageQuerySchema = {
    querystring: {
      type: "object",
      properties: {
        lang: {
          type: "string",
          enum: ["pt-BR", "en-US", "es-ES"],
          default: "pt-BR",
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
        const { language = "pt-BR" } = request.body;
        const idKey = request.headers["idempotency-key"];

        if (idKey) {
          const cached = await app.queueService.getIdempotencyResult(idKey);
          if (cached) {
            return reply.code(200).send(cached);
          }
        }

        // Carrega traduções para mensagens de erro/sucesso
        const translations = await app.i18nService.getTranslations(language);

        // Valida dados da requisição
        const validation = app.pdfGeneratorService.validatePdfRequest(
          request.body
        );
        if (!validation.isValid) {
          return reply.code(400).send({
            error: "Validation Error",
            message:
              translations.api?.errors?.validation_error ||
              "Dados da requisição inválidos",
            details: validation.errors,
            statusCode: 400,
            language,
          });
        }

        // Log da requisição
        app.log.info("Processando geração de PDF", {
          api_key: request.apiKey?.name || "none",
          template_type: request.body.type,
          title: request.body.title,
          language,
        });

        // Enfileira geração de PDF
        const job = await app.queueService.enqueuePDF({
          type: request.body.type,
          data: request.body.data,
          config: request.body.config,
          language,
        });
        await app.queueService.setJobStatus(job.id, "queued");
        const result = { job_id: job.id };
        if (idKey) {
          await app.queueService.setIdempotencyResult(idKey, result);
        }
        return reply.code(202).send(result);
      } catch (error) {
        app.log.error("Erro ao gerar PDF:", error);

        const language = request.body?.language || "pt-BR";
        const translations = await app.i18nService.getTranslations(language);

        return reply.code(500).send({
          error: "PDF Queue Failed",
          message: app.i18nService.formatMessage(
            translations.api?.errors?.internal_error ||
              "Falha ao enfileirar o PDF: {{error}}",
            { error: error.message }
          ),
          type: "queue_error",
          statusCode: 500,
          language,
        });
      }
    },
  });

  // Rota para verificar status do job
  app.route({
    method: "GET",
    url: "/:job_id",
    handler: async (request, reply) => {
      const { job_id } = request.params;
      const status = await app.queueService.getJobStatus(job_id);
      if (!status) {
        return reply.code(404).send({ error: "Job Not Found" });
      }
      return reply.send(status);
    },
  });

  // Rota para obter URL de download
  app.route({
    method: "GET",
    url: "/:job_id/download",
    handler: async (request, reply) => {
      const { job_id } = request.params;
      const status = await app.queueService.getJobStatus(job_id);
      if (!status) {
        return reply.code(404).send({ error: "Job Not Found" });
      }
      if (status.status !== "completed") {
        return reply
          .code(400)
          .send({ error: "Job not completed", status: status.status });
      }
      const { key, prefix, url } = status;
      const finalUrl = url || (await app.storageService.getSignedPDFUrl(key));
      return reply.send({ key, prefix, url: finalUrl });
    },
  });

  // Rota para listar templates disponíveis (com suporte a idioma)
  app.route({
    method: "GET",
    url: "/templates",
    schema: languageQuerySchema,
    handler: async (request, reply) => {
      try {
        const { lang = "pt-BR" } = request.query;
        const translations = await app.i18nService.getTranslations(lang);

        // Busca templates localizados
        const localizedTemplates = await app.i18nService.getLocalizedTemplates(
          lang
        );

        return reply.send({
          success: true,
          language: lang,
          templates: localizedTemplates,
          total: Object.values(localizedTemplates).flat().length,
          message:
            translations.api?.success?.template_found ||
            "Templates encontrados",
        });
      } catch (error) {
        app.log.error("Erro ao listar templates:", error);

        const lang = request.query?.lang || "pt-BR";
        const translations = await app.i18nService.getTranslations(lang);

        return reply.code(500).send({
          error: "Templates List Failed",
          message:
            translations.api?.errors?.internal_error ||
            "Erro interno do servidor",
          statusCode: 500,
          language: lang,
        });
      }
    },
  });

  // Rota para visualizar dados de um template específico (com idioma)
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
      querystring: languageQuerySchema.querystring,
    },
    handler: async (request, reply) => {
      try {
        const { type } = request.params;
        const { lang = "pt-BR" } = request.query;
        const translations = await app.i18nService.getTranslations(lang);

        const templateData = await app.templateService.getTemplateData(type);

        if (!templateData) {
          return reply.code(404).send({
            error: "Template Not Found",
            message: app.i18nService.formatMessage(
              translations.api?.errors?.template_not_found ||
                "Template '{{template}}' não encontrado",
              { template: type }
            ),
            statusCode: 404,
            language: lang,
          });
        }

        // Traduz informações do template
        const localizedTemplate = await app.i18nService.translateTemplate(
          templateData,
          lang
        );

        return reply.send({
          success: true,
          language: lang,
          template: localizedTemplate,
          message:
            translations.api?.success?.template_found || "Template encontrado",
        });
      } catch (error) {
        app.log.error("Erro ao buscar template:", error);

        const lang = request.query?.lang || "pt-BR";
        const translations = await app.i18nService.getTranslations(lang);

        return reply.code(500).send({
          error: "Template Fetch Failed",
          message:
            translations.api?.errors?.internal_error ||
            "Erro interno do servidor",
          statusCode: 500,
          language: lang,
        });
      }
    },
  });

  // Rota para preview do conteúdo Typst (útil para debug)
  app.route({
    method: "POST",
    url: "/preview",
    schema: pdfSchema,
    handler: async (request, reply) => {
      try {
        const { language = "pt-BR" } = request.body;
        const translations = await app.i18nService.getTranslations(language);

        // Valida dados da requisição
        const validation = app.pdfGeneratorService.validatePdfRequest(
          request.body
        );
        if (!validation.isValid) {
          return reply.code(400).send({
            error: "Validation Error",
            message:
              translations.api?.errors?.validation_error ||
              "Dados da requisição inválidos",
            details: validation.errors,
            statusCode: 400,
            language,
          });
        }

        app.log.info("Gerando preview Typst", {
          api_key: request.apiKey?.name || "none",
          template_type: request.body.type,
          language,
        });

        // Gera preview Typst usando o service
        const typstContent = await app.pdfGeneratorService.generatePreviewHTML(
          request.body
        );

        return reply
          .type("text/plain")
          .header("X-Preview-Language", language)
          .send(typstContent);
      } catch (error) {
        app.log.error("Erro ao gerar preview:", error);

        const language = request.body?.language || "pt-BR";
        const translations = await app.i18nService.getTranslations(language);

        return reply.code(500).send({
          error: "Preview Generation Failed",
          message:
            translations.api?.errors?.internal_error ||
            "Erro interno do servidor",
          statusCode: 500,
          language,
        });
      }
    },
  });

  // Nova rota para listar idiomas disponíveis
  app.route({
    method: "GET",
    url: "/languages",
    handler: async (request, reply) => {
      try {
        const languages = await app.i18nService.getAvailableLanguages();

        return reply.send({
          success: true,
          languages,
          total: languages.length,
          default: languages.find((lang) => lang.isDefault)?.code || "pt-BR",
        });
      } catch (error) {
        app.log.error("Erro ao listar idiomas:", error);

        return reply.code(500).send({
          error: "Languages List Failed",
          message: "Erro ao listar idiomas disponíveis",
          statusCode: 500,
        });
      }
    },
  });

  // Rota para estatísticas da API key atual (com idioma)
  app.route({
    method: "GET",
    url: "/stats",
    schema: languageQuerySchema,
    handler: async (request, reply) => {
      try {
        const { lang = "pt-BR" } = request.query;
        const translations = await app.i18nService.getTranslations(lang);

        // Busca informações da key atual
        const keyInfo = await app.apiKeyService.listKeys();
        const currentKey = keyInfo.find((k) => k.id === request.apiKey.id);

        if (!currentKey) {
          return reply.code(404).send({
            error: "API Key Not Found",
            message:
              translations.api?.errors?.not_found || "API key não encontrada",
            statusCode: 404,
            language: lang,
          });
        }

        return reply.send({
          success: true,
          language: lang,
          api_key: {
            name: currentKey.name,
            type: currentKey.type,
            requests_per_minute: currentKey.requests_per_minute,
            is_active: currentKey.is_active,
            last_used_at: currentKey.last_used_at,
            created_at: currentKey.created_at,
          },
          message:
            translations.api?.success?.data_validated ||
            "Dados validados com sucesso",
        });
      } catch (error) {
        app.log.error("Erro ao buscar estatísticas:", error);

        const lang = request.query?.lang || "pt-BR";
        const translations = await app.i18nService.getTranslations(lang);

        return reply.code(500).send({
          error: "Stats Fetch Failed",
          message:
            translations.api?.errors?.internal_error ||
            "Erro interno do servidor",
          statusCode: 500,
          language: lang,
        });
      }
    },
  });

  app.log.info("📄 Rotas de PDF registradas com suporte a i18n");
};
