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

export const allProducts = [
  // 6 iniciales
  { id: 1, name: "Laptop Lenovo ThinkPad T14", category: "Computadoras", price: 1250.00, stock: 14, emoji: "💻" },
  { id: 2, name: "Monitor Dell UltraSharp 27\" 4K", category: "Pantallas", price: 380.00, stock: 22, emoji: "🖥️" },
  { id: 3, name: "Teclado Mecánico Keychron K2", category: "Accesorios", price: 85.00, stock: 39, emoji: "⌨️" },
  { id: 4, name: "Mouse Inalámbrico Logitech MX Master 3S", category: "Accesorios", price: 99.00, stock: 30, emoji: "🖱️" },
  { id: 5, name: "Auriculares Sony WH-1000XM5", category: "Audio", price: 349.00, stock: 18, emoji: "🎧" },
  { id: 6, name: "Webcam Logitech Brio 4K Pro", category: "Video", price: 145.00, stock: 22, emoji: "📹" },
  // 20 productos nuevos
  { id: 7, name: "MacBook Air 15\" M3", category: "Computadoras", price: 1499.00, stock: 12, emoji: "💻" },
  { id: 8, name: "iPad Pro 11\" Chip M4", category: "Tablets", price: 999.00, stock: 15, emoji: "📱" },
  { id: 9, name: "Monitor Curvo Samsung Odyssey 34\"", category: "Pantallas", price: 650.00, stock: 10, emoji: "🖥️" },
  { id: 10, name: "Teclado Ergonómico Logitech Wave Keys", category: "Accesorios", price: 75.00, stock: 35, emoji: "⌨️" },
  { id: 11, name: "Mouse Gamer Razer DeathAdder V3", category: "Accesorios", price: 59.00, stock: 40, emoji: "🖱️" },
  { id: 12, name: "Micrófono Shure MV7 USB/XLR", category: "Audio", price: 249.00, stock: 20, emoji: "🎙️" },
  { id: 13, name: "Altavoces Audioengine A2+ Wireless", category: "Audio", price: 269.00, stock: 16, emoji: "🔊" },
  { id: 14, name: "Impresora Epson EcoTank L3250", category: "Impresión", price: 280.00, stock: 14, emoji: "🖨️" },
  { id: 15, name: "SSD Externo Samsung T7 Shield 2TB", category: "Almacenamiento", price: 179.00, stock: 45, emoji: "💾" },
  { id: 16, name: "Hub USB-C Anker 8 en 1 PowerExpand", category: "Accesorios", price: 65.00, stock: 50, emoji: "🔌" },
  { id: 17, name: "Soporte de Aluminio para Laptop", category: "Soportes", price: 39.00, stock: 60, emoji: "📐" },
  { id: 18, name: "Silla Ergonómica Herman Miller Aeron", category: "Mobiliario", price: 1295.00, stock: 8, emoji: "🪑" },
  { id: 19, name: "Escritorio Elevable StandDesk 140x70", category: "Mobiliario", price: 450.00, stock: 12, emoji: "🪵" },
  { id: 20, name: "Lámpara BenQ ScreenBar Halo", category: "Iluminación", price: 109.00, stock: 28, emoji: "💡" },
  { id: 21, name: "Tableta Gráfica Wacom Intuos Pro M", category: "Diseño", price: 379.00, stock: 15, emoji: "🎨" },
  { id: 22, name: "Sistema Mesh TP-Link Deco X50 Wi-Fi 6", category: "Redes", price: 189.00, stock: 25, emoji: "📡" },
  { id: 23, name: "Router Gamer ASUS ROG Rapture GT6", category: "Redes", price: 329.00, stock: 18, emoji: "🌐" },
  { id: 24, name: "Cargador Inalámbrico Belkin MagSafe 3en1", category: "Accesorios", price: 119.00, stock: 35, emoji: "🔋" },
  { id: 25, name: "Mochila Antirrobo Targus CityLite 16\"", category: "Accesorios", price: 79.00, stock: 40, emoji: "🎒" },
  { id: 26, name: "UPS Regulador APC Back-UPS Pro 1500VA", category: "Energía", price: 219.00, stock: 22, emoji: "⚡" }
];

console.log("1. Actualizando catálogo de 26 productos en base de datos SQLite...");
const wsDbPath = resolve("apps/workspace/.data/univer-workspace.sqlite");
const wsDb = new DatabaseSync(wsDbPath);
wsDb.exec("DELETE FROM pos_productos;");
const insertProd = wsDb.prepare(`
  INSERT INTO pos_productos (id, name, category, price, stock, emoji)
  VALUES (?, ?, ?, ?, ?, ?)
`);
for (const p of allProducts) {
  insertProd.run(p.id, p.name, p.category, p.price, p.stock, p.emoji);
}
console.log("✅ 26 productos insertados en 'pos_productos' de univer-workspace.sqlite");

try {
  const salesDb = new DatabaseSync(resolve("apps/sales-pos/data/sales.sqlite"));
  salesDb.exec("DELETE FROM products;");
  const insertSalesProd = salesDb.prepare(`
    INSERT INTO products (id, name, category, price, stock, emoji)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const p of allProducts) {
    insertSalesProd.run(p.id, p.name, p.category, p.price, p.stock, p.emoji);
  }
} catch (e) {}

console.log("2. Insertando tabla 'Productos' en Univer Base (Base de Datos de Ventas)...");
const baseResourceId = "e34ea0f3-44b5-4fb3-adc3-7ec989072334";

const wtResult = runCli(`worktree create --name "Agregar Tabla Productos en Base" --scope user --json`);
const worktreeId = wtResult.worktree.id;

try {
  const addBase = runCli(`unit add --worktree ${worktreeId} --resource ${baseResourceId} --json`);
  const baseUnitId = addBase.unit.unitId;

  const script = `
    const fBase = base;
    const existingTables = fBase.getTables();
    let prodTable = existingTables.find(t => t.getName() === "Productos");

    if (!prodTable) {
      prodTable = fBase.insertTable("Productos", { primaryFieldName: "Código" });
      prodTable.addField("Nombre", api.Enum.BaseFieldType.Text);
      prodTable.addField("Categoría", api.Enum.BaseFieldType.Text);
      prodTable.addField("Precio", api.Enum.BaseFieldType.Currency, {
        field: { config: { currencySymbol: "$", decimalPlaces: 2 } }
      });
      prodTable.addField("Stock", api.Enum.BaseFieldType.Number, {
        field: { config: { decimalPlaces: 0 } }
      });
      prodTable.addField("Icono", api.Enum.BaseFieldType.Text);
    } else {
      // Limpiar registros previos si ya existía
      const oldRecords = prodTable.getRecords();
      if (oldRecords.length > 0) {
        prodTable.deleteRecords(oldRecords.map(r => r.getId()));
      }
    }

    const productsData = ${JSON.stringify(allProducts)};

    for (const p of productsData) {
      prodTable.addRecord({
        "Código": "PROD-" + String(p.id).padStart(3, "0"),
        "Nombre": p.name,
        "Categoría": p.category,
        "Precio": p.price,
        "Stock": p.stock,
        "Icono": p.emoji
      }, api.Enum.BaseFieldKeyEnum.Name);
    }

    return {
      tableCreated: prodTable.getName(),
      recordsCount: prodTable.getRecords().length,
      allTables: fBase.getTables().map(t => t.getName())
    };
  `;

  const tmpScript = resolve(__dirname, "tmp_catalog_script.js");
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
  console.error("Error al actualizar catálogo en Univer Base:", err);
  try { runCli(`worktree discard ${worktreeId} --json`); } catch (e) {}
}
