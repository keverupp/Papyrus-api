/*
TEMPLATE_META
name: Orçamento Premium JS
type: budget-premium
version: 2.0.1
language: pt-BR
supportedLanguages: pt-BR
description: Versão jsPDF do template avançado de orçamento premium
*/

const { jsPDF } = require("jspdf");

function generateBudgetPremium(data) {
  const doc = new jsPDF();

  const title = data.title || "Orçamento Premium";
  doc.setFontSize(16);
  doc.text(title, 105, 15, { align: "center" });

  let y = 25;

  const company = data.budget && data.budget.company ? data.budget.company : {};
  if (company.name) {
    doc.setFontSize(12);
    doc.text(company.name, 10, y);
    y += 6;
  }
  if (company.address) {
    doc.setFontSize(10);
    doc.text(company.address, 10, y);
    y += 5;
  }
  if (company.phone) {
    doc.text(`Tel: ${company.phone}`, 10, y);
    y += 5;
  }
  if (company.email) {
    doc.text(`Email: ${company.email}`, 10, y);
    y += 5;
  }

  y += 5;
  doc.setFontSize(12);
  doc.text("Itens", 10, y);
  y += 6;
  doc.setFontSize(10);

  const items = (data.budget && data.budget.items) || [];
  items.forEach((item) => {
    const quantity = item.quantity || 0;
    const unitPrice = item.unitPrice || 0;
    const total = item.total || quantity * unitPrice;
    const line = `${item.description} - ${quantity} x ${unitPrice.toFixed(2)} = ${total.toFixed(2)}`;
    doc.text(line, 10, y);
    y += 5;
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
  });

  y += 5;
  doc.setFontSize(12);
  const calculations = (data.budget && data.budget.calculations) || {};
  const totalValue = calculations.total !== undefined ? calculations.total.toFixed(2) : "";
  doc.text(`Total: ${totalValue}`, 10, y);

  return doc;
}

module.exports = generateBudgetPremium;
