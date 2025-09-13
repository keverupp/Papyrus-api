"use strict";

const fp = require("fastify-plugin");
const { spawn } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");

module.exports = fp(
  async (app) => {
    app.decorate("typstEngine", {
      generatePDF,
      checkEngine,
    });

  /**
   * Verifica se o binário do typst está disponível
   */
  async function checkEngine() {
    return new Promise((resolve, reject) => {
      const proc = spawn("typst", ["--version"]);

      proc.on("error", reject);

      proc.on("close", (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error("typst não disponível"));
        }
      });
    });
  }

  /**
   * Gera um PDF a partir de um conteúdo typst
   * @param {string} typstContent Conteúdo já renderizado do template
   * @returns {Buffer} PDF gerado
   */
  async function generatePDF(typstContent) {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "typst-"));
    const inputPath = path.join(tempDir, "input.typ");
    const outputPath = path.join(tempDir, "output.pdf");

    try {
      await fs.writeFile(inputPath, typstContent, "utf8");

      await new Promise((resolve, reject) => {
        const args = ["compile", inputPath, outputPath];
        const proc = spawn("typst", args);

        let stderr = "";
        proc.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        proc.on("error", reject);

        proc.on("close", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(stderr || `typst exited with code ${code}`));
          }
        });
      });

      const pdf = await fs.readFile(outputPath);
      return pdf;
    } finally {
      // Limpa arquivos temporários
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }
  },
  { name: "typst-engine-service" }
);

