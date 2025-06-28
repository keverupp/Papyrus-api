"use strict";

const fp = require("fastify-plugin");
const fs = require("fs").promises;
const path = require("path");

module.exports = fp(
  async (app) => {
    // Cache dos templates para evitar re-scan constante
    let templatesCache = null;
    let lastScanTime = 0;
    const CACHE_DURATION = 30000; // 30 segundos

    app.decorate("templateService", {
      getAvailableTemplates: getAvailableTemplates,
      getTemplatesByLanguage: getTemplatesByLanguage,
      validateTemplateType: validateTemplateType,
      getTemplateData: getTemplateData,
      getTemplateByLanguage: getTemplateByLanguage,
      processTemplateData: processTemplateData,
      renderTemplate: renderTemplate,
      refreshTemplatesCache: refreshTemplatesCache,
      scanTemplateFolder: scanTemplateFolder,
    });

    /**
     * Lista todos os templates disponíveis organizados por categoria
     * Agora com detecção automática das pastas
     */
    async function getAvailableTemplates() {
      const now = Date.now();

      // Usa cache se ainda está válido
      if (templatesCache && now - lastScanTime < CACHE_DURATION) {
        return templatesCache;
      }

      app.log.info("🔍 Escaneando templates automaticamente...");

      try {
        const templatesDir = path.resolve("src/templates");
        const templates = {};

        // Lê todas as pastas em src/templates
        const categories = await fs.readdir(templatesDir, {
          withFileTypes: true,
        });

        for (const category of categories) {
          if (category.isDirectory()) {
            const categoryName = category.name;
            const categoryPath = path.join(templatesDir, categoryName);

            app.log.info(`📂 Escaneando categoria: ${categoryName}`);

            // Escaneia arquivos .hbs na categoria
            const templateFiles = await fs.readdir(categoryPath);
            const categoryTemplates = [];

            for (const file of templateFiles) {
              if (file.endsWith(".hbs")) {
                const templatePath = path.join(categoryPath, file);
                const templateInfo = await parseTemplateMetadata(
                  templatePath,
                  categoryName,
                  file
                );

                if (templateInfo) {
                  categoryTemplates.push(templateInfo);
                  app.log.info(
                    `✅ Template encontrado: ${templateInfo.type} (${templateInfo.name}) [${templateInfo.language}]`
                  );
                }
              }
            }

            if (categoryTemplates.length > 0) {
              templates[categoryName] = categoryTemplates;
            }
          }
        }

        // Atualiza cache
        templatesCache = templates;
        lastScanTime = now;

        app.log.info(
          `🎉 Scan concluído! ${Object.keys(templates).length} categorias, ${
            Object.values(templates).flat().length
          } templates`
        );

        return templates;
      } catch (error) {
        app.log.error("❌ Erro ao escanear templates:", error);

        // Fallback para templates hardcoded se o scan falhar
        return getFallbackTemplates();
      }
    }

    /**
     * Extrai metadados do template a partir de comentários especiais
     */
    async function parseTemplateMetadata(templatePath, categoryName, fileName) {
      try {
        const content = await fs.readFile(templatePath, "utf8");

        // Procura pelo bloco de metadados no início do arquivo
        const metadataRegex = /<!--\s*TEMPLATE_META\s*([\s\S]*?)\s*-->/;
        const match = content.match(metadataRegex);

        if (match) {
          // Parseia os metadados do comentário
          const metadataText = match[1];
          const metadata = parseMetadataText(metadataText);

          return {
            type: metadata.type || path.basename(fileName, ".hbs"),
            name: metadata.name || metadata.type || fileName,
            description:
              metadata.description || `Template ${metadata.type || fileName}`,
            template: `${categoryName}/${fileName}`,
            category: categoryName,
            tags: metadata.tags || [],
            version: metadata.version || "1.0.0",
            author: metadata.author,
            language: metadata.language || "pt-BR", // Novo campo
            supportedLanguages: metadata.supportedlanguages
              ? metadata.supportedlanguages.split(",").map((l) => l.trim())
              : ["pt-BR"], // Novo campo
            lastModified: (await fs.stat(templatePath)).mtime,
          };
        } else {
          // Fallback: gera metadados básicos baseado no nome do arquivo
          const type = path.basename(fileName, ".hbs");

          // Detecta idioma pelo sufixo do arquivo (ex: budget-premium.en-US.hbs)
          const languageMatch = fileName.match(/\.([a-z]{2}-[A-Z]{2})\.hbs$/);
          const detectedLanguage = languageMatch ? languageMatch[1] : "pt-BR";
          const cleanType = type.replace(/\.[a-z]{2}-[A-Z]{2}$/, ""); // Remove sufixo de idioma

          return {
            type: cleanType,
            name: generateDisplayName(cleanType),
            description: `Template ${cleanType} (sem metadados)`,
            template: `${categoryName}/${fileName}`,
            category: categoryName,
            tags: [categoryName],
            version: "1.0.0",
            language: detectedLanguage,
            supportedLanguages: [detectedLanguage],
            lastModified: (await fs.stat(templatePath)).mtime,
          };
        }
      } catch (error) {
        app.log.warn(`⚠️ Erro ao ler template ${templatePath}:`, error.message);
        return null;
      }
    }

    /**
     * Parseia o texto dos metadados
     */
    function parseMetadataText(text) {
      const metadata = {};
      const lines = text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line);

      for (const line of lines) {
        const [key, ...valueParts] = line.split(":");
        if (key && valueParts.length > 0) {
          const value = valueParts.join(":").trim();
          const cleanKey = key.toLowerCase().replace(/[^a-z]/g, "");

          if (cleanKey === "tags") {
            metadata[cleanKey] = value.split(",").map((tag) => tag.trim());
          } else {
            metadata[cleanKey] = value;
          }
        }
      }

      return metadata;
    }

    /**
     * Gera nome de exibição baseado no tipo
     */
    function generateDisplayName(type) {
      const names = {
        blank: "Página em Branco",
        logo: "Com Logotipo",
        watermark: "Com Marca d'água",
        exam: "Prova/Exame",
        assessment: "Avaliação",
        quiz: "Quiz/Questionário",
        budget: "Orçamento",
        "budget-premium": "Orçamento Premium",
        report: "Relatório",
        invoice: "Fatura/Invoice",
        anamnesis: "Ficha de Anamnese",
        prescription: "Receita Médica",
        clinical_form: "Formulário Clínico",
      };

      return names[type] || type.charAt(0).toUpperCase() + type.slice(1);
    }

    /**
     * Templates de fallback caso o scan automático falhe
     */
    function getFallbackTemplates() {
      return {
        basic: [
          {
            type: "blank",
            name: "Página em Branco",
            description: "Documento básico sem formatação específica",
            template: "basic/blank.hbs",
            language: "pt-BR",
          },
        ],
        educational: [
          {
            type: "exam",
            name: "Prova/Exame",
            description: "Template para provas e exames escolares",
            template: "educational/exam.hbs",
            language: "pt-BR",
          },
        ],
        business: [
          {
            type: "budget-premium",
            name: "Orçamento Premium",
            description:
              "Template de orçamento avançado com logo e marca d'água",
            template: "business/budget-premium.hbs",
            language: "pt-BR",
          },
        ],
      };
    }

    /**
     * Força refresh do cache de templates
     */
    async function refreshTemplatesCache() {
      templatesCache = null;
      lastScanTime = 0;
      app.log.info("🔄 Cache de templates invalidado");
      return await getAvailableTemplates();
    }

    /**
     * Escaneia uma pasta específica de templates
     */
    async function scanTemplateFolder(folderName) {
      const templatesDir = path.resolve("src/templates", folderName);

      try {
        const files = await fs.readdir(templatesDir);
        const templates = [];

        for (const file of files) {
          if (file.endsWith(".hbs")) {
            const templatePath = path.join(templatesDir, file);
            const templateInfo = await parseTemplateMetadata(
              templatePath,
              folderName,
              file
            );

            if (templateInfo) {
              templates.push(templateInfo);
            }
          }
        }

        return templates;
      } catch (error) {
        app.log.error(`❌ Erro ao escanear pasta ${folderName}:`, error);
        return [];
      }
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
     * Retorna informações sobre um template específico
     */
    async function getTemplateData(templateType) {
      const templates = await getAvailableTemplates();
      const allTemplates = Object.values(templates).flat();

      return allTemplates.find((t) => t.type === templateType) || null;
    }

    /**
     * Lista templates disponíveis apenas no idioma específico (sem fallback)
     */
    async function getTemplatesByLanguage(language = "pt-BR") {
      try {
        const allTemplates = await getAvailableTemplates();
        const filteredTemplates = {};

        for (const [category, templates] of Object.entries(allTemplates)) {
          // Filtra apenas templates do idioma específico
          const languageTemplates = templates.filter((template) => {
            return template.language === language;
          });

          // Só adiciona categoria se houver templates no idioma
          if (languageTemplates.length > 0) {
            filteredTemplates[category] = languageTemplates;
          }
        }

        app.log.debug(`🎯 Templates filtrados para ${language}:`, {
          categories: Object.keys(filteredTemplates).length,
          total: Object.values(filteredTemplates).flat().length,
        });

        return filteredTemplates;
      } catch (error) {
        app.log.error(
          `Erro ao filtrar templates por idioma ${language}:`,
          error
        );
        return {};
      }
    }

    /**
     * Busca template específico por tipo e idioma
     */
    async function getTemplateByLanguage(templateType, language = "pt-BR") {
      try {
        const allTemplates = await getAvailableTemplates();
        const flatTemplates = Object.values(allTemplates).flat();

        // Procura template no idioma específico
        const template = flatTemplates.find(
          (t) => t.type === templateType && t.language === language
        );

        if (template) {
          app.log.debug(
            `✅ Template encontrado: ${templateType} em ${language}`
          );
          return template;
        }

        // Fallback para idioma padrão se não encontrar
        if (language !== "pt-BR") {
          const fallbackTemplate = flatTemplates.find(
            (t) => t.type === templateType && t.language === "pt-BR"
          );

          if (fallbackTemplate) {
            app.log.warn(
              `⚠️ Template ${templateType} não encontrado em ${language}, usando pt-BR`
            );
            return fallbackTemplate;
          }
        }

        app.log.error(
          `❌ Template ${templateType} não encontrado em nenhum idioma`
        );
        return null;
      } catch (error) {
        app.log.error(
          `Erro ao buscar template ${templateType} em ${language}:`,
          error
        );
        return null;
      }
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

        // Templates educacionais/gerais
        exam: processExamTemplate,
        assessment: processAssessmentTemplate,
        quiz: processQuizTemplate,

        // Templates empresariais
        budget: processBudgetTemplate,
        invoice: processInvoiceTemplate,
        "budget-premium": processBudgetPremiumTemplate,
        report: processReportTemplate,

        // Templates médicos
        anamnesis: processAnamnesisTemplate,
        prescription: processPrescriptionTemplate,
        clinical_form: processClinicalFormTemplate,
      };

      const processor = processors[templateType];
      if (!processor) {
        app.log.warn(
          `⚠️ Processador não encontrado para template: ${templateType}, usando processador básico`
        );
        return processBasicTemplate(data);
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

        // Detecta idioma se especificado nos dados
        const language = data.language || "pt-BR";

        // Busca template no idioma específico
        let templateInfo = await getTemplateByLanguage(templateType, language);

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

    // ========== PROCESSADORES DE TEMPLATES ==========
    // (Mantém todos os processadores existentes)

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

    function processAssessmentTemplate(data) {
      const assessment = data.assessment || {};
      return {
        title: data.title || "Avaliação",
        date: new Date(),
        assessment: {
          subject: assessment.subject || "",
          period: assessment.period || "",
          criteria: assessment.criteria || [],
          sections: assessment.sections || [],
          ...assessment,
        },
        ...data,
      };
    }

    function processQuizTemplate(data) {
      const quiz = data.quiz || {};
      return {
        title: data.title || "Quiz",
        date: new Date(),
        quiz: {
          subject: quiz.subject || "",
          duration: quiz.duration || "",
          questions: quiz.questions || [],
          totalPoints: quiz.totalPoints || 0,
          ...quiz,
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

    function processInvoiceTemplate(data) {
      return processBudgetTemplate(data);
    }

    function processBudgetPremiumTemplate(data) {
      const budget = data.budget || {};
      const items = budget.items || [];

      const processedItems = items.map((item) => {
        const quantity = parseFloat(item.quantity) || 0;
        const unitPrice = parseFloat(item.unitPrice) || 0;
        const total = quantity * unitPrice;

        return { ...item, quantity, unitPrice, total };
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
          calculations: { subtotal, discountAmount, taxRate, taxAmount, total },
        },
      };

      if (data.logo?.url) {
        processedData.logo = {
          url: data.logo.url,
          width: data.logo.width || "120px",
          height: data.logo.height || "60px",
        };
      }

      if (data.watermark) {
        if (data.watermark.type === "logo" && data.watermark.logo?.url) {
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

    // Inicializa o cache na inicialização do plugin
    await getAvailableTemplates();
  },
  {
    name: "template-service",
    dependencies: ["handlebars"],
  }
);
