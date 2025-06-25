"use strict";

const fp = require("fastify-plugin");

module.exports = fp(async (app) => {
  app.decorate("pdfGeneratorService", {
    generateFullPDF: generateFullPDF,
    generatePreviewHTML: generatePreviewHTML,
    validatePdfRequest: validatePdfRequest,
    getTemplateConfig: getTemplateConfig,
  });

  /**
   * Gera PDF completo a partir de dados da requisição
   * Extrai toda a lógica que estava nas rotas
   */
  async function generateFullPDF(requestData) {
    try {
      const { type, title = "Documento", data = {}, config = {} } = requestData;

      // Valida o tipo de template
      const isValidTemplate = await app.templateService.validateTemplateType(
        type
      );
      if (!isValidTemplate) {
        throw new Error(`Template '${type}' não encontrado`);
      }

      // Log da geração
      app.log.info("Iniciando geração de PDF", {
        template_type: type,
        title,
        has_data: Object.keys(data).length > 0,
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
      const pdfConfig = getTemplateConfig(type, config);

      // Gera o PDF
      const pdfBuffer = await app.pdfService.generatePDF(
        htmlContent,
        pdfConfig
      );

      app.log.info("PDF gerado com sucesso", {
        template_type: type,
        size_kb: Math.round(pdfBuffer.length / 1024),
        title,
      });

      return {
        buffer: pdfBuffer,
        filename: `${title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
        contentType: "application/pdf",
      };
    } catch (error) {
      app.log.error("Erro na geração completa do PDF:", error);
      throw new Error(`Falha na geração do PDF: ${error.message}`);
    }
  }

  /**
   * Gera apenas o HTML para preview (debug)
   */
  async function generatePreviewHTML(requestData) {
    try {
      const { type, title = "Documento", data = {} } = requestData;

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
        ...data,
      };

      // Renderiza apenas o HTML
      const htmlContent = await app.templateService.renderTemplate(
        type,
        templateData
      );

      app.log.info("Preview HTML gerado", {
        template_type: type,
        title,
      });

      return htmlContent;
    } catch (error) {
      app.log.error("Erro na geração do preview HTML:", error);
      throw new Error(`Falha na geração do preview: ${error.message}`);
    }
  }

  /**
   * Valida dados da requisição de PDF
   */
  function validatePdfRequest(requestData) {
    const errors = [];

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

    // Validações específicas por tipo de template
    if (
      requestData.type === "budget" ||
      requestData.type === "budget-premium"
    ) {
      if (!requestData.data?.budget?.items) {
        errors.push("Template de orçamento requer 'data.budget.items'");
      }
    }

    if (requestData.type === "exam") {
      if (!requestData.data?.exam?.subject) {
        errors.push("Template de exame requer 'data.exam.subject'");
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Obtém configurações específicas do template para PDF
   */
  function getTemplateConfig(templateType, userConfig = {}) {
    const defaultConfig = {
      format: "A4",
      landscape: false,
      margin: {
        top: "2cm",
        right: "2cm",
        bottom: "2cm",
        left: "2cm",
      },
      printBackground: true,
      preferCSSPageSize: false,
    };

    // Configurações específicas por tipo de template
    const templateConfigs = {
      // Templates básicos
      blank: { ...defaultConfig },
      logo: { ...defaultConfig },
      watermark: { ...defaultConfig },

      // Templates educacionais
      exam: {
        ...defaultConfig,
        margin: { top: "1.5cm", right: "2cm", bottom: "2cm", left: "2cm" },
      },
      assessment: {
        ...defaultConfig,
        margin: { top: "1.5cm", right: "2cm", bottom: "2cm", left: "2cm" },
      },
      quiz: {
        ...defaultConfig,
        margin: { top: "1.5cm", right: "2cm", bottom: "2cm", left: "2cm" },
      },

      // Templates empresariais
      budget: {
        ...defaultConfig,
        margin: { top: "1cm", right: "1.5cm", bottom: "2cm", left: "1.5cm" },
      },
      "budget-premium": {
        ...defaultConfig,
        margin: { top: "1cm", right: "1.5cm", bottom: "2cm", left: "1.5cm" },
      },
      report: {
        ...defaultConfig,
        margin: { top: "2.5cm", right: "2cm", bottom: "2.5cm", left: "2cm" },
      },
      invoice: {
        ...defaultConfig,
        margin: { top: "1cm", right: "1.5cm", bottom: "2cm", left: "1.5cm" },
      },

      // Templates médicos
      anamnesis: {
        ...defaultConfig,
        format: "A4",
        margin: { top: "1.5cm", right: "1.5cm", bottom: "2cm", left: "1.5cm" },
      },
      prescription: {
        ...defaultConfig,
        format: "A5",
        margin: { top: "1cm", right: "1cm", bottom: "1.5cm", left: "1cm" },
      },
      clinical_form: {
        ...defaultConfig,
        margin: { top: "1.5cm", right: "1.5cm", bottom: "2cm", left: "1.5cm" },
      },
    };

    // Usa configuração específica do template se existir
    const templateConfig = templateConfigs[templateType] || defaultConfig;

    // Sobrescreve com configurações do usuário
    return {
      ...templateConfig,
      ...userConfig,
      templateType,
      margin: {
        ...templateConfig.margin,
        ...userConfig.margin,
      },
    };
  }

  app.log.info("📄 PDF Generator Service registrado");
});
