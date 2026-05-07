import { pool } from "./db";

const TYPE = { ADD: "ADD", SELL: "SELL" } as const;
type Period = "hoy" | "semana" | "mes";

async function getProduct(userId: string, name: string) {
  const { rows } = await pool.query(
    "SELECT * FROM products WHERE user_id = $1 AND LOWER(name) = LOWER($2)",
    [userId, name]
  );
  return rows[0] ?? null;
}

async function getStock(productId: string): Promise<number> {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(CASE WHEN type = 'ADD' THEN quantity ELSE -quantity END), 0)::int AS stock
     FROM inventory_history WHERE product_id = $1`,
    [productId]
  );
  return rows[0].stock;
}

export async function createProduct(userId: string, name: string, price: number): Promise<string> {
  const existing = await getProduct(userId, name);
  if (existing) return `El producto "${name}" ya existe`;

  const { rows } = await pool.query(
    "INSERT INTO products (user_id, name, price) VALUES ($1, $2, $3) RETURNING id",
    [userId, name, price]
  );

  await pool.query(
    "INSERT INTO price_history (product_id, price) VALUES ($1, $2)",
    [rows[0].id, price]
  );

  return `Creaste producto "${name}" con un precio de $${price}`;
}

export async function updatePrice(userId: string, name: string, price: number): Promise<string> {
  const product = await getProduct(userId, name);
  if (!product) return `El producto "${name}" no existe`;

  await pool.query("UPDATE products SET price = $1 WHERE id = $2", [price, product.id]);
  await pool.query("INSERT INTO price_history (product_id, price) VALUES ($1, $2)", [product.id, price]);

  return `Actualizaste el precio de "${product.name}" a $${price}`;
}

export async function setThreshold(userId: string, name: string, threshold: number): Promise<string> {
  const product = await getProduct(userId, name);
  if (!product) return `El producto "${name}" no existe`;

  await pool.query("UPDATE products SET low_stock_threshold = $1 WHERE id = $2", [threshold, product.id]);

  return `Alerta configurada para "${product.name}": te avisaré cuando queden menos de ${threshold} unidades`;
}

export async function addStock(userId: string, name: string, qty: number): Promise<string> {
  const product = await getProduct(userId, name);
  if (!product) return `El producto "${name}" no existe`;

  await pool.query(
    "INSERT INTO inventory_history (product_id, type, quantity) VALUES ($1, $2, $3)",
    [product.id, TYPE.ADD, qty]
  );

  return `Agregaste ${qty} unidades de "${product.name}"`;
}

export async function sellStock(userId: string, name: string, qty: number): Promise<string> {
  const product = await getProduct(userId, name);
  if (!product) return `El producto "${name}" no existe`;

  const stock = await getStock(product.id);
  if (stock < qty) return `Stock insuficiente de "${product.name}". Stock actual: ${stock}`;

  await pool.query(
    "INSERT INTO inventory_history (product_id, type, quantity, unit_price) VALUES ($1, $2, $3, $4)",
    [product.id, TYPE.SELL, qty, product.price]
  );

  const newStock = stock - qty;
  let reply = `Vendiste ${qty} unidades de "${product.name}"`;

  if (product.low_stock_threshold !== null && newStock <= product.low_stock_threshold) {
    reply += `\n\n⚠️ Stock bajo de "${product.name}": ${newStock} unidades restantes`;
  }

  return reply;
}

export async function deleteProduct(userId: string, name: string): Promise<string> {
  const product = await getProduct(userId, name);
  if (!product) return `El producto "${name}" no existe`;

  await pool.query("DELETE FROM products WHERE id = $1", [product.id]);

  return `Eliminaste el producto "${product.name}"`;
}

export async function renameProduct(userId: string, oldName: string, newName: string): Promise<string> {
  const product = await getProduct(userId, oldName);
  if (!product) return `El producto "${oldName}" no existe`;

  const conflict = await getProduct(userId, newName);
  if (conflict) return `Ya existe un producto con el nombre "${newName}"`;

  await pool.query("UPDATE products SET name = $1 WHERE id = $2", [newName, product.id]);

  return `Renombraste "${oldName}" a "${newName}"`;
}

export async function getTopSales(userId: string): Promise<string> {
  const { rows } = await pool.query(
    `SELECT p.name,
            SUM(ih.quantity)::int AS units,
            SUM(ih.quantity * ih.unit_price) AS revenue
     FROM inventory_history ih
     JOIN products p ON p.id = ih.product_id
     WHERE p.user_id = $1
       AND ih.type = 'SELL'
       AND ih.unit_price IS NOT NULL
     GROUP BY p.name
     ORDER BY units DESC
     LIMIT 5`,
    [userId]
  );

  if (rows.length === 0) return "No hay ventas registradas";

  const lines = rows.map((r, i) => `${i + 1}. ${r.name}: ${r.units} unidades — $${r.revenue}`).join("\n");
  return `Top 5 productos más vendidos:\n${lines}`;
}

export async function getLowStock(userId: string): Promise<string> {
  const { rows } = await pool.query(
    `SELECT p.name, p.low_stock_threshold,
            COALESCE(SUM(CASE WHEN ih.type = 'ADD' THEN ih.quantity ELSE -ih.quantity END), 0)::int AS stock
     FROM products p
     LEFT JOIN inventory_history ih ON ih.product_id = p.id
     WHERE p.user_id = $1
     GROUP BY p.id, p.name, p.low_stock_threshold
     HAVING COALESCE(SUM(CASE WHEN ih.type = 'ADD' THEN ih.quantity ELSE -ih.quantity END), 0) = 0
        OR (p.low_stock_threshold IS NOT NULL
            AND COALESCE(SUM(CASE WHEN ih.type = 'ADD' THEN ih.quantity ELSE -ih.quantity END), 0) <= p.low_stock_threshold)
     ORDER BY stock ASC`,
    [userId]
  );

  if (rows.length === 0) return "Todos los productos tienen stock suficiente";

  const lines = rows.map((r) => {
    const alert = r.stock === 0 ? "⛔ Sin stock" : `⚠️ Bajo (mín. ${r.low_stock_threshold})`;
    return `- ${r.name}: ${r.stock} unidades ${alert}`;
  }).join("\n");

  return `Productos con stock crítico:\n${lines}`;
}

export async function getReport(userId: string): Promise<string> {
  const { rows } = await pool.query(
    `SELECT p.name, p.price,
            COALESCE(SUM(CASE WHEN ih.type = 'ADD' THEN ih.quantity ELSE -ih.quantity END), 0)::int AS stock
     FROM products p
     LEFT JOIN inventory_history ih ON ih.product_id = p.id
     WHERE p.user_id = $1
     GROUP BY p.id, p.name, p.price
     ORDER BY p.name`,
    [userId]
  );

  if (rows.length === 0) return "No tienes productos registrados";

  const lines = rows.map((r) => `- ${r.name}: ${r.stock} uds. | $${r.price}`).join("\n");
  return `Inventario:\n${lines}`;
}

export async function getSalesReport(userId: string, period: Period): Promise<string> {
  const intervals: Record<Period, string> = {
    hoy: "1 day",
    semana: "7 days",
    mes: "30 days",
  };

  const labels: Record<Period, string> = {
    hoy: "hoy",
    semana: "esta semana",
    mes: "este mes",
  };

  const { rows } = await pool.query(
    `SELECT p.name,
            SUM(ih.quantity)::int AS units,
            SUM(ih.quantity * ih.unit_price) AS revenue
     FROM inventory_history ih
     JOIN products p ON p.id = ih.product_id
     WHERE p.user_id = $1
       AND ih.type = 'SELL'
       AND ih.unit_price IS NOT NULL
       AND ih.created_at >= NOW() - INTERVAL '${intervals[period]}'
     GROUP BY p.name
     ORDER BY revenue DESC`,
    [userId]
  );

  if (rows.length === 0) return `No hubo ventas ${labels[period]}`;

  const lines = rows.map((r) => `- ${r.name}: ${r.units} unidades — $${r.revenue}`).join("\n");
  const total = rows.reduce((sum: number, r: any) => sum + parseFloat(r.revenue), 0);
  return `Ventas de ${labels[period]}:\n${lines}\nTotal: $${total}`;
}
