"use strict";

const fp = require("fastify-plugin");
const fs = require("fs").promises;
const path = require("path");

module.exports = fp(
  async (app) => {
    let translationsCache = null;
    let lastCacheTime = 0;
    const CACHE_DURATION = 60000; // 1 minuto

    app.decorate("i18nService", {
      getAvailableLanguages: getAvailableLanguages,
      getTranslations: getTranslations,
      translateTemplate: translateTemplate,
      getLocalizedTemplates: getLocalizedTemplates,
      refreshTranslationsCache: refreshTranslationsCache,
      formatMessage: formatMessage,
    });

    /**
     * Lista idiomas disponíveis
     */
    async function getAvailableLanguages() {
      return [
        {
          code: "pt-BR",
          name: "Português (Brasil)",
          flag: "🇧🇷",
          isDefault: true,
        },
        {
          code: "en-US",
          name: "English (United States)",
          flag: "🇺🇸",
          isDefault: false,
        },
        {
          code: "es-ES",
          name: "Español (España)",
          flag: "🇪🇸",
          isDefault: false,
        },
      ];
    }

    /**
     * Carrega traduções com cache
     */
    async function getTranslations(language = "pt-BR") {
      const now = Date.now();

      // Usa cache se ainda válido
      if (
        translationsCache &&
        translationsCache[language] &&
        now - lastCacheTime < CACHE_DURATION
      ) {
        return translationsCache[language];
      }

      try {
        const translationsPath = path.resolve(
          "src/locales",
          `${language}.json`
        );

        // Verifica se arquivo existe
        try {
          await fs.access(translationsPath);
        } catch {
          // Fallback para português se idioma não existir
          if (language !== "pt-BR") {
            app.log.warn(
              `Tradução não encontrada para ${language}, usando pt-BR`
            );
            return await getTranslations("pt-BR");
          }
          throw new Error(`Arquivo de tradução não encontrado: ${language}`);
        }

        const translationsContent = await fs.readFile(translationsPath, "utf8");
        const translations = JSON.parse(translationsContent);

        // Atualiza cache
        if (!translationsCache) translationsCache = {};
        translationsCache[language] = translations;
        lastCacheTime = now;

        app.log.debug(`Traduções carregadas para ${language}`);
        return translations;
      } catch (error) {
        app.log.error(`Erro ao carregar traduções para ${language}:`, error);

        // Fallback básico se tudo falhar
        if (language === "pt-BR") {
          return getDefaultTranslations();
        }

        return await getTranslations("pt-BR");
      }
    }

    /**
     * Traduz informações de um template usando metadados do próprio template
     */
    async function translateTemplate(templateInfo, language = "pt-BR") {
      // Se já está no idioma solicitado, retorna como está
      if (templateInfo.language === language) {
        return templateInfo;
      }

      try {
        // Busca versão do template no idioma solicitado
        const translatedTemplate =
          await app.templateService.getTemplateByLanguage(
            templateInfo.type,
            language
          );

        if (translatedTemplate) {
          return translatedTemplate;
        }

        // Fallback: usa traduções gerais se template específico não existir
        const translations = await getTranslations(language);
        const templateTranslations =
          translations.templates?.[templateInfo.type] || {};

        return {
          ...templateInfo,
          name: templateTranslations.name || templateInfo.name,
          description:
            templateTranslations.description || templateInfo.description,
          tags: templateTranslations.tags || templateInfo.tags,
          language: language,
          // Mantém dados técnicos originais
          originalName: templateInfo.name,
          originalDescription: templateInfo.description,
          originalLanguage: templateInfo.language || "pt-BR",
        };
      } catch (error) {
        app.log.error(`Erro ao traduzir template ${templateInfo.type}:`, error);
        return templateInfo; // Retorna original em caso de erro
      }
    }

    /**
     * Obtém templates filtrados por idioma específico
     */
    async function getLocalizedTemplates(language = "pt-BR") {
      try {
        // Usa a nova função que já filtra por idioma
        const templatesInLanguage =
          await app.templateService.getTemplatesByLanguage(language);

        // Traduz os nomes das categorias se necessário
        if (language !== "pt-BR") {
          const translations = await getTranslations(language);
          const localizedTemplates = {};

          for (const [category, templates] of Object.entries(
            templatesInLanguage
          )) {
            const categoryTranslation =
              translations.categories?.[category] || category;
            localizedTemplates[categoryTranslation] = templates;
          }

          app.log.info(
            `📋 Templates localizados para ${language}: ${
              Object.values(localizedTemplates).flat().length
            } encontrados`
          );
          return localizedTemplates;
        }

        app.log.info(
          `📋 Templates para ${language}: ${
            Object.values(templatesInLanguage).flat().length
          } encontrados`
        );
        return templatesInLanguage;
      } catch (error) {
        app.log.error("Erro ao localizar templates:", error);
        return {};
      }
    }

    /**
     * Formata mensagem com interpolação
     */
    function formatMessage(template, variables = {}) {
      let result = template;

      // Substitui variáveis no formato {{variavel}}
      Object.keys(variables).forEach((key) => {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
        result = result.replace(regex, variables[key]);
      });

      return result;
    }

    /**
     * Refresh do cache de traduções
     */
    async function refreshTranslationsCache() {
      translationsCache = null;
      lastCacheTime = 0;
      app.log.info("🔄 Cache de traduções limpo");
    }

    /**
     * Traduções padrão de fallback
     */
    function getDefaultTranslations() {
      return {
        templates: {
          blank: {
            name: "Página em Branco",
            description: "Documento básico sem formatação específica",
          },
          exam: {
            name: "Prova/Exame",
            description: "Template para provas e exames escolares",
          },
        },
        categories: {
          basic: "Básicos",
          educational: "Educacionais",
          business: "Empresariais",
          medical: "Médicos",
        },
        messages: {
          success: "Sucesso",
          error: "Erro",
          loading: "Carregando...",
        },
      };
    }

    // Pré-carrega traduções padrão para agilizar primeira requisição
    await getTranslations();
    app.log.info("🌍 Serviço de i18n registrado");
  },
  {
    name: "i18n-service",
    dependencies: ["template-service"],
  }
);
