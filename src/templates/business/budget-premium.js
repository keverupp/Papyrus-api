const { jsPDF } = require("jspdf");

async function generateBudgetPremium(data) {
  const doc = new jsPDF({
    format: "a4",
    orientation: "portrait",
  });

  // MARGENS MÍNIMAS
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = { left: 8, right: 8, top: 8, bottom: 8 };
  const contentWidth = pageWidth - margin.left - margin.right;
  let y = margin.top;

  // Paleta de cores
  const colors = {
    primary: [33, 47, 61],
    secondary: [93, 109, 126],
    accent: [41, 128, 185],
    success: [22, 160, 133],
    danger: [203, 67, 53],
    light: [250, 252, 253],
    border: [223, 230, 233],
    muted: [127, 140, 141],
    text: [44, 62, 80],
    gradient: [236, 240, 241],
    // CORES PARA ZEBRA STRIPING MAIS FORTE
    zebraLight: [248, 250, 252], // Branco quase puro
    zebraDark: [240, 244, 248], // Cinza mais visível
    tableBorder: [200, 206, 212], // Cinza para linhas separadoras
  };

  // FUNÇÃO CORRIGIDA PARA BORDAS ARREDONDADAS SEM ARTEFATOS
  function drawRoundedRect(
    x,
    y,
    width,
    height,
    radius,
    fillColor = null,
    strokeColor = null
  ) {
    if (radius > Math.min(width, height) / 2) {
      radius = Math.min(width, height) / 2; // Limita o raio para evitar artefatos
    }

    if (fillColor) {
      doc.setFillColor(...fillColor);
    }
    if (strokeColor) {
      doc.setDrawColor(...strokeColor);
      doc.setLineWidth(0.2); // Linha mais fina
    }

    // Usa a função nativa roundedRect do jsPDF (mais limpa)
    const style =
      fillColor && strokeColor
        ? "FD"
        : fillColor
        ? "F"
        : strokeColor
        ? "S"
        : "S";

    try {
      // Verifica se roundedRect está disponível
      if (typeof doc.roundedRect === "function") {
        doc.roundedRect(x, y, width, height, radius, radius, style);
      } else {
        // Fallback para retângulo simples se roundedRect não estiver disponível
        doc.rect(x, y, width, height, style);
      }
    } catch (error) {
      // Fallback seguro
      doc.rect(x, y, width, height, style);
    }
  }

  // FUNÇÃO PARA BORDAS ARREDONDADAS APENAS NO TOPO
  function drawTopRoundedRect(
    x,
    y,
    width,
    height,
    radius,
    fillColor = null,
    strokeColor = null
  ) {
    if (radius > Math.min(width, height) / 2) {
      radius = Math.min(width, height) / 2;
    }

    if (fillColor) {
      doc.setFillColor(...fillColor);
    }
    if (strokeColor) {
      doc.setDrawColor(...strokeColor);
      doc.setLineWidth(0.2);
    }

    // Método simples: usar roundedRect + sobreposição
    const style =
      fillColor && strokeColor
        ? "FD"
        : fillColor
        ? "F"
        : strokeColor
        ? "S"
        : "S";

    // Desenha retângulo com todos os cantos arredondados
    try {
      if (typeof doc.roundedRect === "function") {
        doc.roundedRect(x, y, width, height, radius, radius, style);
      } else {
        doc.rect(x, y, width, height, style);
      }

      // "Remove" os cantos arredondados da parte inferior
      if (fillColor) {
        doc.setFillColor(...fillColor);
        doc.rect(x, y + height / 2, width, height / 2, "F");
      }
    } catch (error) {
      // Fallback para retângulo simples
      doc.rect(x, y, width, height, style);
    }
  }

  // FUNÇÃO CORRIGIDA PARA PRESERVAR ASPECT RATIO DAS IMAGENS
  function calculateImageDimensions(imgData, maxWidth, maxHeight) {
    try {
      // Usa getImageProperties para obter dimensões reais da imagem
      const imgProps = doc.getImageProperties(imgData);
      const originalWidth = imgProps.width;
      const originalHeight = imgProps.height;

      if (!originalWidth || !originalHeight) {
        return { width: maxWidth, height: maxHeight };
      }

      // Calcula o aspect ratio correto
      const aspectRatio = originalWidth / originalHeight;

      // Calcula as dimensões finais preservando aspect ratio
      let finalWidth = maxWidth;
      let finalHeight = maxHeight;

      const widthRatio = maxWidth / originalWidth;
      const heightRatio = maxHeight / originalHeight;
      const scale = Math.min(widthRatio, heightRatio);

      finalWidth = originalWidth * scale;
      finalHeight = originalHeight * scale;

      return { width: finalWidth, height: finalHeight };
    } catch (error) {
      console.warn("Erro ao calcular dimensões da imagem:", error);
      return { width: maxWidth, height: maxHeight };
    }
  }

  // Função helper otimizada
  function breakText(text, maxWidth, fontSize = 8) {
    if (!text) return [""];
    doc.setFontSize(fontSize);
    return doc.splitTextToSize(text.toString(), maxWidth);
  }

  // Função para verificar quebra de página (sem marca d'água)
  function checkPageBreak(requiredHeight) {
    if (y + requiredHeight > pageHeight - margin.bottom - 8) {
      doc.addPage();
      y = margin.top + 5;
      return true;
    }
    return false;
  }

  // CABEÇALHO ULTRA-COMPACTO
  const headerHeight = 22;
  let xLogo = margin.left;

  if (data.logo && data.logo.url) {
    try {
      const logoRes = await fetch(data.logo.url);
      const logoArrayBuffer = await logoRes.arrayBuffer();
      const logoBuf = Buffer.from(logoArrayBuffer);
      const logoBase64 = `data:image/png;base64,${logoBuf.toString("base64")}`;

      const maxLogoWidth = 25;
      const maxLogoHeight = 12;

      // USA A FUNÇÃO CORRIGIDA PARA CALCULAR DIMENSÕES
      const logoDims = calculateImageDimensions(
        logoBase64,
        maxLogoWidth,
        maxLogoHeight
      );

      doc.addImage(
        logoBase64,
        "PNG",
        xLogo,
        y,
        logoDims.width,
        logoDims.height
      );
      xLogo += logoDims.width + 5;
    } catch (error) {
      console.warn("Erro ao carregar logo:", error);
    }
  }

  // Nome da empresa compacto
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...colors.primary);
  doc.text(data.budget.company?.name || "", xLogo, y + 5);

  // Detalhes em uma linha só
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...colors.secondary);
  let companyDetails = [];
  if (data.budget.company?.cnpj)
    companyDetails.push(`CNPJ: ${data.budget.company.cnpj}`);
  if (data.budget.company?.address)
    companyDetails.push(data.budget.company.address);
  if (companyDetails.length > 0) {
    doc.text(companyDetails.join(" • "), xLogo, y + 9);
  }

  // Meta do orçamento compacta
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...colors.primary);
  const budgetTitle = data.budget.number
    ? `Proposta Nº ${data.budget.number}`
    : data.title || "Orçamento Premium";
  doc.text(budgetTitle, pageWidth - margin.right, y + 5, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...colors.secondary);
  const currentDate = new Date().toLocaleDateString("pt-BR");
  doc.text(`Data: ${currentDate}`, pageWidth - margin.right, y + 9, {
    align: "right",
  });

  if (data.budget.validUntil) {
    doc.text(
      `Válida até: ${data.budget.validUntil}`,
      pageWidth - margin.right,
      y + 13,
      { align: "right" }
    );
  }

  // Linha separadora fina
  doc.setDrawColor(...colors.accent);
  doc.setLineWidth(1);
  doc.line(
    margin.left,
    y + headerHeight - 2,
    pageWidth - margin.right,
    y + headerHeight - 2
  );

  y += headerHeight + 4;

  // SEÇÃO CLIENTE - CORRIGIDA COM BORDAS LIMPAS
  if (data.budget.client) {
    checkPageBreak(18);

    const clientBoxHeight = 16;
    const borderRadius = 3; // Raio ligeiramente maior para melhor aparência

    // Fundo com bordas arredondadas CORRIGIDAS
    drawRoundedRect(
      margin.left,
      y,
      contentWidth,
      clientBoxHeight,
      borderRadius,
      colors.gradient,
      colors.border
    );

    // Título compacto
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(...colors.primary);
    doc.text("CLIENTE", margin.left + 4, y + 5);

    // Dados em linha única
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    let yClient = y + 10;

    const clientData = [
      data.budget.client.name,
      data.budget.client.document,
      data.budget.client.email,
      data.budget.client.phone,
    ].filter(Boolean);

    if (clientData.length > 0) {
      doc.setTextColor(...colors.text);
      const clientText = clientData.join(" | ");
      const clientLines = breakText(clientText, contentWidth - 8, 6);
      doc.text(clientLines[0] || "", margin.left + 4, yClient);

      if (clientLines[1]) {
        doc.text(clientLines[1], margin.left + 4, yClient + 4);
      }
    }

    y += clientBoxHeight + 6;
  }

  // TABELA MELHORADA COM ZEBRA STRIPING MAIS FORTE E LINHAS SEPARADORAS
  if (data.budget.items && data.budget.items.length > 0) {
    checkPageBreak(25);

    const tableX = margin.left;
    const colWidths = {
      description: contentWidth * 0.52,
      quantity: contentWidth * 0.08,
      unitPrice: contentWidth * 0.2,
      total: contentWidth * 0.2,
    };

    const colPositions = {
      description: tableX,
      quantity: tableX + colWidths.description,
      unitPrice: tableX + colWidths.description + colWidths.quantity,
      total:
        tableX +
        colWidths.description +
        colWidths.quantity +
        colWidths.unitPrice,
    };

    // Header compacto com bordas arredondadas APENAS NO TOPO
    const headerHeight = 8;
    const headerRadius = 2;
    drawTopRoundedRect(
      tableX,
      y,
      contentWidth,
      headerHeight,
      headerRadius,
      colors.primary
    );

    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(255, 255, 255);

    doc.text("DESCRIÇÃO", colPositions.description + 3, y + 5);
    doc.text("QTD", colPositions.quantity + colWidths.quantity / 2, y + 5, {
      align: "center",
    });
    doc.text(
      "VALOR UNIT.",
      colPositions.unitPrice + colWidths.unitPrice - 3,
      y + 5,
      { align: "right" }
    );
    doc.text("TOTAL", colPositions.total + colWidths.total - 3, y + 5, {
      align: "right",
    });

    y += headerHeight;

    // ITENS DA TABELA COM ZEBRA STRIPING MAIS FORTE E LINHAS SEPARADORAS
    let total = 0;

    data.budget.items.forEach((item, index) => {
      const rowHeight = 8;
      checkPageBreak(rowHeight + 2);

      // ZEBRA STRIPING MAIS CONTRASTANTE
      if (index % 2 === 0) {
        // Linhas pares - cor mais escura para maior contraste
        doc.setFillColor(...colors.zebraDark);
        doc.rect(tableX, y, contentWidth, rowHeight, "F");
      } else {
        // Linhas ímpares - branco
        doc.setFillColor(...colors.zebraLight);
        doc.rect(tableX, y, contentWidth, rowHeight, "F");
      }

      // Descrição
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(...colors.text);
      const descLines = breakText(
        item.description || "",
        colWidths.description - 6,
        7
      );
      doc.text(descLines[0] || "", colPositions.description + 3, y + 5);

      // Quantidade
      const qty = item.quantity || 0;
      doc.text(
        qty.toString(),
        colPositions.quantity + colWidths.quantity / 2,
        y + 5,
        { align: "center" }
      );

      // Valor unitário
      const unitPrice = item.unitPrice || 0;
      doc.text(
        `R$ ${unitPrice.toFixed(2)}`,
        colPositions.unitPrice + colWidths.unitPrice - 3,
        y + 5,
        { align: "right" }
      );

      // Total do item
      const rowTotal = qty * unitPrice;
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...colors.success);
      doc.text(
        `R$ ${rowTotal.toFixed(2)}`,
        colPositions.total + colWidths.total - 3,
        y + 5,
        { align: "right" }
      );

      total += rowTotal;
      y += rowHeight;

      // LINHA SEPARADORA FINA ENTRE OS ITENS
      if (index < data.budget.items.length - 1) {
        doc.setDrawColor(...colors.tableBorder);
        doc.setLineWidth(0.3); // Linha bem fina mas visível
        doc.line(tableX + 2, y, pageWidth - margin.right - 2, y); // Pequeno offset nas bordas
      }
    });

    // BORDA INFERIOR DA TABELA (mais espessa)
    doc.setDrawColor(...colors.tableBorder);
    doc.setLineWidth(0.5);
    doc.line(tableX, y, pageWidth - margin.right, y);

    y += 4;
  }

  // TOTAIS COMPACTOS COM BORDAS LIMPAS
  checkPageBreak(25);

  const totalsWidth = contentWidth * 0.35;
  const totalsX = pageWidth - margin.right - totalsWidth;
  const totalsBoxHeight = 25;
  const totalsRadius = 2;

  // Background com bordas arredondadas LIMPAS
  drawRoundedRect(
    totalsX - 4,
    y,
    totalsWidth + 8,
    totalsBoxHeight,
    totalsRadius,
    colors.light,
    colors.border
  );

  y += 3;

  // Subtotal
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...colors.secondary);
  doc.text("Subtotal:", totalsX, y + 5);

  doc.setTextColor(...colors.text);
  doc.setFont("helvetica", "bold");
  const subtotal =
    data.budget.items?.reduce(
      (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
      0
    ) || 0;
  doc.text(`R$ ${subtotal.toFixed(2)}`, pageWidth - margin.right - 2, y + 5, {
    align: "right",
  });
  y += 8;

  // Desconto
  if (data.budget.discount && data.budget.discount > 0) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...colors.secondary);
    doc.text("Desconto:", totalsX, y + 5);

    doc.setTextColor(...colors.danger);
    doc.setFont("helvetica", "bold");
    doc.text(
      `- R$ ${data.budget.discount.toFixed(2)}`,
      pageWidth - margin.right - 2,
      y + 5,
      { align: "right" }
    );
    y += 8;
  }

  // Total final com bordas arredondadas LIMPAS
  const finalTotal = subtotal - (data.budget.discount || 0);
  const finalTotalRadius = 3;
  drawRoundedRect(
    totalsX - 4,
    y,
    totalsWidth + 8,
    10,
    finalTotalRadius,
    colors.success
  );

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("VALOR TOTAL:", totalsX, y + 7);
  doc.text(`R$ ${finalTotal.toFixed(2)}`, pageWidth - margin.right - 2, y + 7, {
    align: "right",
  });

  y += 15;

  // OBSERVAÇÕES E TERMOS COM BORDAS LIMPAS
  if (data.budget.notes || data.budget.terms) {
    checkPageBreak(20);

    y += 3;
    const sectionWidth = (contentWidth - 6) / 2;
    const sectionHeight = 18;
    const sectionRadius = 3;

    // Observações
    if (data.budget.notes) {
      drawRoundedRect(
        margin.left,
        y,
        sectionWidth,
        sectionHeight,
        sectionRadius,
        colors.light,
        colors.border
      );

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(...colors.primary);
      doc.text("OBSERVAÇÕES", margin.left + 4, y + 5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(...colors.text);
      const notesLines = breakText(data.budget.notes, sectionWidth - 8, 6);
      notesLines.forEach((line, index) => {
        if (y + 8 + index * 3 < y + sectionHeight - 1 && index < 3) {
          doc.text(line, margin.left + 4, y + 8 + index * 3);
        }
      });
    }

    // Termos
    if (data.budget.terms) {
      const termsX = margin.left + sectionWidth + 6;

      drawRoundedRect(
        termsX,
        y,
        sectionWidth,
        sectionHeight,
        sectionRadius,
        colors.light,
        colors.border
      );

      doc.setFont("helvetica", "bold");
      doc.setFontSize(6);
      doc.setTextColor(...colors.primary);
      doc.text("TERMOS E CONDIÇÕES", termsX + 4, y + 5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6);
      doc.setTextColor(...colors.text);
      const termsLines = breakText(data.budget.terms, sectionWidth - 8, 6);
      termsLines.forEach((line, index) => {
        if (y + 8 + index * 3 < y + sectionHeight - 1 && index < 3) {
          doc.text(line, termsX + 4, y + 8 + index * 3);
        }
      });
    }

    y += 25;
  }

  // RODAPÉ COM BORDAS LIMPAS
  const footerY = pageHeight - margin.bottom - 12;
  const footerRadius = 3;

  // Background com bordas arredondadas LIMPAS
  drawRoundedRect(
    margin.left,
    footerY,
    contentWidth,
    10,
    footerRadius,
    colors.gradient
  );

  // Linha superior
  doc.setDrawColor(...colors.accent);
  doc.setLineWidth(0.5);
  doc.line(margin.left + 2, footerY, pageWidth - margin.right - 2, footerY);

  // Contatos
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.setTextColor(...colors.text);

  let footerText = [];
  if (data.budget.company?.phone)
    footerText.push(` ${data.budget.company.phone}`);
  if (data.budget.company?.email)
    footerText.push(` ${data.budget.company.email}`);
  if (data.budget.company?.website)
    footerText.push(` ${data.budget.company.website}`);

  if (footerText.length > 0) {
    doc.text(footerText.join("  •  "), margin.left + 3, footerY + 6);
  }

  // Data de geração
  doc.setFont("helvetica", "italic");
  doc.setFontSize(5);
  doc.setTextColor(...colors.muted);
  const now = new Date().toLocaleString("pt-BR");
  doc.text(`Gerado em ${now}`, pageWidth - margin.right, footerY + 6, {
    align: "right",
  });

  return doc;
}

module.exports = generateBudgetPremium;
