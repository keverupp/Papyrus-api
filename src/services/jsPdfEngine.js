"use strict";

const fp = require("fastify-plugin");
const { jsPDF } = require("jspdf");

module.exports = fp(async (app) => {
  app.decorate("pdfService", {
    generatePDF,
  });

  async function generatePDF(doc) {
    if (!doc || typeof doc.output !== "function") {
      throw new Error("Documento jsPDF inválido");
    }
    const arrayBuffer = doc.output("arraybuffer");
    return Buffer.from(arrayBuffer);
  }

  app.log.info("🖨️ jsPDF engine registrado");
}, { name: "pdf-service" });
