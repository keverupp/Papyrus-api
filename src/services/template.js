"use strict";

const fp = require("fastify-plugin");
const fs = require("fs").promises;
const path = require("path");

module.exports = fp(
  async (app) => {
    app.decorate("templateService", {
      getAvailableTemplates: getAvailableTemplates,
      validateTemplateType: validateTemplateType,
      getTemplateData: getTemplateData,
      processTemplateData: processTemplateData,
      renderTemplate: renderTemplate,
    });

    /**
     * Lista todos os templates disponíveis organizados por categoria
     */
    async function getAvailableTemplates() {
      const templates = {
        basic: [
          {
            type: "blank",
            name: "Página em Branco",
            description: "Documento básico sem formatação específica",
            template: "basic/blank.hbs",
          },
          {
            type: "logo",
            name: "Com Logotipo",
            description: "Documento com espaço para logotipo no cabeçalho",
            template: "basic/logo.hbs",
          },
          {
            type: "watermark",
            name: "Com Marca d'água",
            description: "Documento com marca d'água personalizada",
            template: "basic/watermark.hbs",
          },
        ],
        educational: [
          {
            type: "exam",
            name: "Prova/Exame",
            description: "Template para provas e exames escolares",
            template: "educational/exam.hbs",
          },
          {
            type: "assessment",
            name: "Avaliação",
            description: "Template para avaliações e questionários",
            template: "educational/assessment.hbs",
          },
          {
            type: "quiz",
            name: "Quiz/Questionário",
            description: "Template para questionários simples",
            template: "educational/quiz.hbs",
          },
        ],
        business: [
          {
            type: "budget",
            name: "Orçamento",
            description: "Template para orçamentos empresariais",
            template: "business/budget.hbs",
          },
          {
            type: "report",
            name: "Relatório",
            description: "Template para relatórios executivos",
            template: "business/report.hbs",
          },
          {
            type: "invoice",
            name: "Fatura/Invoice",
            description: "Template para faturas e notas fiscais",
            template: "business/invoice.hbs",
          },
          {
            type: "budget-premium",
            name: "Orçamento Premium",
            description:
              "Template de orçamento avançado com logo e marca d'água",
            template: "business/budget-premium.hbs",
          },
        ],
        medical: [
          {
            type: "anamnesis",
            name: "Ficha de Anamnese",
            description: "Template para fichas médicas de anamnese",
            template: "medical/anamnesis.hbs",
          },
          {
            type: "prescription",
            name: "Receita Médica",
            description: "Template para receitas médicas",
            template: "medical/prescription.hbs",
          },
          {
            type: "clinical_form",
            name: "Formulário Clínico",
            description: "Template para formulários clínicos personalizados",
            template: "medical/clinical_form.hbs",
          },
        ],
      };

      return templates;
    }

    /**
     * Valida se o tipo de template existe
     */
    async function validateTemplateType(type) {
      const allTemplates = await getAvailableTemplates();
      const flatTemplates = Object.values(allTemplates).flat();
      return flatTemplates.some((template) => template.type === type);
    }

    /**
     * Processa e valida os dados específicos do template
     */
    function processTemplateData(templateType, data) {
      const processors = {
        // Templates básicos
        blank: processBasicTemplate,
        logo: processLogoTemplate,
        watermark: processWatermarkTemplate,

        // Templates educacionais
        exam: processExamTemplate,
        assessment: processAssessmentTemplate,
        quiz: processQuizTemplate,

        // Templates empresariais
        budget: processBudgetTemplate,
        invoice: processInvoiceTemplate,
        "budget-premium": processBudgetPremiumTemplate,
        report: processReportTemplate,
        invoice: processInvoiceTemplate,

        // Templates médicos
        anamnesis: processAnamnesisTemplate,
        prescription: processPrescriptionTemplate,
        clinical_form: processClinicalFormTemplate,
      };

      const processor = processors[templateType];
      if (!processor) {
        throw new Error(
          `Processador não encontrado para template: ${templateType}`
        );
      }

      return processor(data);
    }

    /**
     * Renderiza um template específico com os dados
     */
    async function renderTemplate(templateType, data) {
      try {
        if (!app.handlebars) {
          throw new Error("Plugin handlebars não foi carregado");
        }

        if (!app.handlebars.renderTemplate) {
          throw new Error(
            "Método renderTemplate não está disponível no handlebars"
          );
        }

        const templates = await getAvailableTemplates();
        const allTemplates = Object.values(templates).flat();

        const templateInfo = allTemplates.find((t) => t.type === templateType);
        if (!templateInfo) {
          throw new Error(`Template não encontrado: ${templateType}`);
        }

        // Processa os dados específicos do template
        const processedData = processTemplateData(templateType, data);

        // Renderiza o template
        return await app.handlebars.renderTemplate(
          templateInfo.template,
          processedData
        );
      } catch (error) {
        app.log.error("❌ Erro na renderização do template:", error);
        throw error;
      }
    }

    /**
     * Retorna informações sobre um template específico
     */
    async function getTemplateData(templateType) {
      const templates = await getAvailableTemplates();
      const allTemplates = Object.values(templates).flat();

      return allTemplates.find((t) => t.type === templateType) || null;
    }

    // ========== PROCESSADORES DE TEMPLATES ==========

    function processBasicTemplate(data) {
      const now = new Date();
      return {
        title: data.title || "Documento",
        content: data.content || "",
        date: now,
        ...data,
      };
    }

    function processLogoTemplate(data) {
      return {
        ...processBasicTemplate(data),
        logo: {
          url: data.logo?.url || "",
          width: data.logo?.width || "auto",
          height: data.logo?.height || "60px",
        },
      };
    }

    function processWatermarkTemplate(data) {
      return {
        ...processBasicTemplate(data),
        watermark: {
          text: data.watermark?.text || "CONFIDENCIAL",
          opacity: data.watermark?.opacity || 0.1,
          rotation: data.watermark?.rotation || -45,
          fontSize: data.watermark?.fontSize || "60px",
        },
      };
    }

    function processBudgetTemplate(data) {
      const budget = data.budget || {};
      const items = budget.items || [];

      // Calcula totais
      const subtotal = items.reduce((sum, item) => {
        return sum + item.quantity * item.unitPrice;
      }, 0);

      const discountAmount = budget.discount || 0;
      const taxRate = budget.taxRate || 0;
      const taxAmount = (subtotal - discountAmount) * (taxRate / 100);
      const total = subtotal - discountAmount + taxAmount;

      return {
        title: data.title || "Orçamento",
        date: new Date(),
        budget: {
          ...budget,
          items: items.map((item) => ({
            ...item,
            total: item.quantity * item.unitPrice,
          })),
          calculations: {
            subtotal,
            discountAmount,
            taxRate,
            taxAmount,
            total,
          },
        },
        ...data,
      };
    }

    function processExamTemplate(data) {
      const exam = data.exam || {};

      return {
        title: data.title || "Exame",
        date: new Date(),
        exam: {
          subject: exam.subject || "",
          duration: exam.duration || "",
          instructions: exam.instructions || "",
          questions: exam.questions || [],
          ...exam,
        },
        ...data,
      };
    }

    function processReportTemplate(data) {
      return {
        title: data.title || "Relatório",
        date: new Date(),
        report: {
          summary: data.report?.summary || "",
          sections: data.report?.sections || [],
          ...data.report,
        },
        ...data,
      };
    }

    function processAssessmentTemplate(data) {
      return processExamTemplate(data); // Similar ao exam
    }

    function processQuizTemplate(data) {
      return processExamTemplate(data); // Similar ao exam
    }

    function processInvoiceTemplate(data) {
      return processBudgetTemplate(data); // Similar ao budget
    }

    function processBudgetPremiumTemplate(data) {
      const budget = data.budget || {};
      const items = budget.items || [];

      // Calcula totais corretamente
      const processedItems = items.map((item) => {
        const quantity = parseFloat(item.quantity) || 0;
        const unitPrice = parseFloat(item.unitPrice) || 0;
        const total = quantity * unitPrice;

        return {
          ...item,
          quantity,
          unitPrice,
          total,
        };
      });

      const subtotal = processedItems.reduce(
        (sum, item) => sum + item.total,
        0
      );
      const discountAmount = parseFloat(budget.discount) || 0;
      const taxRate = parseFloat(budget.taxRate) || 0;

      const baseForTax = subtotal - discountAmount;
      const taxAmount = baseForTax * (taxRate / 100);
      const total = baseForTax + taxAmount;

      const processedData = {
        title: data.title || "Orçamento Premium",
        date: new Date(),
        budget: {
          ...budget,
          items: processedItems,
          calculations: {
            subtotal,
            discountAmount,
            taxRate,
            taxAmount,
            total,
          },
        },
      };

      // Configuração do logo (cabeçalho e marca d'água)
      if (data.logo?.url) {
        processedData.logo = {
          url: data.logo.url,
          width: data.logo.width || "120px",
          height: data.logo.height || "60px",
        };
      }

      // Configuração da marca d'água (logo OU texto)
      if (data.watermark) {
        if (data.watermark.type === "logo" && data.watermark.logo?.url) {
          // Marca d'água tipo logo
          processedData.watermark = {
            type: "logo",
            logo: {
              url: data.watermark.logo.url,
              opacity: data.watermark.opacity || 0.05,
              width: data.watermark.logo.width || "300px",
              height: data.watermark.logo.height || "auto",
            },
          };
        } else {
          // Marca d'água tipo texto (padrão)
          processedData.watermark = {
            type: "text",
            text: data.watermark.text || "CONFIDENCIAL",
            opacity: data.watermark.opacity || 0.08,
            rotation: data.watermark.rotation || -45,
            fontSize: data.watermark.fontSize || "80px",
          };
        }
      }

      return processedData;
    }

    function processAnamnesisTemplate(data) {
      return {
        title: data.title || "Ficha de Anamnese",
        date: new Date(),
        patient: data.patient || {},
        anamnesis: data.anamnesis || {},
        ...data,
      };
    }

    function processPrescriptionTemplate(data) {
      return {
        title: data.title || "Receita Médica",
        date: new Date(),
        doctor: data.doctor || {},
        patient: data.patient || {},
        medications: data.medications || [],
        ...data,
      };
    }

    function processClinicalFormTemplate(data) {
      return {
        title: data.title || "Formulário Clínico",
        date: new Date(),
        form: data.form || {},
        ...data,
      };
    }
  },
  {
    name: "template-service",
    dependencies: ["handlebars"], // Garante que handlebars seja carregado antes
  }
);
