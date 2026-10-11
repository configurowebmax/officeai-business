import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";

export async function generateDocumentPdf(doc, outputPath) {
  return new Promise((resolve, reject) => {
    // Ensure parent dir exists
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const docPdf = new PDFDocument({
      size: "A4",
      margin: 40,
      info: {
        Title: `${doc.tipo}: ${doc.folio}`,
        Author: "ConfiguroWeb & Univer Suite"
      }
    });

    const stream = fs.createWriteStream(outputPath);
    docPdf.pipe(stream);

    // Primary Colors
    const primaryColor = doc.tipo === "COTIZACION" ? "#4f46e5" : "#0284c7"; // Purple for quote, Blue for invoice
    const darkText = "#0f172a";
    const lightText = "#64748b";

    // Header Background Bar
    docPdf
      .rect(40, 40, 515, 65)
      .fill(primaryColor);

    // Header Title
    docPdf
      .fillColor("#ffffff")
      .fontSize(22)
      .font("Helvetica-Bold")
      .text(doc.tipo === "COTIZACION" ? "COTIZACIÓN COMERCIAL" : "FACTURA DE VENTA", 55, 52);

    docPdf
      .fontSize(11)
      .font("Helvetica")
      .text("CONFIGUROWEB & UNIVER WORKSPACE SUITE", 55, 80);

    // Folio & Date (Right aligned in header)
    docPdf
      .fillColor("#ffffff")
      .fontSize(14)
      .font("Helvetica-Bold")
      .text(`N° ${doc.folio}`, 380, 52, { align: "right", width: 160 });

    docPdf
      .fontSize(10)
      .font("Helvetica")
      .text(`Fecha: ${doc.fecha.slice(0, 10)}`, 380, 76, { align: "right", width: 160 });

    // Company & Customer Information Sections
    const startY = 125;

    // Emisor (Left Box)
    docPdf
      .rect(40, startY, 250, 95)
      .strokeColor("#e2e8f0")
      .lineWidth(1)
      .stroke();

    docPdf
      .fillColor(primaryColor)
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("EMISOR", 50, startY + 10);

    docPdf
      .fillColor(darkText)
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("ConfiguroWeb Tech Solutions", 50, startY + 25)
      .font("Helvetica")
      .fontSize(9)
      .fillColor(lightText)
      .text("NIT / Identificación: 900.852.147-9", 50, startY + 39)
      .text("Email: contacto@configuroweb.com", 50, startY + 52)
      .text("Teléfono: +57 300 123 4567", 50, startY + 65)
      .text("Plataforma: Univer Workspace Self-Hosted", 50, startY + 78);

    // Cliente (Right Box)
    docPdf
      .rect(305, startY, 250, 95)
      .strokeColor("#e2e8f0")
      .lineWidth(1)
      .stroke();

    docPdf
      .fillColor(primaryColor)
      .fontSize(10)
      .font("Helvetica-Bold")
      .text("CLIENTE / RECEPTOR", 315, startY + 10);

    docPdf
      .fillColor(darkText)
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(doc.cliente_nombre || "Consumidor Final", 315, startY + 25)
      .font("Helvetica")
      .fontSize(9)
      .fillColor(lightText)
      .text(`Documento: ${doc.cliente_doc || "No registrado"}`, 315, startY + 39)
      .text(`Teléfono / WhatsApp: ${doc.cliente_telefono || "No registrado"}`, 315, startY + 52)
      .text(`Correo: ${doc.cliente_email || "No registrado"}`, 315, startY + 65)
      .text(`Estado: ${doc.tipo === "COTIZACION" ? "Propuesta Vigente" : "Pagado"}`, 315, startY + 78);

    // Table Header
    const tableTop = 240;
    docPdf
      .rect(40, tableTop, 515, 24)
      .fill("#f1f5f9");

    docPdf
      .fillColor(darkText)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("CANT.", 50, tableTop + 7)
      .text("DESCRIPCIÓN DEL PRODUCTO", 100, tableTop + 7)
      .text("PRECIO UNIT.", 360, tableTop + 7, { align: "right", width: 85 })
      .text("TOTAL", 460, tableTop + 7, { align: "right", width: 85 });

    // Table Row
    const rowY = tableTop + 32;
    docPdf
      .rect(40, rowY - 5, 515, 30)
      .strokeColor("#e2e8f0")
      .stroke();

    docPdf
      .fillColor(darkText)
      .fontSize(10)
      .font("Helvetica-Bold")
      .text(String(doc.cantidad), 50, rowY + 3)
      .font("Helvetica")
      .text(doc.producto_nombre, 100, rowY + 3)
      .text(`$${doc.precio_unitario.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, 360, rowY + 3, { align: "right", width: 85 })
      .font("Helvetica-Bold")
      .text(`$${doc.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, 460, rowY + 3, { align: "right", width: 85 });

    // Financial Totals Box (Right bottom)
    const totalsY = 320;
    docPdf
      .rect(320, totalsY, 235, 90)
      .fill("#f8fafc")
      .strokeColor("#cbd5e1")
      .stroke();

    const subtotal = doc.total / 1.19;
    const iva = doc.total - subtotal;

    docPdf
      .fillColor(lightText)
      .fontSize(9)
      .font("Helvetica")
      .text("Subtotal:", 335, totalsY + 12)
      .text(`$${subtotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 430, totalsY + 12, { align: "right", width: 110 })
      .text("IVA (19% incluido):", 335, totalsY + 30)
      .text(`$${iva.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 430, totalsY + 30, { align: "right", width: 110 });

    docPdf
      .strokeColor("#cbd5e1")
      .moveTo(335, totalsY + 48)
      .lineTo(540, totalsY + 48)
      .stroke();

    docPdf
      .fillColor(primaryColor)
      .fontSize(12)
      .font("Helvetica-Bold")
      .text("TOTAL:", 335, totalsY + 58)
      .text(`$${doc.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}`, 430, totalsY + 58, { align: "right", width: 110 });

    // Notes & Footer
    docPdf
      .fillColor(darkText)
      .fontSize(9)
      .font("Helvetica-Bold")
      .text("Términos & Sincronización Univer:", 40, 430)
      .font("Helvetica")
      .fillColor(lightText)
      .text(
        doc.tipo === "COTIZACION"
          ? "• Esta cotización tiene una validez comercial de 15 días calendario a partir de su emisión.\n• Los precios están sujetos a disponibilidad de inventario.\n• Sincronizada automáticamente en la suite de base de datos de Univer Workspace."
          : "• Documento oficial de soporte contable.\n• Registrado en la base de datos relacional de Univer Base (Trunk) y en la hoja de cálculo de Univer Sheets.\n• Generado automáticamente mediante Node.js y Univer Workspace CLI.",
        40,
        445,
        { width: 515, lineGap: 3 }
      );

    // Decorative bottom bar
    docPdf
      .rect(40, 750, 515, 4)
      .fill(primaryColor);

    docPdf
      .fillColor(lightText)
      .fontSize(8)
      .font("Helvetica")
      .text("Generado por ConfiguroWeb POS • Potenciado por Univer Workspace Suite • Documento Verificado", 40, 760, {
        align: "center",
        width: 515
      });

    docPdf.end();

    stream.on("finish", () => resolve(outputPath));
    stream.on("error", (err) => reject(err));
  });
}
