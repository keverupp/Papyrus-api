"use strict";

const fp = require("fastify-plugin");
const handlebars = require("handlebars");
const fs = require("fs").promises;
const path = require("path");

module.exports = fp(
  async (app) => {
    // Cache de templates compilados
    const templateCache = new Map();

    // Registra helpers customizados do Handlebars
    registerHelpers();

    app.decorate("handlebars", {
      compile: handlebars.compile,
      registerHelper: handlebars.registerHelper,
      registerPartial: handlebars.registerPartial,
      loadTemplate: loadTemplate,
      renderTemplate: renderTemplate,
    });

    /**
     * Carrega um template do disco
     */
    async function loadTemplate(templatePath) {
      try {
        const fullPath = path.resolve("src/templates", templatePath);

        const stats = await fs.stat(fullPath);
        const cached = templateCache.get(fullPath);
        if (cached && cached.mtimeMs === stats.mtimeMs) {
          return cached.compiled;
        }

        const templateContent = await fs.readFile(fullPath, "utf8");
        const compiled = handlebars.compile(templateContent);
        templateCache.set(fullPath, { compiled, mtimeMs: stats.mtimeMs });
        return compiled;
      } catch (error) {
        app.log.error(`Erro ao carregar template ${templatePath}:`, error);
        throw new Error(`Template não encontrado: ${templatePath}`);
      }
    }

    /**
     * Renderiza um template com dados
     */
    async function renderTemplate(templatePath, data = {}) {
      try {
        const template = await loadTemplate(templatePath);
        return template(data);
      } catch (error) {
        app.log.error(`Erro ao renderizar template ${templatePath}:`, error);
        throw error;
      }
    }

    /**
     * Registra helpers customizados para os templates
     */
    function registerHelpers() {
      // Helper para formatação de moeda
      handlebars.registerHelper("currency", function (value) {
        if (!value && value !== 0) return "R$ 0,00";

        const numValue = parseFloat(value) || 0;

        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(numValue);
      });

      // Helper para formatação de data
      handlebars.registerHelper("date", function (date, format = "DD/MM/YYYY") {
        let d;

        // Se não foi passada uma data, usar data atual
        if (!date) {
          d = new Date();
        } else if (date instanceof Date) {
          d = date;
        } else {
          d = new Date(date);
        }

        // Verificar se a data é válida
        if (isNaN(d.getTime())) {
          d = new Date(); // Fallback para data atual
        }

        switch (format) {
          case "DD/MM/YYYY":
            return d.toLocaleDateString("pt-BR");
          case "DD/MM/YYYY HH:mm":
            return d.toLocaleString("pt-BR");
          default:
            return d.toLocaleDateString("pt-BR");
        }
      });

      // Helper para cálculos matemáticos
      handlebars.registerHelper("math", function (lvalue, operator, rvalue) {
        const left = parseFloat(lvalue) || 0;
        const right = parseFloat(rvalue) || 0;

        switch (operator) {
          case "+":
            return left + right;
          case "-":
            return left - right;
          case "*":
            return left * right;
          case "/":
            return right !== 0 ? left / right : 0;
          case "%":
            return right !== 0 ? left % right : 0;
          default:
            return left;
        }
      });

      // Helper para formatação de números
      handlebars.registerHelper("number", function (value, decimals = 2) {
        if (!value && value !== 0) return "0";

        // Garante que decimals seja um número válido entre 0 e 20
        const safeDecimals = Math.max(0, Math.min(20, parseInt(decimals) || 2));

        return new Intl.NumberFormat("pt-BR", {
          minimumFractionDigits: safeDecimals,
          maximumFractionDigits: safeDecimals,
        }).format(parseFloat(value) || 0);
      });

      // Helper para loops com index
      handlebars.registerHelper("times", function (n, block) {
        let result = "";
        for (let i = 0; i < n; i++) {
          result += block.fn({ index: i, number: i + 1 });
        }
        return result;
      });

      // Helper para condicionais avançadas
      handlebars.registerHelper("ifCond", function (v1, operator, v2, options) {
        switch (operator) {
          case "==":
            return v1 == v2 ? options.fn(this) : options.inverse(this);
          case "===":
            return v1 === v2 ? options.fn(this) : options.inverse(this);
          case "!=":
            return v1 != v2 ? options.fn(this) : options.inverse(this);
          case "!==":
            return v1 !== v2 ? options.fn(this) : options.inverse(this);
          case "<":
            return v1 < v2 ? options.fn(this) : options.inverse(this);
          case "<=":
            return v1 <= v2 ? options.fn(this) : options.inverse(this);
          case ">":
            return v1 > v2 ? options.fn(this) : options.inverse(this);
          case ">=":
            return v1 >= v2 ? options.fn(this) : options.inverse(this);
          case "&&":
            return v1 && v2 ? options.fn(this) : options.inverse(this);
          case "||":
            return v1 || v2 ? options.fn(this) : options.inverse(this);
          default:
            return options.inverse(this);
        }
      });

      // Helper para uppercase
      handlebars.registerHelper("upper", function (str) {
        return str ? str.toString().toUpperCase() : "";
      });

      // Helper para lowercase
      handlebars.registerHelper("lower", function (str) {
        return str ? str.toString().toLowerCase() : "";
      });

      // Helper para quebra de linha
      handlebars.registerHelper("br", function (text) {
        if (!text) return "";
        return new handlebars.SafeString(
          text.toString().replace(/\n/g, "<br>")
        );
      });
    }

    // Carrega partials automaticamente ao inicializar
    await loadPartials();

    async function loadPartials() {
      try {
        const partialsDir = path.resolve("src/templates/partials");

        // Verifica se o diretório existe
        try {
          await fs.access(partialsDir);
        } catch {
          // Cria o diretório se não existir
          await fs.mkdir(partialsDir, { recursive: true });
          return;
        }

        const files = await fs.readdir(partialsDir);

        for (const file of files) {
          if (file.endsWith(".hbs") || file.endsWith(".handlebars")) {
            const partialName = path.basename(file, path.extname(file));
            const partialPath = path.join(partialsDir, file);
            const partialContent = await fs.readFile(partialPath, "utf8");

            handlebars.registerPartial(partialName, partialContent);
            app.log.info(`Partial registrado: ${partialName}`);
          }
        }
      } catch (error) {
        app.log.error("Erro ao carregar partials:", error);
      }
    }
  },
  { name: "handlebars" }
);
