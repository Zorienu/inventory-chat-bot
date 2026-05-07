import { parse } from "csv-parse/sync";
import { pool } from "./db";

interface CSVRow {
  nombre: string;
  precio: string;
  stock: string;
  alerta_minima?: string;
}

interface ImportResult {
  imported: string[];
  skipped: string[];
  errors: string[];
}

export async function importFromCSV(userId: string, buffer: Buffer): Promise<string> {
  let rows: CSVRow[];

  try {
    rows = parse(buffer, { columns: true, skip_empty_lines: true, trim: true });
  } catch {
    return "El archivo no pudo ser procesado. Asegurate de que sea un CSV válido.";
  }

  if (!rows.length) return "El archivo está vacío.";

  const first = rows[0];
  if (!("nombre" in first) || !("precio" in first) || !("stock" in first)) {
    return "El CSV debe tener las columnas: nombre, precio, stock (y opcionalmente alerta_minima).";
  }

  const result: ImportResult = { imported: [], skipped: [], errors: [] };

  for (const row of rows) {
    const name = row.nombre?.trim();
    const price = parseFloat(row.precio);
    const stock = parseInt(row.stock, 10);
    const threshold = row.alerta_minima ? parseInt(row.alerta_minima, 10) : null;

    if (!name) { result.errors.push(`Fila sin nombre`); continue; }
    if (isNaN(price) || price < 0) { result.errors.push(`"${name}": precio inválido`); continue; }
    if (isNaN(stock) || stock < 0) { result.errors.push(`"${name}": stock inválido`); continue; }

    const { rows: existing } = await pool.query(
      "SELECT id FROM products WHERE user_id = $1 AND LOWER(name) = LOWER($2)",
      [userId, name]
    );

    if (existing.length > 0) {
      result.skipped.push(name);
      continue;
    }

    const { rows: inserted } = await pool.query(
      "INSERT INTO products (user_id, name, price, low_stock_threshold) VALUES ($1, $2, $3, $4) RETURNING id",
      [userId, name, price, threshold]
    );

    const productId = inserted[0].id;

    await pool.query(
      "INSERT INTO price_history (product_id, price) VALUES ($1, $2)",
      [productId, price]
    );

    if (stock > 0) {
      await pool.query(
        "INSERT INTO inventory_history (product_id, type, quantity) VALUES ($1, 'ADD', $2)",
        [productId, stock]
      );
    }

    result.imported.push(name);
  }

  return formatResult(result);
}

function formatResult({ imported, skipped, errors }: ImportResult): string {
  const lines: string[] = [];

  if (imported.length) {
    lines.push(`✅ Importados (${imported.length}):\n${imported.map((n) => `- ${n}`).join("\n")}`);
  }
  if (skipped.length) {
    lines.push(`⚠️ Ya existían, omitidos (${skipped.length}):\n${skipped.map((n) => `- ${n}`).join("\n")}`);
  }
  if (errors.length) {
    lines.push(`❌ Errores (${errors.length}):\n${errors.map((e) => `- ${e}`).join("\n")}`);
  }

  return lines.join("\n\n");
}
