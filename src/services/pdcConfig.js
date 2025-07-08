"use strict";

const fp = require("fastify-plugin");

module.exports = fp(
  async (app) => {
    app.decorate("pdfConfigService", {
      getTemplateConfig: getTemplateConfig,
      validateConfig: validateConfig,
      getMarginConfig: getMarginConfig,
      getOrientationConfig: getOrientationConfig,
      mergeConfigs: mergeConfigs,
    });

    /**
     * Configuração centralizada para geração de PDFs
     * Resolve conflitos entre templates e configurações do usuário
     */
    function getTemplateConfig(templateType, userConfig = {}) {
      // Configurações padrão globais
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
        displayHeaderFooter: false,
        scale: 1,
        quality: 100,
      };

      // Configurações específicas por tipo de template
      const templateConfigs = {
        // ========== TEMPLATES BÁSICOS ==========
        blank: {
          ...defaultConfig,
          margin: {
            top: "2.5cm",
            right: "2cm",
            bottom: "2.5cm",
            left: "2cm",
          },
        },

        logo: {
          ...defaultConfig,
          margin: {
            top: "3cm", // Mais espaço para logo
            right: "2cm",
            bottom: "2cm",
            left: "2cm",
          },
        },

        watermark: {
          ...defaultConfig,
          printBackground: true, // Essencial para marca d'água
          margin: {
            top: "2cm",
            right: "2cm",
            bottom: "2cm",
            left: "2cm",
          },
        },

        // ========== TEMPLATES EDUCACIONAIS ==========
        exam: {
          ...defaultConfig,
          format: "A4",
          landscape: false,
          margin: {
            top: "1.5cm", // Menor margem para aproveitar espaço
            right: "1.8cm",
            bottom: "2cm",
            left: "1.8cm",
          },
        },

        assessment: {
          ...defaultConfig,
          margin: {
            top: "1.8cm",
            right: "2cm",
            bottom: "2.2cm",
            left: "2cm",
          },
        },

        quiz: {
          ...defaultConfig,
          margin: {
            top: "1.5cm",
            right: "1.8cm",
            bottom: "2cm",
            left: "1.8cm",
          },
        },

        // ========== TEMPLATES EMPRESARIAIS ==========
        budget: {
          ...defaultConfig,
          format: "A4",
          landscape: false,
          margin: {
            top: "1.2cm", // Margens otimizadas para tabelas
            right: "1.5cm",
            bottom: "1.8cm",
            left: "1.5cm",
          },
        },

        "budget-premium": {
          ...defaultConfig,
          format: "A4",
          landscape: false,
          printBackground: true, // Para logos e marca d'água
          margin: {
            top: "1.2cm",
            right: "1.5cm",
            bottom: "1.8cm",
            left: "1.5cm",
          },
        },

        report: {
          ...defaultConfig,
          margin: {
            top: "2.5cm", // Mais formal
            right: "2.5cm",
            bottom: "2.5cm",
            left: "2.5cm",
          },
        },

        invoice: {
          ...defaultConfig,
          margin: {
            top: "1.2cm",
            right: "1.5cm",
            bottom: "2cm", // Espaço para rodapé fiscal
            left: "1.5cm",
          },
        },

        // ========== TEMPLATES MÉDICOS ==========
        anamnesis: {
          ...defaultConfig,
          format: "A4",
          landscape: false,
          margin: {
            top: "1.8cm",
            right: "1.5cm",
            bottom: "2cm",
            left: "1.5cm",
          },
        },

        prescription: {
          ...defaultConfig,
          format: "A5", // Tamanho menor para receitas
          landscape: false,
          margin: {
            top: "1cm",
            right: "1cm",
            bottom: "1.5cm",
            left: "1cm",
          },
        },

        clinical_form: {
          ...defaultConfig,
          margin: {
            top: "1.8cm",
            right: "1.5cm",
            bottom: "2cm",
            left: "1.5cm",
          },
        },
      };

      // Busca configuração do template ou usa padrão
      const templateConfig = templateConfigs[templateType] || defaultConfig;

      // Merge inteligente com configurações do usuário
      const finalConfig = mergeConfigs(templateConfig, userConfig);

      // Valida configurações finais
      const validation = validateConfig(finalConfig);
      if (!validation.isValid) {
        app.log.warn("Configuração de PDF inválida, usando padrões:", {
          template: templateType,
          errors: validation.errors,
        });
        return templateConfig; // Retorna configuração do template sem merge
      }

      app.log.debug("Configuração de PDF gerada:", {
        template: templateType,
        format: finalConfig.format,
        landscape: finalConfig.landscape,
        margins: finalConfig.margin,
        hasUserConfig: Object.keys(userConfig).length > 0,
      });

      return finalConfig;
    }

    /**
     * Valida configurações de PDF
     */
    function validateConfig(config) {
      const errors = [];

      // Valida formato
      const validFormats = ["A4", "A5", "A3", "Letter", "Legal", "Tabloid"];
      if (config.format && !validFormats.includes(config.format)) {
        errors.push(
          `Formato '${config.format}' inválido. Use: ${validFormats.join(", ")}`
        );
      }

      // Valida orientação
      if (
        config.landscape !== undefined &&
        typeof config.landscape !== "boolean"
      ) {
        errors.push(
          "Orientação deve ser boolean (true = paisagem, false = retrato)"
        );
      }

      // Valida margens
      if (config.margin) {
        const marginKeys = ["top", "right", "bottom", "left"];
        for (const key of marginKeys) {
          if (config.margin[key]) {
            const marginValue = config.margin[key];
            // Aceita valores como "2cm", "20mm", "0.5in", "15px"
            if (!/^\d+(\.\d+)?(cm|mm|in|px)$/.test(marginValue)) {
              errors.push(
                `Margem '${key}' inválida: '${marginValue}'. Use formato: '2cm', '20mm', '1in' ou '15px'`
              );
            }
          }
        }
      }

      // Valida escala
      if (config.scale && (config.scale < 0.1 || config.scale > 2)) {
        errors.push("Escala deve estar entre 0.1 e 2.0");
      }

      return {
        isValid: errors.length === 0,
        errors,
      };
    }

    /**
     * Configurações específicas de margem por categoria
     */
    function getMarginConfig(category) {
      const marginPresets = {
        compact: {
          top: "1cm",
          right: "1.2cm",
          bottom: "1.2cm",
          left: "1.2cm",
        },
        standard: {
          top: "2cm",
          right: "2cm",
          bottom: "2cm",
          left: "2cm",
        },
        wide: {
          top: "2.5cm",
          right: "3cm",
          bottom: "2.5cm",
          left: "3cm",
        },
        narrow: {
          top: "1.5cm",
          right: "1.5cm",
          bottom: "1.5cm",
          left: "1.5cm",
        },
      };

      return marginPresets[category] || marginPresets.standard;
    }

    /**
     * Configurações de orientação com adjustes automáticos
     */
    function getOrientationConfig(orientation, templateType) {
      const config = {
        landscape: orientation === "landscape",
      };

      // Ajustes automáticos de margem para paisagem
      if (config.landscape) {
        // Para templates com muitas colunas, ajusta margens laterais
        const wideTemplates = ["budget", "budget-premium", "invoice"];
        if (wideTemplates.includes(templateType)) {
          config.marginAdjustment = {
            left: "1cm",
            right: "1cm",
            top: "1.5cm",
            bottom: "1.5cm",
          };
        }
      }

      return config;
    }

    /**
     * Merge inteligente de configurações
     */
    function mergeConfigs(templateConfig, userConfig) {
      const result = { ...templateConfig };

      // Merge simples para propriedades de primeiro nível
      Object.keys(userConfig).forEach((key) => {
        if (key === "margin" && userConfig.margin) {
          // Merge especial para margens
          result.margin = {
            ...templateConfig.margin,
            ...userConfig.margin,
          };
        } else if (key === "orientation") {
          // Converte string orientation para boolean landscape
          if (userConfig.orientation === "landscape") {
            result.landscape = true;
          } else if (userConfig.orientation === "portrait") {
            result.landscape = false;
          }
        } else if (userConfig[key] !== undefined) {
          result[key] = userConfig[key];
        }
      });

      return result;
    }

    app.log.info("📐 Serviço de configuração de PDF registrado");
  },
  {
    name: "pdf-config-service",
  }
);
