import { DatabaseSync } from "node:sqlite";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Base de datos oficial de Univer Workspace (la que soporta el repositorio)
const workspaceDbPath = resolve(__dirname, "../../workspace/.data/univer-workspace.sqlite");
const db = new DatabaseSync(workspaceDbPath);

// Initialize schema directly in the repository's SQLite database
db.exec(`
  CREATE TABLE IF NOT EXISTS ventas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente TEXT NOT NULL,
    producto_id INTEGER NOT NULL,
    producto TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario REAL NOT NULL,
    total REAL NOT NULL,
    fecha TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pos_productos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price REAL NOT NULL,
    stock INTEGER NOT NULL,
    emoji TEXT
  );

  CREATE TABLE IF NOT EXISTS pos_clientes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    doc_id TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pos_documentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folio TEXT UNIQUE NOT NULL,
    tipo TEXT NOT NULL, -- 'FACTURA' o 'COTIZACION'
    cliente_id INTEGER,
    cliente_nombre TEXT NOT NULL,
    cliente_doc TEXT,
    cliente_telefono TEXT,
    cliente_email TEXT,
    producto_id INTEGER NOT NULL,
    producto_nombre TEXT NOT NULL,
    cantidad INTEGER NOT NULL,
    precio_unitario REAL NOT NULL,
    subtotal REAL NOT NULL,
    iva REAL NOT NULL,
    total REAL NOT NULL,
    pdf_path TEXT,
    estado_envio_email TEXT DEFAULT 'PENDIENTE',
    fecha TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pos_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Seed default clients if empty
const clientsCount = db.prepare("SELECT COUNT(*) as count FROM pos_clientes").get().count;
if (clientsCount === 0) {
  const insertClient = db.prepare(`
    INSERT INTO pos_clientes (id, name, doc_id, phone, email, address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const now = new Date().toISOString();
  insertClient.run(1, "Consumidor Final (No registrado)", "222222222222", "", "", "Venta Mostrador", now);
  insertClient.run(2, "María Rodríguez", "1018273645", "573105551234", "maria.rodriguez@ejemplo.com", "Calle 100 #15-20", now);
  insertClient.run(3, "Carlos Gómez", "1029384756", "573155556789", "carlos.gomez@ejemplo.com", "Carrera 7 #72-40", now);
  insertClient.run(4, "Tech Solutions SAS", "901234567-1", "573005559876", "compras@techsolutions.com", "Av. El Dorado #68C-61", now);
}

// Seed default products in pos_productos if empty
const prodCount = db.prepare("SELECT COUNT(*) as count FROM pos_productos").get().count;
if (prodCount === 0) {
  const insertProduct = db.prepare(`
    INSERT INTO pos_productos (id, name, category, price, stock, emoji)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const initialProducts = [
    [1, "Laptop Lenovo ThinkPad T14", "Computadoras", 1250.00, 14, "💻"],
    [2, "Monitor Dell UltraSharp 27\" 4K", "Pantallas", 380.00, 22, "🖥️"],
    [3, "Teclado Mecánico Keychron K2", "Accesorios", 85.00, 39, "⌨️"],
    [4, "Mouse Inalámbrico Logitech MX Master 3S", "Accesorios", 99.00, 30, "🖱️"],
    [5, "Auriculares Sony WH-1000XM5", "Audio", 349.00, 18, "🎧"],
    [6, "Webcam Logitech Brio 4K Pro", "Video", 145.00, 22, "📹"]
  ];

  for (const prod of initialProducts) {
    insertProduct.run(...prod);
  }
}

export function getProducts() {
  return db.prepare("SELECT * FROM pos_productos ORDER BY id ASC").all();
}

export function getProductById(id) {
  return db.prepare("SELECT * FROM pos_productos WHERE id = ?").get(id);
}

export function addProduct({ name, category, price, stock, emoji }) {
  const result = db.prepare(`
    INSERT INTO pos_productos (name, category, price, stock, emoji)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, category, Number(price), Number(stock), emoji || "📦");

  return {
    id: Number(result.lastInsertRowid),
    name,
    category,
    price: Number(price),
    stock: Number(stock),
    emoji: emoji || "📦"
  };
}

export function getClients() {
  return db.prepare("SELECT * FROM pos_clientes ORDER BY id ASC").all();
}

export function getClientById(id) {
  return db.prepare("SELECT * FROM pos_clientes WHERE id = ?").get(id);
}

export function addClient({ name, doc_id, phone, email, address }) {
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO pos_clientes (name, doc_id, phone, email, address, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, doc_id || "", phone || "", email || "", address || "", now);

  return {
    id: Number(result.lastInsertRowid),
    name,
    doc_id: doc_id || "",
    phone: phone || "",
    email: email || "",
    address: address || "",
    created_at: now
  };
}

export function getNextFolio(tipo) {
  const prefix = tipo === "COTIZACION" ? "COT" : "FAC";
  const row = db.prepare(`
    SELECT COUNT(*) as count FROM pos_documentos WHERE tipo = ?
  `).get(tipo);
  
  // Si es factura, tener en cuenta las ventas históricas (ya van 30)
  let count = row.count;
  if (tipo === "FACTURA") {
    const vCount = db.prepare("SELECT COUNT(*) as count FROM ventas").get().count;
    count = Math.max(count, vCount);
  }
  const nextNumber = count + 1;
  return `${prefix}-${String(nextNumber).padStart(4, "0")}`;
}

export function recordDocument({
  tipo = "FACTURA",
  clientId,
  clientName,
  clientDoc,
  clientPhone,
  clientEmail,
  productId,
  quantity
}) {
  const product = getProductById(productId);
  if (!product) throw new Error("Producto no encontrado");
  if (tipo === "FACTURA" && product.stock < quantity) {
    throw new Error(`Stock insuficiente. Disponible: ${product.stock}`);
  }

  const folio = getNextFolio(tipo);
  const unitPrice = product.price;
  const total = unitPrice * quantity;
  const subtotal = total / 1.19;
  const iva = total - subtotal;
  const fecha = new Date().toISOString();

  // Si es Factura, descontar stock en SQLite y registrar en tabla 'ventas'
  if (tipo === "FACTURA") {
    db.prepare("UPDATE pos_productos SET stock = stock - ? WHERE id = ?").run(quantity, productId);

    db.prepare(`
      INSERT INTO ventas (cliente, producto_id, producto, cantidad, precio_unitario, total, fecha)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(clientName, productId, product.name, quantity, unitPrice, total, fecha);
  }

  // Guardar documento
  const result = db.prepare(`
    INSERT INTO pos_documentos (
      folio, tipo, cliente_id, cliente_nombre, cliente_doc, cliente_telefono, cliente_email,
      producto_id, producto_nombre, cantidad, precio_unitario, subtotal, iva, total, fecha
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    folio, tipo, clientId || null, clientName, clientDoc || "", clientPhone || "", clientEmail || "",
    productId, product.name, quantity, unitPrice, subtotal, iva, total, fecha
  );

  return {
    id: Number(result.lastInsertRowid),
    folio,
    tipo,
    cliente_id: clientId,
    cliente_nombre: clientName,
    cliente_doc: clientDoc || "",
    cliente_telefono: clientPhone || "",
    cliente_email: clientEmail || "",
    producto_id: productId,
    producto_nombre: product.name,
    cantidad: quantity,
    precio_unitario: unitPrice,
    subtotal,
    iva,
    total,
    fecha
  };
}

export function getDocuments(limit = 50) {
  return db.prepare("SELECT * FROM pos_documentos ORDER BY id DESC LIMIT ?").all(limit);
}

export function getDocumentByFolio(folio) {
  return db.prepare("SELECT * FROM pos_documentos WHERE folio = ?").get(folio);
}

export function updateDocumentPdfPath(folio, pdfPath) {
  db.prepare("UPDATE pos_documentos SET pdf_path = ? WHERE folio = ?").run(pdfPath, folio);
}

export function updateDocumentEmailStatus(folio, status) {
  db.prepare("UPDATE pos_documentos SET estado_envio_email = ? WHERE folio = ?").run(status, folio);
}

export function getSales(limit = 50) {
  const rows = db.prepare("SELECT * FROM ventas ORDER BY id DESC LIMIT ?").all(limit);
  return rows.map((r) => ({
    id: r.id,
    customer_name: r.cliente,
    product_id: r.producto_id,
    product_name: r.producto,
    quantity: r.cantidad,
    unit_price: r.precio_unitario,
    total_price: r.total,
    created_at: r.fecha
  }));
}

export function getConfig(key) {
  const row = db.prepare("SELECT value FROM pos_config WHERE key = ?").get(key);
  return row ? row.value : null;
}

export function setConfig(key, value) {
  db.prepare("INSERT OR REPLACE INTO pos_config (key, value) VALUES (?, ?)").run(key, value);
}

export function getSMTPConfig() {
  const host = getConfig("smtp_host");
  const port = getConfig("smtp_port");
  const user = getConfig("smtp_user");
  const pass = getConfig("smtp_pass");
  const from = getConfig("smtp_from");
  const fromName = getConfig("smtp_from_name");
  const secure = getConfig("smtp_secure");

  if (!host || !user) return null;
  return {
    host,
    port: Number(port) || 587,
    user,
    pass,
    from: from || user,
    fromName: fromName || "ConfiguroWeb Facturación",
    secure: secure === "true" || secure === true
  };
}

export function saveSMTPConfig({ host, port, user, pass, from, fromName, secure }) {
  if (host !== undefined) setConfig("smtp_host", host);
  if (port !== undefined) setConfig("smtp_port", String(port));
  if (user !== undefined) setConfig("smtp_user", user);
  if (pass !== undefined) setConfig("smtp_pass", pass);
  if (from !== undefined) setConfig("smtp_from", from);
  if (fromName !== undefined) setConfig("smtp_from_name", fromName);
  if (secure !== undefined) setConfig("smtp_secure", String(secure));
}

export function getDatabasePath() {
  return workspaceDbPath;
}
