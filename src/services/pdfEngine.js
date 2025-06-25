"use strict";

const fp = require("fastify-plugin");
const puppeteer = require("puppeteer");
const path = require("path");

module.exports = fp(
  async (app) => {
    let browser = null;

    app.decorate("pdfService", {
      generatePDF: generatePDF,
      getPageConfig: getPageConfig,
      initBrowser: initBrowser,
      closeBrowser: closeBrowser,
    });

    /**
     * Inicializa o browser Puppeteer
     */
    async function initBrowser() {
      if (!browser) {
        try {
          browser = await puppeteer.launch({
            headless: true, // Mudança: 'new' foi descontinuado
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-dev-shm-usage",
              "--disable-gpu",
              "--disable-web-security",
              "--disable-features=VizDisplayCompositor",
            ],
          });
          app.log.info("Browser Puppeteer inicializado");
        } catch (error) {
          app.log.error("Erro ao inicializar browser:", error);
          throw error;
        }
      }
      return browser;
    }

    /**
     * Fecha o browser Puppeteer
     */
    async function closeBrowser() {
      if (browser) {
        await browser.close();
        browser = null;
        app.log.info("Browser Puppeteer fechado");
      }
    }

    /**
     * Gera PDF a partir do HTML renderizado
     */
    async function generatePDF(htmlContent, config = {}) {
      const currentBrowser = await initBrowser();
      const page = await currentBrowser.newPage();

      try {
        // Configurações padrão do PDF
        const pdfConfig = getPageConfig(config);

        // Define o HTML na página
        await page.setContent(htmlContent, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });

        // Configurações de viewport
        await page.setViewport({
          width: 1200,
          height: 1600,
          deviceScaleFactor: 2,
        });

        // Adiciona CSS customizado se necessário
        if (config.customCSS) {
          await page.addStyleTag({ content: config.customCSS });
        }

        // Espera renderização completa
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Gera o PDF
        const pdfBuffer = await page.pdf(pdfConfig);

        app.log.info("PDF gerado com sucesso", {
          size: `${(pdfBuffer.length / 1024).toFixed(2)} KB`,
          pages: pdfConfig.format,
          orientation: pdfConfig.landscape ? "landscape" : "portrait",
        });

        return pdfBuffer;
      } catch (error) {
        app.log.error("Erro ao gerar PDF:", error);
        throw new Error(`Falha na geração do PDF: ${error.message}`);
      } finally {
        await page.close();
      }
    }

    /**
     * Retorna configurações da página baseadas no tipo de template
     */
    function getPageConfig(config = {}) {
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
        watermark: {
          ...defaultConfig,
          printBackground: true,
        },

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
          margin: {
            top: "1.5cm",
            right: "1.5cm",
            bottom: "2cm",
            left: "1.5cm",
          },
        },
        prescription: {
          ...defaultConfig,
          format: "A5",
          margin: { top: "1cm", right: "1cm", bottom: "1.5cm", left: "1cm" },
        },
        clinical_form: {
          ...defaultConfig,
          margin: {
            top: "1.5cm",
            right: "1.5cm",
            bottom: "2cm",
            left: "1.5cm",
          },
        },
      };

      // Usa configuração específica do template se existir
      const templateConfig =
        templateConfigs[config.templateType] || defaultConfig;

      // Sobrescreve com configurações customizadas
      return {
        ...templateConfig,
        ...config,
        margin: {
          ...templateConfig.margin,
          ...config.margin,
        },
      };
    }

    // Hook para fechar browser quando o servidor for fechado
    app.addHook("onClose", async () => {
      await closeBrowser();
    });

    // Inicializa o browser na inicialização do plugin
    await initBrowser();
  },
  {
    name: "pdf-service", // ← Nome adicionado
  }
);
