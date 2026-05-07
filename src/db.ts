import { Pool } from "pg";

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

export async function initDB() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id     TEXT NOT NULL,
      name        TEXT NOT NULL,
      price       NUMERIC NOT NULL,
      created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, name)
    );

    CREATE TABLE IF NOT EXISTS inventory_history (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      type        TEXT NOT NULL,
      quantity    INTEGER NOT NULL,
      created_at  TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id  UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      price       NUMERIC NOT NULL,
      created_at  TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER;
    ALTER TABLE inventory_history ADD COLUMN IF NOT EXISTS unit_price NUMERIC;
  `);
}
