"use strict";

const fp = require("fastify-plugin");

module.exports = fp(
  async (app) => {
    app.decorate("pdfGeneratorService", {
      generateFullPDF: generateFullPDF,
      generatePreviewHTML: generatePreviewHTML,
      validatePdfRequest: validatePdfRequest,
    });

    /**
     * Gera PDF completo a partir de dados da requisição
     * Agora usa a configuração centralizada
     */
    async function generateFullPDF(requestData) {
      try {
        const {
          type,
          title = "Documento",
          data = {},
          config = {},
          language = "pt-BR",
        } = requestData;

        // Valida o tipo de template
        const isValidTemplate = await app.templateService.validateTemplateType(
          type
        );
        if (!isValidTemplate) {
          throw new Error(`Template '${type}' não encontrado`);
        }

        // Log da geração
        app.log.info("🚀 Iniciando geração de PDF", {
          template_type: type,
          title,
          language,
          has_data: Object.keys(data).length > 0,
          has_config: Object.keys(config).length > 0,
        });

        // Monta os dados para o template com idioma
        const templateData = {
          title,
          language,
          ...data,
        };

        // Renderiza o template usando jsPDF
        const doc = await app.templateService.renderTemplate(
          type,
          templateData
        );

        // Gera o PDF usando jsPDF
        const pdfBuffer = await app.pdfService.generatePDF(doc);

        // Nome do arquivo com sanitização melhorada
        const sanitizedTitle = title
          .replace(/[^a-zA-Z0-9\-_\s]/g, "") // Remove caracteres especiais
          .replace(/\s+/g, "_") // Substitui espaços por underscore
          .toLowerCase();

        const filename = `${sanitizedTitle}_${Date.now()}.pdf`;

        app.log.info("✅ PDF gerado com sucesso", {
          template_type: type,
          size_kb: Math.round(pdfBuffer.length / 1024),
          title,
          filename,
          language,
        });

        return {
          buffer: pdfBuffer,
          filename,
          contentType: "application/pdf",
        };
      } catch (error) {
        app.log.error("❌ Erro na geração completa do PDF:", {
          error: error.message,
          stack: error.stack,
          template: requestData.type,
          title: requestData.title,
        });

        // Re-throw com mensagem mais limpa (evita mensagens duplicadas)
        throw new Error(
          error.message.replace(/^Falha na geração do PDF: /, "")
        );
      }
    }

    /**
     * Gera apenas o HTML para preview (debug) com suporte a idioma
     */
    async function generatePreviewHTML(requestData) {
      try {
        const {
          type,
          title = "Documento",
          data = {},
          language = "pt-BR",
        } = requestData;

        // Valida o tipo de template
        const isValidTemplate = await app.templateService.validateTemplateType(
          type
        );
        if (!isValidTemplate) {
          throw new Error(`Template '${type}' não encontrado`);
        }

        // Monta os dados para o template
        const templateData = {
          title,
          language,
          ...data,
        };

        // Renderiza o template
        const rendered = await app.templateService.renderTemplate(
          type,
          templateData
        );

        if (typeof rendered === "string") {
          app.log.info("👁️ Preview HTML gerado", {
            template_type: type,
            title,
            language,
            html_size: rendered.length,
          });
          return rendered;
        }

        app.log.info("👁️ Preview não disponível para este template", {
          template_type: type,
          title,
          language,
        });
        return "Preview indisponível";
      } catch (error) {
        app.log.error("❌ Erro na geração do preview HTML:", {
          error: error.message,
          template: requestData.type,
          title: requestData.title,
        });
        throw new Error(`Falha na geração do preview: ${error.message}`);
      }
    }

    /**
     * Valida dados da requisição de PDF com validações aprimoradas
     */
    function validatePdfRequest(requestData) {
      const errors = [];

      // Validação básica
      if (!requestData.type) {
        errors.push("Campo 'type' é obrigatório");
      }

      if (requestData.title && typeof requestData.title !== "string") {
        errors.push("Campo 'title' deve ser uma string");
      }

      if (requestData.data && typeof requestData.data !== "object") {
        errors.push("Campo 'data' deve ser um objeto");
      }

      if (requestData.config && typeof requestData.config !== "object") {
        errors.push("Campo 'config' deve ser um objeto");
      }

      // Validação de idioma
      if (requestData.language) {
        const validLanguages = ["pt-BR", "en-US", "es-ES"];
        if (!validLanguages.includes(requestData.language)) {
          errors.push(
            `Idioma '${
              requestData.language
            }' não suportado. Use: ${validLanguages.join(", ")}`
          );
        }
      }

      // Validações específicas por tipo de template
      if (
        requestData.type === "budget" ||
        requestData.type === "budget-premium"
      ) {
        if (
          !requestData.data?.budget?.items ||
          !Array.isArray(requestData.data.budget.items)
        ) {
          errors.push(
            "Template de orçamento requer 'data.budget.items' como array"
          );
        } else if (requestData.data.budget.items.length === 0) {
          errors.push("Template de orçamento precisa de pelo menos 1 item");
        }

        // Valida estrutura dos itens
        if (requestData.data.budget.items) {
          requestData.data.budget.items.forEach((item, index) => {
            if (!item.description) {
              errors.push(`Item ${index + 1}: 'description' é obrigatório`);
            }
            if (item.quantity === undefined || item.quantity <= 0) {
              errors.push(`Item ${index + 1}: 'quantity' deve ser maior que 0`);
            }
            if (item.unitPrice === undefined || item.unitPrice < 0) {
              errors.push(`Item ${index + 1}: 'unitPrice' deve ser >= 0`);
            }
          });
        }
      }

      if (requestData.type === "exam") {
        if (!requestData.data?.exam?.subject) {
          errors.push("Template de exame requer 'data.exam.subject'");
        }
      }

      if (requestData.type === "prescription") {
        if (
          !requestData.data?.medications ||
          !Array.isArray(requestData.data.medications)
        ) {
          errors.push(
            "Template de receita requer 'data.medications' como array"
          );
        }
        if (!requestData.data?.doctor?.name) {
          errors.push("Template de receita requer 'data.doctor.name'");
        }
        if (!requestData.data?.patient?.name) {
          errors.push("Template de receita requer 'data.patient.name'");
        }
      }

      // Validações de configuração se fornecidas
      if (requestData.config) {
        if (requestData.config.format) {
          const validFormats = ["A4", "A5", "A3", "Letter", "Legal"];
          if (!validFormats.includes(requestData.config.format)) {
            errors.push(
              `Formato '${
                requestData.config.format
              }' inválido. Use: ${validFormats.join(", ")}`
            );
          }
        }

        if (requestData.config.orientation) {
          const validOrientations = ["portrait", "landscape"];
          if (!validOrientations.includes(requestData.config.orientation)) {
            errors.push(
              `Orientação '${
                requestData.config.orientation
              }' inválida. Use: ${validOrientations.join(", ")}`
            );
          }
        }
      }

      // Log das validações para debug
      if (errors.length > 0) {
        app.log.warn("🚫 Validação de PDF falhou:", {
          template: requestData.type,
          title: requestData.title,
          errors: errors,
          errorCount: errors.length,
        });
      } else {
        app.log.debug("✅ Validação de PDF passou:", {
          template: requestData.type,
          title: requestData.title,
          hasData: !!requestData.data,
          hasConfig: !!requestData.config,
        });
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    }

    app.log.info(
      "📄 PDF Generator Service registrado com configuração centralizada"
    );
  },
  {
    name: "pdf-generator-service",
    dependencies: ["template-service", "pdf-service"], // Dependências atualizadas
  }
);
