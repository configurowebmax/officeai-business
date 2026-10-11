import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getProducts,
  addProduct,
  getClients,
  addClient,
  recordDocument,
  getDocuments,
  getDocumentByFolio,
  updateDocumentPdfPath,
  updateDocumentEmailStatus,
  getSales,
  getSMTPConfig,
  saveSMTPConfig
} from "./db.js";
import {
  appendSaleToUniver,
  appendProductToUniverBase,
  appendDocumentToUniverBase,
  ensureSalesSheet
} from "./univer-sync.js";
import { generateDocumentPdf } from "./pdf-generator.js";
import { testSMTPConnection, sendDocumentEmail } from "./email-service.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "../public");
const invoicesDir = path.resolve(__dirname, "../invoices");

if (!fs.existsSync(invoicesDir)) {
  fs.mkdirSync(invoicesDir, { recursive: true });
}

const PORT = 4050;

// Ensure Univer Sheet exists on startup
try {
  ensureSalesSheet();
  console.log("✅ Hoja 'Registro de Ventas' verificada en Univer Workspace");
} catch (e) {
  console.warn("⚠️ Advertencia al verificar hoja en Univer:", e.message);
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(new Error("JSON inválido en el cuerpo de la petición"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // 1. Invoices Static Serving (/invoices/:file)
  if (url.pathname.startsWith("/invoices/")) {
    const filename = path.basename(url.pathname);
    const pdfFilePath = path.join(invoicesDir, filename);
    if (fs.existsSync(pdfFilePath)) {
      res.writeHead(200, {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`
      });
      fs.createReadStream(pdfFilePath).pipe(res);
      return;
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Archivo PDF no encontrado");
      return;
    }
  }

  // 2. API: Products
  if (url.pathname === "/api/products" && req.method === "GET") {
    sendJson(res, 200, getProducts());
    return;
  }

  if (url.pathname === "/api/products" && req.method === "POST") {
    try {
      const data = await parseJsonBody(req);
      if (!data.name || !data.category || data.price === undefined || data.stock === undefined) {
        sendJson(res, 400, { error: "Campos requeridos: name, category, price, stock" });
        return;
      }
      const newProduct = addProduct(data);
      // Sync into Univer Base in background
      setTimeout(() => {
        try {
          appendProductToUniverBase(newProduct);
        } catch (e) {
          console.warn("Error en sync de nuevo producto con Univer:", e.message);
        }
      }, 50);

      sendJson(res, 201, { success: true, product: newProduct });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // 3. API: Clients
  if (url.pathname === "/api/clients" && req.method === "GET") {
    sendJson(res, 200, getClients());
    return;
  }

  if (url.pathname === "/api/clients" && req.method === "POST") {
    try {
      const data = await parseJsonBody(req);
      if (!data.name) {
        sendJson(res, 400, { error: "El nombre del cliente es requerido" });
        return;
      }
      const newClient = addClient(data);
      sendJson(res, 201, { success: true, client: newClient });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // 4. API: Documents (Facturas & Cotizaciones)
  if (url.pathname === "/api/documents" && req.method === "GET") {
    sendJson(res, 200, getDocuments());
    return;
  }

  if (url.pathname === "/api/documents" && req.method === "POST") {
    try {
      const data = await parseJsonBody(req);
      const {
        tipo = "FACTURA",
        clientId,
        clientName = "Consumidor Final (No registrado)",
        clientDoc,
        clientPhone,
        clientEmail,
        productId,
        quantity = 1,
        sendEmail = false
      } = data;

      if (!productId) {
        sendJson(res, 400, { error: "Debe seleccionar un producto" });
        return;
      }

      // A. Registrar en base de datos
      const doc = recordDocument({
        tipo,
        clientId,
        clientName,
        clientDoc,
        clientPhone,
        clientEmail,
        productId: Number(productId),
        quantity: Number(quantity)
      });

      // B. Generar PDF Oficial
      const pdfFileName = `${doc.folio}.pdf`;
      const pdfFullPath = path.join(invoicesDir, pdfFileName);
      await generateDocumentPdf(doc, pdfFullPath);
      updateDocumentPdfPath(doc.folio, `/invoices/${pdfFileName}`);

      // C. Sincronizar en Univer Base (Tabla Documentos: tanto Facturas como Cotizaciones)
      setTimeout(() => {
        try {
          appendDocumentToUniverBase(doc);
        } catch (e) {
          console.warn("Error sincronizando documento a Univer Base:", e.message);
        }
      }, 50);

      // Si es Factura, también sincronizar en Univer Sheet (Libro contable) y tabla 'Ventas'
      let univerStatus = { synced: false };
      if (tipo === "FACTURA") {
        try {
          univerStatus = appendSaleToUniver({
            id: doc.id,
            customerName: doc.cliente_nombre,
            productId: doc.producto_id,
            productName: doc.producto_nombre,
            quantity: doc.cantidad,
            unitPrice: doc.precio_unitario,
            totalPrice: doc.total,
            createdAt: doc.fecha
          });
        } catch (syncErr) {
          console.warn("Error sincronizando venta con Univer Workspace:", syncErr.message);
          univerStatus.error = syncErr.message;
        }
      }

      // D. Enviar Correo si se solicitó o hay email
      let emailResult = { sent: false };
      if (sendEmail && doc.cliente_email) {
        const smtp = getSMTPConfig();
        if (smtp) {
          try {
            await sendDocumentEmail(smtp, {
              to: doc.cliente_email,
              clientName: doc.cliente_nombre,
              folio: doc.folio,
              tipo: doc.tipo,
              total: doc.total,
              pdfPath: pdfFullPath
            });
            updateDocumentEmailStatus(doc.folio, "ENVIADO");
            emailResult = { sent: true };
          } catch (mErr) {
            console.error("Error enviando email SMTP:", mErr);
            updateDocumentEmailStatus(doc.folio, "FALLO: " + mErr.message);
            emailResult = { sent: false, error: mErr.message };
          }
        } else {
          emailResult = { sent: false, error: "SMTP no configurado" };
        }
      }

      // E. Preparar Enlace de WhatsApp
      const pdfPublicUrl = `http://127.0.0.1:${PORT}/invoices/${pdfFileName}`;
      const docLabel = tipo === "COTIZACION" ? "Cotización Comercial" : "Factura de Venta";
      const waMsg = `👋 Hola *${doc.cliente_nombre}*,\nAdjuntamos el resumen de su *${docLabel} #${doc.folio}*:\n\n📦 *Producto:* ${doc.producto_nombre}\n🔢 *Cantidad:* ${doc.cantidad}\n💰 *Total:* $${doc.total.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n\n📄 *Descargar PDF Oficial:* ${pdfPublicUrl}\n\n¡Gracias por preferir a *ConfiguroWeb & Univer Suite*!`;

      const cleanPhone = (doc.cliente_telefono || "").replace(/\D/g, "");
      const whatsappUrl = cleanPhone
        ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(waMsg)}`
        : `https://wa.me/?text=${encodeURIComponent(waMsg)}`;

      sendJson(res, 201, {
        success: true,
        document: {
          ...doc,
          pdf_url: `/invoices/${pdfFileName}`
        },
        pdfUrl: pdfPublicUrl,
        whatsappUrl,
        univer: univerStatus,
        emailResult
      });
    } catch (e) {
      console.error("Error procesando documento:", e);
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // 5. API: Legacy Sales
  if (url.pathname === "/api/sales" && req.method === "GET") {
    sendJson(res, 200, getSales());
    return;
  }

  // 6. API: SMTP Config & Test
  if (url.pathname === "/api/smtp" && req.method === "GET") {
    const smtp = getSMTPConfig();
    sendJson(res, 200, smtp ? {
      host: smtp.host,
      port: smtp.port,
      user: smtp.user,
      from: smtp.from,
      fromName: smtp.fromName,
      secure: smtp.secure,
      hasPass: Boolean(smtp.pass)
    } : null);
    return;
  }

  if (url.pathname === "/api/smtp" && req.method === "POST") {
    try {
      const data = await parseJsonBody(req);
      saveSMTPConfig(data);
      sendJson(res, 200, { success: true, message: "Configuración SMTP guardada exitosamente" });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  if (url.pathname === "/api/smtp/test" && req.method === "POST") {
    try {
      const data = await parseJsonBody(req);
      const configToTest = data.host ? data : getSMTPConfig();
      if (!configToTest) {
        sendJson(res, 400, { error: "No se proporcionó configuración para probar" });
        return;
      }
      const testRes = await testSMTPConnection(configToTest);
      sendJson(res, 200, testRes);
    } catch (e) {
      sendJson(res, 400, { error: e.message });
    }
    return;
  }

  // 7. API: Enviar Email de documento existente
  if (url.pathname === "/api/documents/send-email" && req.method === "POST") {
    try {
      const { folio, email } = await parseJsonBody(req);
      const doc = getDocumentByFolio(folio);
      if (!doc) {
        sendJson(res, 404, { error: "Documento no encontrado" });
        return;
      }
      const targetEmail = email || doc.cliente_email;
      if (!targetEmail) {
        sendJson(res, 400, { error: "No se proporcionó un correo de destino" });
        return;
      }

      const smtp = getSMTPConfig();
      if (!smtp) {
        sendJson(res, 400, { error: "Servidor SMTP no configurado. Ve a Configuración SMTP primero." });
        return;
      }

      const pdfFullPath = path.join(invoicesDir, `${doc.folio}.pdf`);
      if (!fs.existsSync(pdfFullPath)) {
        await generateDocumentPdf(doc, pdfFullPath);
      }

      await sendDocumentEmail(smtp, {
        to: targetEmail,
        clientName: doc.cliente_nombre,
        folio: doc.folio,
        tipo: doc.tipo,
        total: doc.total,
        pdfPath: pdfFullPath
      });

      updateDocumentEmailStatus(doc.folio, "ENVIADO");
      sendJson(res, 200, { success: true, message: `Correo enviado exitosamente a ${targetEmail}` });
    } catch (e) {
      sendJson(res, 500, { error: e.message });
    }
    return;
  }

  // Static File Serving
  let filePath = path.join(publicDir, url.pathname === "/" ? "index.html" : url.pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(publicDir, "index.html");
  }

  const ext = path.extname(filePath);
  const mimeTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css",
    ".js": "text/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".pdf": "application/pdf"
  };

  res.writeHead(200, { "Content-Type": mimeTypes[ext] || "text/plain" });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`🚀 Sistema POS de Ventas y Facturación corriendo en: http://127.0.0.1:${PORT}`);
});
