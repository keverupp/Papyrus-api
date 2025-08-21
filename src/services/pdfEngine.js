"use strict";

const fp = require("fastify-plugin");
const puppeteer = require("puppeteer");

module.exports = fp(
  async (app) => {
    let browser = null;

    app.decorate("pdfService", {
      generatePDF: generatePDF,
      initBrowser: initBrowser,
      closeBrowser: closeBrowser,
      applyWatermarkStyles: applyWatermarkStyles,
      optimizePage: optimizePage,
    });

    /**
     * Inicializa o browser Puppeteer com configurações otimizadas
     */
    async function initBrowser() {
      if (!browser) {
        try {
          browser = await puppeteer.launch({
            headless: true,
            args: [
              "--no-sandbox",
              "--disable-setuid-sandbox",
              "--disable-dev-shm-usage",
              "--disable-gpu",
              "--disable-web-security",
              "--disable-features=VizDisplayCompositor",
              "--disable-background-networking",
              "--disable-background-timer-throttling",
              "--disable-renderer-backgrounding",
              "--disable-backgrounding-occluded-windows",
              "--disable-client-side-phishing-detection",
              "--disable-ipc-flooding-protection",
              "--font-render-hinting=none", // Melhora renderização de fontes
            ],
            timeout: 30000,
          });

          app.log.info("🚀 Browser Puppeteer inicializado com sucesso");
        } catch (error) {
          app.log.error("❌ Erro ao inicializar browser:", error);
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
        try {
          await browser.close();
          browser = null;
          app.log.info("🛑 Browser Puppeteer fechado");
        } catch (error) {
          app.log.warn("⚠️ Erro ao fechar browser:", error);
        }
      }
    }

    /**
     * Gera PDF a partir do HTML renderizado usando configuração centralizada
     */
    async function generatePDF(htmlContent, templateType, userConfig = {}) {
      const currentBrowser = await initBrowser();
      const page = await currentBrowser.newPage();

      try {
        // Usa o serviço centralizado de configuração
        const pdfConfig = app.pdfConfigService.getTemplateConfig(
          templateType,
          userConfig
        );

        // Otimiza a página para melhor renderização
        await optimizePage(page, pdfConfig);

        // Define o HTML na página
        await page.setContent(htmlContent, {
          waitUntil: ["domcontentloaded", "networkidle0"],
          timeout: 30000,
        });

        // Aplica estilos de marca d'água se necessário
        await applyWatermarkStyles(page, userConfig.watermark);

        // Aguarda carregamento de fontes sem delay fixo
        await page.evaluate(async () => {
          if (document.fonts && document.fonts.ready) {
            await document.fonts.ready;
          }
        });

        // Log das configurações aplicadas
        app.log.info("📋 Configurações de PDF aplicadas:", {
          template: templateType,
          format: pdfConfig.format,
          landscape: pdfConfig.landscape,
          margins: pdfConfig.margin,
          printBackground: pdfConfig.printBackground,
          hasWatermark: !!userConfig.watermark,
        });

        // Gera o PDF com as configurações finais
        const pdfBuffer = await page.pdf({
          format: pdfConfig.format,
          landscape: pdfConfig.landscape,
          margin: pdfConfig.margin,
          printBackground: pdfConfig.printBackground,
          preferCSSPageSize: pdfConfig.preferCSSPageSize,
          displayHeaderFooter: pdfConfig.displayHeaderFooter,
          scale: pdfConfig.scale || 1,
        });

        // Log de sucesso com informações úteis
        app.log.info("✅ PDF gerado com sucesso:", {
          template: templateType,
          size: `${(pdfBuffer.length / 1024).toFixed(2)} KB`,
          format: pdfConfig.format,
          orientation: pdfConfig.landscape ? "landscape" : "portrait",
          pages: "calculado pelo Puppeteer",
        });

        return pdfBuffer;
      } catch (error) {
        app.log.error("❌ Erro ao gerar PDF:", {
          template: templateType,
          error: error.message,
          stack: error.stack,
        });
        throw new Error(`Falha na geração do PDF: ${error.message}`);
      } finally {
        try {
          await page.close();
        } catch (closeError) {
          app.log.warn("⚠️ Erro ao fechar página:", closeError);
        }
      }
    }

    /**
     * Otimiza configurações da página para melhor renderização
     */
    async function optimizePage(page, config) {
      try {
        // Configura viewport otimizado baseado no formato
        const viewportConfig = getViewportConfig(
          config.format,
          config.landscape
        );
        await page.setViewport(viewportConfig);

        // Desabilita JavaScript se não necessário (melhora performance)
        await page.setJavaScriptEnabled(false);

        // Configura user agent
        await page.setUserAgent("Papyrus-PDF-Generator/1.0");

        // Intercepta e bloqueia recursos desnecessários
        await page.setRequestInterception(true);
        page.on("request", (request) => {
          const resourceType = request.resourceType();

          // Bloqueia recursos que não precisamos para PDF
          if (["image", "media", "font", "stylesheet"].includes(resourceType)) {
            // Permite apenas se for local ou essencial
            const url = request.url();
            if (
              url.startsWith("data:") ||
              url.startsWith("blob:") ||
              url.includes("base64")
            ) {
              request.continue();
            } else {
              request.continue(); // Por enquanto permite tudo, pode filtrar depois
            }
          } else {
            request.continue();
          }
        });

        app.log.debug("🔧 Página otimizada para:", {
          format: config.format,
          viewport: viewportConfig,
          landscape: config.landscape,
        });
      } catch (error) {
        app.log.warn("⚠️ Erro na otimização da página:", error);
        // Continua mesmo com erro de otimização
      }
    }

    /**
     * Aplica estilos de marca d'água via JavaScript
     */
    async function applyWatermarkStyles(page, watermarkConfig) {
      if (!watermarkConfig) return;

      try {
        await page.evaluate((watermark) => {
          // Aplica opacidade correta para marca d'água de texto
          if (watermark.type !== "logo" && watermark.opacity) {
            const textWatermarks = document.querySelectorAll(".watermark-text");
            textWatermarks.forEach((element) => {
              element.style.opacity = watermark.opacity;

              // Aplica rotação se especificada
              if (watermark.rotation) {
                const currentTransform = element.style.transform || "";
                element.style.transform = currentTransform.includes("rotate")
                  ? currentTransform
                  : `${currentTransform} rotate(${watermark.rotation}deg)`;
              }

              // Aplica tamanho de fonte se especificado
              if (watermark.fontSize) {
                element.style.fontSize = watermark.fontSize;
              }
            });
          }

          // Aplica configurações para marca d'água de logo
          if (watermark.type === "logo" && watermark.logo) {
            const logoWatermarks = document.querySelectorAll(".watermark-logo");
            logoWatermarks.forEach((element) => {
              if (watermark.logo.opacity) {
                element.style.opacity = watermark.logo.opacity;
              }
              if (watermark.logo.width) {
                element.style.width = watermark.logo.width;
              }
              if (watermark.logo.height) {
                element.style.height = watermark.logo.height;
              }
            });
          }
        }, watermarkConfig);

        app.log.debug("🎨 Estilos de marca d'água aplicados:", {
          type: watermarkConfig.type || "text",
          opacity: watermarkConfig.opacity || watermarkConfig.logo?.opacity,
        });
      } catch (error) {
        app.log.warn("⚠️ Erro ao aplicar marca d'água:", error);
        // Continua mesmo com erro de marca d'água
      }
    }

    /**
     * Calcula viewport otimizado baseado no formato
     */
    function getViewportConfig(format, isLandscape) {
      const formats = {
        A4: { width: 794, height: 1123 },
        A5: { width: 559, height: 794 },
        A3: { width: 1123, height: 1588 },
        Letter: { width: 816, height: 1056 },
        Legal: { width: 816, height: 1344 },
        Tabloid: { width: 1224, height: 1584 },
      };

      let dimensions = formats[format] || formats.A4;

      // Inverte dimensões para paisagem
      if (isLandscape) {
        dimensions = {
          width: dimensions.height,
          height: dimensions.width,
        };
      }

      return {
        width: dimensions.width,
        height: dimensions.height,
        deviceScaleFactor: 2, // Melhora qualidade
        isMobile: false,
        hasTouch: false,
      };
    }

    // Hook para fechar browser quando servidor for fechado
    app.addHook("onClose", async () => {
      await closeBrowser();
    });

    // Inicializa browser na startup
    try {
      await initBrowser();
    } catch (error) {
      app.log.warn(
        "⚠️ Não foi possível inicializar browser na startup:",
        error
      );
    }

    app.log.info("🖨️ Serviço de PDF Engine registrado e otimizado");
  },
  {
    name: "pdf-service",
    dependencies: ["pdf-config-service"], // Depende do serviço de configuração
  }
);
