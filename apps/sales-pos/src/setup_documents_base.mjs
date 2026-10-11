import { DatabaseSync } from "node:sqlite";
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { generateDocumentPdf } from "./pdf-generator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const invoicesDir = resolve(__dirname, "../invoices");
if (!existsSync(invoicesDir)) {
  mkdirSync(invoicesDir, { recursive: true });
}

function runCli(cmd) {
  const output = execSync(`univer-workspace-cli ${cmd}`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env
  });
  return JSON.parse(output);
}

const dbPath = resolve(__dirname, "../../workspace/.data/univer-workspace.sqlite");
const db = new DatabaseSync(dbPath);

console.log("1. Migrando las 30 ventas históricas a pos_documentos como Facturas...");
const ventas = db.prepare("SELECT * FROM ventas ORDER BY id ASC").all();

const checkDoc = db.prepare("SELECT COUNT(*) as count FROM pos_documentos WHERE folio = ?");
const insertDoc = db.prepare(`
  INSERT INTO pos_documentos (
    folio, tipo, cliente_id, cliente_nombre, cliente_doc, cliente_telefono, cliente_email,
    producto_id, producto_nombre, cantidad, precio_unitario, subtotal, iva, total, pdf_path, fecha
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const v of ventas) {
  const folio = `FAC-${String(v.id).padStart(4, "0")}`;
  const exists = checkDoc.get(folio).count > 0;
  if (!exists) {
    const total = v.total;
    const subtotal = total / 1.19;
    const iva = total - subtotal;
    const pdfPath = `/invoices/${folio}.pdf`;

    insertDoc.run(
      folio,
      "FACTURA",
      null,
      v.cliente,
      "222222222222",
      "",
      "",
      v.producto_id,
      v.producto,
      v.cantidad,
      v.precio_unitario,
      subtotal,
      iva,
      total,
      pdfPath,
      v.fecha
    );

    // Generar PDF
    const fullPdf = resolve(invoicesDir, `${folio}.pdf`);
    if (!existsSync(fullPdf)) {
      await generateDocumentPdf({
        folio,
        tipo: "FACTURA",
        fecha: v.fecha,
        cliente_nombre: v.cliente,
        cliente_doc: "222222222222",
        cliente_telefono: "No registrado",
        cliente_email: "No registrado",
        producto_nombre: v.producto,
        cantidad: v.cantidad,
        precio_unitario: v.precio_unitario,
        total: v.total
      }, fullPdf);
    }
  }
}

const allDocs = db.prepare("SELECT * FROM pos_documentos ORDER BY id ASC").all();
console.log(`✅ Total de documentos en SQLite: ${allDocs.length}`);

console.log("2. Creando tabla 'Documentos' en Univer Base (Base de Datos de Ventas)...");
const baseResourceId = "e34ea0f3-44b5-4fb3-adc3-7ec989072334";

const wtResult = runCli(`worktree create --name "Agregar Tabla Documentos en Base" --scope user --json`);
const worktreeId = wtResult.worktree.id;

try {
  const addBase = runCli(`unit add --worktree ${worktreeId} --resource ${baseResourceId} --json`);
  const baseUnitId = addBase.unit.unitId;

  const script = `
    const fBase = base;
    const existingTables = fBase.getTables();
    let docTable = existingTables.find(t => t.getName() === "Documentos");

    if (!docTable) {
      docTable = fBase.insertTable("Documentos", { primaryFieldName: "Folio" });
      docTable.addField("Tipo", api.Enum.BaseFieldType.Text);
      docTable.addField("Fecha", api.Enum.BaseFieldType.Text);
      docTable.addField("Cliente", api.Enum.BaseFieldType.Text);
      docTable.addField("Teléfono", api.Enum.BaseFieldType.Text);
      docTable.addField("Email", api.Enum.BaseFieldType.Text);
      docTable.addField("Producto", api.Enum.BaseFieldType.Text);
      docTable.addField("Cantidad", api.Enum.BaseFieldType.Number, {
        field: { config: { decimalPlaces: 0 } }
      });
      docTable.addField("Precio Unit.", api.Enum.BaseFieldType.Currency, {
        field: { config: { currencySymbol: "$", decimalPlaces: 2 } }
      });
      docTable.addField("Total", api.Enum.BaseFieldType.Currency, {
        field: { config: { currencySymbol: "$", decimalPlaces: 2 } }
      });
      docTable.addField("Estado", api.Enum.BaseFieldType.Text);
      docTable.addField("PDF", api.Enum.BaseFieldType.Text);
    } else {
      const oldRecords = docTable.getRecords();
      if (oldRecords.length > 0) {
        docTable.deleteRecords(oldRecords.map(r => r.getId()));
      }
    }

    const docsData = ${JSON.stringify(allDocs)};

    for (const d of docsData) {
      docTable.addRecord({
        "Folio": d.folio,
        "Tipo": d.tipo,
        "Fecha": d.fecha.slice(0, 19).replace("T", " "),
        "Cliente": d.cliente_nombre,
        "Teléfono": d.cliente_telefono || "N/A",
        "Email": d.cliente_email || "N/A",
        "Producto": d.producto_nombre,
        "Cantidad": d.cantidad,
        "Precio Unit.": d.precio_unitario,
        "Total": d.total,
        "Estado": d.tipo === "COTIZACION" ? "Propuesta Vigente" : "Facturado",
        "PDF": d.pdf_path || ("/invoices/" + d.folio + ".pdf")
      }, api.Enum.BaseFieldKeyEnum.Name);
    }

    return {
      tableCreated: docTable.getName(),
      recordsCount: docTable.getRecords().length,
      allTables: fBase.getTables().map(t => t.getName())
    };
  `;

  const tmpScript = resolve(__dirname, "tmp_docs_script.js");
  writeFileSync(tmpScript, script, "utf8");

  try {
    const execRes = runCli(`execute --worktree ${worktreeId} --unit ${baseUnitId} --script "${tmpScript}" --json`);
    console.log("Execute result:", execRes.value);
  } finally {
    try { unlinkSync(tmpScript); } catch (e) {}
  }

  runCli(`worktree ready ${worktreeId} --json`);
  const mergeRes = runCli(`worktree merge ${worktreeId} --json`);
  console.log("✅ Worktree merge finalizado:", mergeRes.worktree.state);
} catch (err) {
  console.error("Error al sincronizar documentos en Univer Base:", err);
  try { runCli(`worktree discard ${worktreeId} --json`); } catch (e) {}
}
