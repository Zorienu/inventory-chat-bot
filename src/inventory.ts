import { pool } from "./db";

const TYPE = { ADD: "ADD", SELL: "SELL" } as const;

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
    "INSERT INTO inventory_history (product_id, type, quantity) VALUES ($1, $2, $3)",
    [product.id, TYPE.SELL, qty]
  );

  return `Vendiste ${qty} unidades de "${product.name}"`;
}

export async function getReport(userId: string): Promise<string> {
  const { rows } = await pool.query(
    `SELECT p.name,
            COALESCE(SUM(CASE WHEN ih.type = 'ADD' THEN ih.quantity ELSE -ih.quantity END), 0)::int AS stock
     FROM products p
     LEFT JOIN inventory_history ih ON ih.product_id = p.id
     WHERE p.user_id = $1
     GROUP BY p.id, p.name
     ORDER BY p.name`,
    [userId]
  );

  if (rows.length === 0) return "No tienes productos registrados";

  const lines = rows.map((r) => `- ${r.name}: ${r.stock} unidades`).join("\n");
  return `Tienes:\n${lines}`;
}
