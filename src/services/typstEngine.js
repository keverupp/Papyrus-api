"use strict";

const fp = require("fastify-plugin");
const { spawn } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const os = require("os");

module.exports = fp(
  async (app) => {
    const typstBin = app.config.pdf.typstBin;

    async function checkEngine() {
      return new Promise((resolve, reject) => {
        const proc = spawn(typstBin, ["--version"]);

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

    async function generatePDF(typstContent) {
      const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "typst-"));
      const inputPath = path.join(tempDir, "input.typ");
      const outputPath = path.join(tempDir, "output.pdf");

      try {
        await fs.writeFile(inputPath, typstContent, "utf8");

        await new Promise((resolve, reject) => {
          const args = ["compile", inputPath, outputPath];
          const proc = spawn(typstBin, args);

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
        await fs.rm(tempDir, { recursive: true, force: true });
      }
    }

    // Verifica disponibilidade do typst ao registrar o plugin
    try {
      await checkEngine();
    } catch (err) {
      app.log.error({ err }, "typst engine não encontrado");
      throw err;
    }

    app.decorate("typstEngine", {
      generatePDF,
      checkEngine,
    });
  },
  { name: "typst-engine-service", dependencies: ["config"] }
);

