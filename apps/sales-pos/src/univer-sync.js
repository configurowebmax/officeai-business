import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig, setConfig } from "./db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

function runCli(command) {
  try {
    const output = execSync(`univer-workspace-cli ${command}`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      env: process.env
    });
    return JSON.parse(output);
  } catch (err) {
    const errorDetails = err.stdout || err.stderr || err.message;
    throw new Error(`Error en CLI Univer: ${errorDetails}`);
  }
}

let cachedSpaceId = null;

export function getPersonalSpaceId() {
  if (cachedSpaceId) return cachedSpaceId;
  const result = runCli("space list --json");
  const personal = result.spaces.find((s) => s.type === "personal") || result.spaces[0];
  if (!personal) throw new Error("No se encontró espacio personal en Univer Workspace");
  cachedSpaceId = personal.id;
  return cachedSpaceId;
}

export function ensureSalesSheet() {
  const spaceId = getPersonalSpaceId();
  let resourceId = getConfig("univer_sales_resource_id");

  // Check if resource already exists in space
  const browse = runCli(`space browse ${spaceId} --json`);
  const existingNode = browse.nodes.find(
    (n) => n.name === "Registro de Ventas" && n.resource?.unitType === "sheet"
  );

  if (existingNode) {
    resourceId = existingNode.resource.resourceId;
    setConfig("univer_sales_resource_id", resourceId);
    setConfig("univer_sales_node_id", existingNode.nodeId);
    return {
      resourceId,
      nodeId: existingNode.nodeId,
      sheetUrl: `http://127.0.0.1:5173/`
    };
  }

  // Create the Sheet from scratch
  console.log("Creando nueva hoja de cálculo 'Registro de Ventas' en Univer Workspace...");
  const wtResult = runCli(
    `worktree create --name "Setup Registro de Ventas" --scope user --json`
  );
  const worktreeId = wtResult.worktree.id;

  const unitResult = runCli(
    `unit create --worktree ${worktreeId} --space ${spaceId} --type sheet --name "Registro de Ventas" --json`
  );
  const unitId = unitResult.unit.unitId;
  resourceId = unitResult.unit.resourceId;

  // Initial setup script
  const setupScript = `
    const sheet = workbook.getActiveSheet();

    // Set column widths
    sheet.setColumnWidth(0, 90);   // ID
    sheet.setColumnWidth(1, 160);  // Fecha
    sheet.setColumnWidth(2, 160);  // Cliente
    sheet.setColumnWidth(3, 220);  // Producto
    sheet.setColumnWidth(4, 80);   // Cantidad
    sheet.setColumnWidth(5, 120);  // Precio Unit
    sheet.setColumnWidth(6, 130);  // Total

    const headerStyle = {
      bg: { rgb: "#1e293b" },
      cl: { rgb: "#ffffff" },
      bl: 1,
      ht: 2
    };

    const totalStyle = {
      bg: { rgb: "#f8fafc" },
      bl: 1
    };

    const currencyTotalStyle = {
      bg: { rgb: "#f8fafc" },
      bl: 1,
      n: { pattern: "$#,##0.00" }
    };

    // Row 1: Headers
    const headers = [
      { v: "ID Venta", t: 1, s: headerStyle },
      { v: "Fecha / Hora", t: 1, s: headerStyle },
      { v: "Cliente", t: 1, s: headerStyle },
      { v: "Producto", t: 1, s: headerStyle },
      { v: "Cant.", t: 1, s: headerStyle },
      { v: "Precio Unit.", t: 1, s: headerStyle },
      { v: "Total Venta", t: 1, s: headerStyle }
    ];

    sheet.getRange("A1:G1").setValues([headers]);

    // Row 2: Initial Total row
    const totalRow = [
      { v: "TOTAL ACUMULADO", t: 1, s: totalStyle },
      { v: "", t: 1, s: totalStyle },
      { v: "", t: 1, s: totalStyle },
      { v: "", t: 1, s: totalStyle },
      { v: "", t: 1, s: totalStyle },
      { v: "", t: 1, s: totalStyle },
      { f: "=0", s: currencyTotalStyle }
    ];

    sheet.getRange("A2:G2").setValues([totalRow]);
  `;

  const tmpScriptPath = resolve(__dirname, "../tmp_setup_sheet.js");
  writeFileSync(tmpScriptPath, setupScript, "utf8");

  try {
    runCli(
      `execute --worktree ${worktreeId} --unit ${unitId} --script "${tmpScriptPath}" --json`
    );
  } finally {
    try { unlinkSync(tmpScriptPath); } catch (e) {}
  }

  // Mark ready and merge so it is permanently in Personal Space
  runCli(`worktree ready ${worktreeId} --json`);
  runCli(`worktree merge ${worktreeId} --json`);

  setConfig("univer_sales_resource_id", resourceId);
  setConfig("univer_sales_node_id", unitResult.unit.nodeId);

  return {
    resourceId,
    nodeId: unitResult.unit.nodeId,
    sheetUrl: `http://127.0.0.1:5173/`
  };
}

export function ensureSalesBase() {
  const spaceId = getPersonalSpaceId();
  let resourceId = getConfig("univer_sales_base_resource_id");

  // Check if Base already exists in space
  const browse = runCli(`space browse ${spaceId} --json`);
  const existingNode = browse.nodes.find(
    (n) => n.name === "Base de Datos de Ventas" && n.resource?.unitType === "base"
  );

  if (existingNode) {
    resourceId = existingNode.resource.resourceId;
    setConfig("univer_sales_base_resource_id", resourceId);
    setConfig("univer_sales_base_node_id", existingNode.nodeId);
    return {
      resourceId,
      nodeId: existingNode.nodeId,
      baseId: existingNode.resource.unitId
    };
  }

  // Create the Base unit from scratch
  console.log("Creando nueva Base de Datos de Ventas (Univer Base)...");
  const wtResult = runCli(`worktree create --name "Setup Base de Datos Ventas" --scope user --json`);
  const worktreeId = wtResult.worktree.id;

  const unitResult = runCli(
    `unit create --worktree ${worktreeId} --space ${spaceId} --type base --name "Base de Datos de Ventas" --json`
  );
  const unitId = unitResult.unit.unitId;
  resourceId = unitResult.unit.resourceId;

  const setupBaseScript = `
    const fBase = base;
    const table = fBase.getTables()[0];
    table.setName("Ventas");

    const primaryField = table.getPrimaryField();
    primaryField.setName("ID Venta");

    table.addField("Cliente", api.Enum.BaseFieldType.Text);
    table.addField("Producto", api.Enum.BaseFieldType.Text);
    table.addField("Cantidad", api.Enum.BaseFieldType.Number, {
      field: { config: { decimalPlaces: 0 } }
    });
    table.addField("Precio Unitario", api.Enum.BaseFieldType.Currency, {
      field: { config: { currencySymbol: "$", decimalPlaces: 2 } }
    });
    table.addField("Total Venta", api.Enum.BaseFieldType.Currency, {
      field: { config: { currencySymbol: "$", decimalPlaces: 2 } }
    });
    table.addField("Fecha", api.Enum.BaseFieldType.Text);
  `;

  const tmpScriptPath = resolve(__dirname, "../tmp_setup_base.js");
  writeFileSync(tmpScriptPath, setupBaseScript, "utf8");

  try {
    runCli(`execute --worktree ${worktreeId} --unit ${unitId} --script "${tmpScriptPath}" --json`);
  } finally {
    try { unlinkSync(tmpScriptPath); } catch (e) {}
  }

  runCli(`worktree ready ${worktreeId} --json`);
  runCli(`worktree merge ${worktreeId} --json`);

  setConfig("univer_sales_base_resource_id", resourceId);
  setConfig("univer_sales_base_node_id", unitResult.unit.nodeId);

  return {
    resourceId,
    nodeId: unitResult.unit.nodeId,
    baseId: unitId
  };
}

export function appendSaleToUniver(sale) {
  const sheetInfo = ensureSalesSheet();
  const baseInfo = ensureSalesBase();

  // Create temporary worktree for this transaction
  const wtResult = runCli(
    `worktree create --name "Venta #${sale.id} - ${sale.customerName}" --scope user --json`
  );
  const worktreeId = wtResult.worktree.id;

  try {
    // 1. Stage Sheet unit
    const addSheetResult = runCli(
      `unit add --worktree ${worktreeId} --resource ${sheetInfo.resourceId} --json`
    );
    const sheetUnitId = addSheetResult.unit.unitId;

    // 2. Stage Base unit (Airtable / Bitable database)
    const addBaseResult = runCli(
      `unit add --worktree ${worktreeId} --resource ${baseInfo.resourceId} --json`
    );
    const baseUnitId = addBaseResult.unit.unitId;

    // --- SCRIPT 1: Mutación en Univer Sheet (Excel) ---
    const appendSheetScript = `
      const sheet = workbook.getActiveSheet();
      const lastRow = sheet.getLastRow();

      const saleRowIdx = lastRow;
      const newTotalRowIdx = lastRow + 1;

      const currencyFormat = {
        n: { pattern: "$#,##0.00" }
      };

      const dateStr = "${sale.createdAt.slice(0, 19).replace("T", " ")}";
      const excelRowNumber = saleRowIdx + 1;

      const saleRow = [
        { v: "#" + ${sale.id}, t: 1 },
        { v: dateStr, t: 1 },
        { v: "${sale.customerName.replace(/"/g, '\\"')}", t: 1 },
        { v: "${sale.productName.replace(/"/g, '\\"')}", t: 1 },
        { v: ${sale.quantity}, t: 2, s: { ht: 2 } },
        { v: ${sale.unitPrice}, t: 2, s: currencyFormat },
        { f: "=E" + excelRowNumber + "*F" + excelRowNumber, s: { ...currencyFormat, bl: 1 } }
      ];

      sheet.getRange(saleRowIdx, 0, 1, 7).setValues([saleRow]);

      const totalFormula = "=SUM(G2:G" + excelRowNumber + ")";
      const totalRow = [
        { v: "TOTAL ACUMULADO", t: 1, s: { bg: { rgb: "#f1f5f9" }, bl: 1 } },
        { v: "", t: 1, s: { bg: { rgb: "#f1f5f9" } } },
        { v: "", t: 1, s: { bg: { rgb: "#f1f5f9" } } },
        { v: "", t: 1, s: { bg: { rgb: "#f1f5f9" } } },
        { v: "", t: 1, s: { bg: { rgb: "#f1f5f9" } } },
        { v: "", t: 1, s: { bg: { rgb: "#f1f5f9" } } },
        { f: totalFormula, s: { bg: { rgb: "#f1f5f9" }, bl: 1, n: { pattern: "$#,##0.00" } } }
      ];

      sheet.getRange(newTotalRowIdx, 0, 1, 7).setValues([totalRow]);
    `;

    // --- SCRIPT 2: Mutación en Univer Base (Base de datos multidimensional) ---
    const appendBaseScript = `
      const fBase = base;
      const table = fBase.getTables()[0];
      const dateStr = "${sale.createdAt.slice(0, 19).replace("T", " ")}";

      table.addRecord({
        "ID Venta": "#" + ${sale.id},
        "Cliente": "${sale.customerName.replace(/"/g, '\\"')}",
        "Producto": "${sale.productName.replace(/"/g, '\\"')}",
        "Cantidad": ${sale.quantity},
        "Precio Unitario": ${sale.unitPrice},
        "Total Venta": ${sale.totalPrice},
        "Fecha": dateStr
      }, api.Enum.BaseFieldKeyEnum.Name);

      return { baseRecordAdded: true };
    `;

    const tmpSheetPath = resolve(__dirname, `../tmp_sheet_${sale.id}.js`);
    const tmpBasePath = resolve(__dirname, `../tmp_base_${sale.id}.js`);

    writeFileSync(tmpSheetPath, appendSheetScript, "utf8");
    writeFileSync(tmpBasePath, appendBaseScript, "utf8");

    try {
      runCli(`execute --worktree ${worktreeId} --unit ${sheetUnitId} --script "${tmpSheetPath}" --json`);
      runCli(`execute --worktree ${worktreeId} --unit ${baseUnitId} --script "${tmpBasePath}" --json`);
    } finally {
      try { unlinkSync(tmpSheetPath); } catch (e) {}
      try { unlinkSync(tmpBasePath); } catch (e) {}
    }

    // Mark ready and merge atomically both Sheet and Base!
    runCli(`worktree ready ${worktreeId} --json`);
    runCli(`worktree merge ${worktreeId} --json`);

    return {
      synced: true,
      sheetSynced: true,
      baseSynced: true,
      worktreeId
    };
  } catch (err) {
    try { runCli(`worktree discard ${worktreeId} --json`); } catch (e) {}
    throw err;
  }
}

export function appendProductToUniverBase(product) {
  try {
    const baseInfo = ensureSalesBase();
    const wtResult = runCli(`worktree create --name "Agregar Producto ${product.name}" --scope user --json`);
    const worktreeId = wtResult.worktree.id;

    try {
      const addBase = runCli(`unit add --worktree ${worktreeId} --resource ${baseInfo.resourceId} --json`);
      const script = `
        const fBase = base;
        const prodTable = fBase.getTables().find(t => t.getName() === "Productos");
        if (prodTable) {
          prodTable.addRecord({
            "Código": "PROD-" + String(${product.id}).padStart(3, "0"),
            "Nombre": "${product.name.replace(/"/g, '\\"')}",
            "Categoría": "${product.category.replace(/"/g, '\\"')}",
            "Precio": ${product.price},
            "Stock": ${product.stock},
            "Icono": "${product.emoji || '📦'}"
          }, api.Enum.BaseFieldKeyEnum.Name);
        }
        return { success: true };
      `;

      const tmp = resolve(__dirname, "../tmp_add_prod.js");
      writeFileSync(tmp, script, "utf8");
      try {
        runCli(`execute --worktree ${worktreeId} --unit ${addBase.unit.unitId} --script "${tmp}" --json`);
      } finally {
        try { unlinkSync(tmp); } catch (e) {}
      }

      runCli(`worktree ready ${worktreeId} --json`);
      runCli(`worktree merge ${worktreeId} --json`);
      return true;
    } catch (err) {
      try { runCli(`worktree discard ${worktreeId} --json`); } catch (e) {}
      console.warn("Advertencia al sincronizar producto a Univer Base:", err.message);
      return false;
    }
  } catch (err) {
    console.warn("Advertencia general al sincronizar producto:", err.message);
    return false;
  }
}

export function appendDocumentToUniverBase(doc) {
  try {
    const baseInfo = ensureSalesBase();
    const wtResult = runCli(`worktree create --name "Documento ${doc.folio} - ${doc.cliente_nombre}" --scope user --json`);
    const worktreeId = wtResult.worktree.id;

    try {
      const addBase = runCli(`unit add --worktree ${worktreeId} --resource ${baseInfo.resourceId} --json`);
      const script = `
        const fBase = base;
        const docTable = fBase.getTables().find(t => t.getName() === "Documentos");
        if (docTable) {
          docTable.addRecord({
            "Folio": "${doc.folio}",
            "Tipo": "${doc.tipo}",
            "Fecha": "${doc.fecha.slice(0, 19).replace("T", " ")}",
            "Cliente": "${doc.cliente_nombre.replace(/"/g, '\\"')}",
            "Teléfono": "${(doc.cliente_telefono || "N/A").replace(/"/g, '\\"')}",
            "Email": "${(doc.cliente_email || "N/A").replace(/"/g, '\\"')}",
            "Producto": "${doc.producto_nombre.replace(/"/g, '\\"')}",
            "Cantidad": ${doc.cantidad},
            "Precio Unit.": ${doc.precio_unitario},
            "Total": ${doc.total},
            "Estado": "${doc.tipo === "COTIZACION" ? "Propuesta Vigente" : "Facturado"}",
            "PDF": "${doc.pdf_path || ("/invoices/" + doc.folio + ".pdf")}"
          }, api.Enum.BaseFieldKeyEnum.Name);
        }
        return { success: true };
      `;

      const tmp = resolve(__dirname, "../tmp_add_doc.js");
      writeFileSync(tmp, script, "utf8");
      try {
        runCli(`execute --worktree ${worktreeId} --unit ${addBase.unit.unitId} --script "${tmp}" --json`);
      } finally {
        try { unlinkSync(tmp); } catch (e) {}
      }

      runCli(`worktree ready ${worktreeId} --json`);
      runCli(`worktree merge ${worktreeId} --json`);
      return true;
    } catch (err) {
      try { runCli(`worktree discard ${worktreeId} --json`); } catch (e) {}
      console.warn("Advertencia al sincronizar documento a Univer Base:", err.message);
      return false;
    }
  } catch (err) {
    console.warn("Advertencia general al sincronizar documento:", err.message);
    return false;
  }
}
