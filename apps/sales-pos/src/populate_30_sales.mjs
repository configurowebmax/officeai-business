import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));

function runCli(command) {
  const output = execSync(`univer-workspace-cli ${command}`, {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env
  });
  return JSON.parse(output);
}

// 30 registros con nombres latinos comunes y variedad de productos
const demoSales = [
  { id: 1, fecha: "2026-09-15 09:15", cliente: "Juan Pérez", producto: "Laptop Lenovo ThinkPad T14", cant: 1, precio: 1250, total: 1250 },
  { id: 2, fecha: "2026-09-16 10:30", cliente: "María González", producto: "Monitor Dell UltraSharp 27\" 4K", cant: 2, precio: 380, total: 760 },
  { id: 3, fecha: "2026-09-17 11:20", cliente: "Carlos Rodríguez", producto: "Teclado Mecánico Keychron K2", cant: 1, precio: 85, total: 85 },
  { id: 4, fecha: "2026-09-18 14:45", cliente: "Ana Martínez", producto: "Mouse Inalámbrico Logitech MX Master 3S", cant: 2, precio: 99, total: 198 },
  { id: 5, fecha: "2026-09-19 16:10", cliente: "Diego Hernández", producto: "Auriculares Sony WH-1000XM5", cant: 1, precio: 349, total: 349 },
  { id: 6, fecha: "2026-09-20 10:05", cliente: "Valentina Morales", producto: "Webcam Logitech Brio 4K Pro", cant: 1, precio: 145, total: 145 },
  { id: 7, fecha: "2026-09-22 12:40", cliente: "Camilo Torres", producto: "Laptop Lenovo ThinkPad T14", cant: 2, precio: 1250, total: 2500 },
  { id: 8, fecha: "2026-09-23 15:30", cliente: "Sofía López", producto: "Monitor Dell UltraSharp 27\" 4K", cant: 1, precio: 380, total: 380 },
  { id: 9, fecha: "2026-09-24 09:50", cliente: "Mateo Silva", producto: "Teclado Mecánico Keychron K2", cant: 3, precio: 85, total: 255 },
  { id: 10, fecha: "2026-09-25 11:15", cliente: "Lucía Ramírez", producto: "Mouse Inalámbrico Logitech MX Master 3S", cant: 1, precio: 99, total: 99 },
  { id: 11, fecha: "2026-09-27 14:00", cliente: "Javier Castro", producto: "Auriculares Sony WH-1000XM5", cant: 2, precio: 349, total: 698 },
  { id: 12, fecha: "2026-09-28 16:25", cliente: "Gabriela Ortiz", producto: "Webcam Logitech Brio 4K Pro", cant: 2, precio: 145, total: 290 },
  { id: 13, fecha: "2026-09-29 10:45", cliente: "Alejandro Vargas", producto: "Laptop Lenovo ThinkPad T14", cant: 1, precio: 1250, total: 1250 },
  { id: 14, fecha: "2026-09-30 13:10", cliente: "Mariana Rojas", producto: "Monitor Dell UltraSharp 27\" 4K", cant: 2, precio: 380, total: 760 },
  { id: 15, fecha: "2026-10-01 15:55", cliente: "Sebastián Mendoza", producto: "Teclado Mecánico Keychron K2", cant: 2, precio: 85, total: 170 },
  { id: 16, fecha: "2026-10-02 09:30", cliente: "Daniela Herrera", producto: "Mouse Inalámbrico Logitech MX Master 3S", cant: 3, precio: 99, total: 297 },
  { id: 17, fecha: "2026-10-03 11:40", cliente: "Nicolás Castillo", producto: "Auriculares Sony WH-1000XM5", cant: 1, precio: 349, total: 349 },
  { id: 18, fecha: "2026-10-04 14:15", cliente: "Isabella Cruz", producto: "Webcam Logitech Brio 4K Pro", cant: 1, precio: 145, total: 145 },
  { id: 19, fecha: "2026-10-05 16:50", cliente: "Felipe Romero", producto: "Laptop Lenovo ThinkPad T14", cant: 1, precio: 1250, total: 1250 },
  { id: 20, fecha: "2026-10-06 10:20", cliente: "Catalina Flores", producto: "Monitor Dell UltraSharp 27\" 4K", cant: 1, precio: 380, total: 380 },
  { id: 21, fecha: "2026-10-07 12:35", cliente: "Esteban Navarro", producto: "Teclado Mecánico Keychron K2", cant: 1, precio: 85, total: 85 },
  { id: 22, fecha: "2026-10-08 15:05", cliente: "Paula Delgado", producto: "Mouse Inalámbrico Logitech MX Master 3S", cant: 2, precio: 99, total: 198 },
  { id: 23, fecha: "2026-10-09 09:40", cliente: "Rodrigo Reyes", producto: "Auriculares Sony WH-1000XM5", cant: 1, precio: 349, total: 349 },
  { id: 24, fecha: "2026-10-09 11:50", cliente: "Natalia Peña", producto: "Webcam Logitech Brio 4K Pro", cant: 3, precio: 145, total: 435 },
  { id: 25, fecha: "2026-10-10 14:25", cliente: "Andrés Medina", producto: "Laptop Lenovo ThinkPad T14", cant: 1, precio: 1250, total: 1250 },
  { id: 26, fecha: "2026-10-10 16:30", cliente: "Camila Aguilar", producto: "Monitor Dell UltraSharp 27\" 4K", cant: 2, precio: 380, total: 760 },
  { id: 27, fecha: "2026-10-11 09:10", cliente: "Julián Paredes", producto: "Teclado Mecánico Keychron K2", cant: 2, precio: 85, total: 170 },
  { id: 28, fecha: "2026-10-11 10:45", cliente: "Valeria Fuentes", producto: "Mouse Inalámbrico Logitech MX Master 3S", cant: 1, precio: 99, total: 99 },
  { id: 29, fecha: "2026-10-11 11:20", cliente: "Lucas Cárdenas", producto: "Auriculares Sony WH-1000XM5", cant: 2, precio: 349, total: 698 },
  { id: 30, fecha: "2026-10-11 12:00", cliente: "Carolina Guerrero", producto: "Webcam Logitech Brio 4K Pro", cant: 1, precio: 145, total: 145 }
];

console.log("1. Actualizando bases de datos SQLite locales...");
const workspaceDbPath = resolve("apps/workspace/.data/univer-workspace.sqlite");
const wsDb = new DatabaseSync(workspaceDbPath);
wsDb.exec("DELETE FROM ventas;");
const insertVenta = wsDb.prepare(`
  INSERT INTO ventas (id, cliente, producto_id, producto, cantidad, precio_unitario, total, fecha)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);
for (const s of demoSales) {
  insertVenta.run(s.id, s.cliente, 1, s.producto, s.cant, s.precio, s.total, s.fecha);
}
console.log("✅ 30 ventas insertadas en tabla 'ventas' de univer-workspace.sqlite");

// También actualizar sales.sqlite
try {
  const salesDb = new DatabaseSync(resolve("apps/sales-pos/data/sales.sqlite"));
  salesDb.exec("DELETE FROM sales;");
  const insertSale = salesDb.prepare(`
    INSERT INTO sales (id, customer_name, product_id, product_name, quantity, unit_price, total_price, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const s of demoSales) {
    insertSale.run(s.id, s.cliente, 1, s.producto, s.cant, s.precio, s.total, s.fecha);
  }
} catch (e) {}

console.log("2. Creando Worktree en Univer Workspace para sincronizar Sheet y Base...");
const sheetResourceId = "08c5f57e-72c5-41e4-93cb-13612070a771";
const baseResourceId = "e34ea0f3-44b5-4fb3-adc3-7ec989072334";

const wtResult = runCli(`worktree create --name "Poblado 30 Ventas Demo" --scope user --json`);
const worktreeId = wtResult.worktree.id;

try {
  console.log("Staging Sheet unit...");
  const addSheet = runCli(`unit add --worktree ${worktreeId} --resource ${sheetResourceId} --json`);
  const sheetUnitId = addSheet.unit.unitId;

  console.log("Staging Base unit...");
  const addBase = runCli(`unit add --worktree ${worktreeId} --resource ${baseResourceId} --json`);
  const baseUnitId = addBase.unit.unitId;

  // --- SCRIPT PARA EL SHEET (EXCEL) ---
  const sheetScript = `
    const sheet = workbook.getActiveSheet();
    sheet.getRange("A1:G100").clearContent();

    sheet.setColumnWidth(0, 90);
    sheet.setColumnWidth(1, 160);
    sheet.setColumnWidth(2, 170);
    sheet.setColumnWidth(3, 240);
    sheet.setColumnWidth(4, 80);
    sheet.setColumnWidth(5, 120);
    sheet.setColumnWidth(6, 130);

    const headerStyle = {
      bg: { rgb: "#1e293b" },
      cl: { rgb: "#ffffff" },
      bl: 1,
      ht: 2
    };

    const currencyFormat = {
      n: { pattern: "$#,##0.00" }
    };

    const headers = [
      { v: "ID Venta", t: 1, s: headerStyle },
      { v: "Fecha / Hora", t: 1, s: headerStyle },
      { v: "Cliente", t: 1, s: headerStyle },
      { v: "Producto", t: 1, s: headerStyle },
      { v: "Cant.", t: 1, s: headerStyle },
      { v: "Precio Unit.", t: 1, s: headerStyle },
      { v: "Total Venta", t: 1, s: headerStyle }
    ];

    const salesData = ${JSON.stringify(demoSales)};

    const grid = [headers];

    for (let i = 0; i < salesData.length; i++) {
      const s = salesData[i];
      const rowNum = i + 2; // 1-based index (Header is row 1)
      grid.push([
        { v: "#" + s.id, t: 1 },
        { v: s.fecha, t: 1 },
        { v: s.cliente, t: 1 },
        { v: s.producto, t: 1 },
        { v: s.cant, t: 2, s: { ht: 2 } },
        { v: s.precio, t: 2, s: currencyFormat },
        { f: "=E" + rowNum + "*F" + rowNum, s: { ...currencyFormat, bl: 1 } }
      ]);
    }

    // Fila 32: Total Acumulado con =SUM(G2:G31)
    const totalRow = [
      { v: "TOTAL ACUMULADO", t: 1, s: { bg: { rgb: "#f1f5f9" }, bl: 1 } },
      { v: "", t: 1, s: { bg: { rgb: "#f1f5f9" } } },
      { v: "", t: 1, s: { bg: { rgb: "#f1f5f9" } } },
      { v: "", t: 1, s: { bg: { rgb: "#f1f5f9" } } },
      { v: "", t: 1, s: { bg: { rgb: "#f1f5f9" } } },
      { v: "", t: 1, s: { bg: { rgb: "#f1f5f9" } } },
      { f: "=SUM(G2:G31)", s: { bg: { rgb: "#f1f5f9" }, bl: 1, n: { pattern: "$#,##0.00" } } }
    ];
    grid.push(totalRow);

    sheet.getRange(0, 0, grid.length, 7).setValues(grid);

    return { rowsWritten: grid.length };
  `;

  // --- SCRIPT PARA EL BASE (BASE DE DATOS) ---
  const baseScript = `
    const fBase = base;
    const table = fBase.getTables()[0];

    // Limpiar registros existentes
    const oldRecords = table.getRecords();
    if (oldRecords.length > 0) {
      table.deleteRecords(oldRecords.map(r => r.getId()));
    }

    const salesData = ${JSON.stringify(demoSales)};

    table.addRecords(salesData.map(s => ({
      values: {
        "ID Venta": "#" + s.id,
        "Cliente": s.cliente,
        "Producto": s.producto,
        "Cantidad": s.cant,
        "Precio Unitario": s.precio,
        "Total Venta": s.total,
        "Fecha": s.fecha
      },
      fieldKey: api.Enum.BaseFieldKeyEnum.Name
    })));

    return { baseRecordsCount: table.getRecords().length };
  `;

  const tmpSheet = resolve(__dirname, "tmp_populate_sheet.js");
  const tmpBase = resolve(__dirname, "tmp_populate_base.js");

  writeFileSync(tmpSheet, sheetScript, "utf8");
  writeFileSync(tmpBase, baseScript, "utf8");

  try {
    console.log("Ejecutando mutación en Univer Sheet...");
    const sheetExec = runCli(`execute --worktree ${worktreeId} --unit ${sheetUnitId} --script "${tmpSheet}" --json`);
    console.log("Sheet Exec:", sheetExec.value);

    console.log("Ejecutando mutación en Univer Base...");
    const baseExec = runCli(`execute --worktree ${worktreeId} --unit ${baseUnitId} --script "${tmpBase}" --json`);
    console.log("Base Exec:", baseExec.value);
  } finally {
    try { unlinkSync(tmpSheet); } catch (e) {}
    try { unlinkSync(tmpBase); } catch (e) {}
  }

  console.log("Marcando worktree ready y realizando Merge atómico...");
  runCli(`worktree ready ${worktreeId} --json`);
  const mergeRes = runCli(`worktree merge ${worktreeId} --json`);
  console.log("✅ Worktree merge finalizado:", mergeRes.worktree.state);

} catch (err) {
  console.error("Error durante la sincronización:", err);
  try { runCli(`worktree discard ${worktreeId} --json`); } catch (e) {}
}
