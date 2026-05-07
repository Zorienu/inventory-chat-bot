import ExcelJS from "exceljs";
import { pool } from "./db";

export async function generateSpreadsheet(userId: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  // Sheet 1 — Inventario
  const inventorySheet = workbook.addWorksheet("Inventario");
  inventorySheet.columns = [
    { header: "Producto", key: "name", width: 30 },
    { header: "Precio", key: "price", width: 15 },
    { header: "Stock actual", key: "stock", width: 15 },
    { header: "Alerta mínima", key: "threshold", width: 18 },
  ];
  inventorySheet.getRow(1).font = { bold: true };

  const { rows: inventoryRows } = await pool.query(
    `SELECT p.name, p.price, p.low_stock_threshold,
            COALESCE(SUM(CASE WHEN ih.type = 'ADD' THEN ih.quantity ELSE -ih.quantity END), 0)::int AS stock
     FROM products p
     LEFT JOIN inventory_history ih ON ih.product_id = p.id
     WHERE p.user_id = $1
     GROUP BY p.id, p.name, p.price, p.low_stock_threshold
     ORDER BY p.name`,
    [userId]
  );

  for (const row of inventoryRows) {
    inventorySheet.addRow({
      name: row.name,
      price: parseFloat(row.price),
      stock: row.stock,
      threshold: row.low_stock_threshold ?? "—",
    });
  }

  // Sheet 2 — Historial
  const historySheet = workbook.addWorksheet("Historial");
  historySheet.columns = [
    { header: "Fecha", key: "date", width: 22 },
    { header: "Producto", key: "name", width: 30 },
    { header: "Tipo", key: "type", width: 10 },
    { header: "Cantidad", key: "quantity", width: 12 },
    { header: "Precio unitario", key: "unit_price", width: 18 },
  ];
  historySheet.getRow(1).font = { bold: true };

  const { rows: historyRows } = await pool.query(
    `SELECT ih.created_at, p.name, ih.type, ih.quantity, ih.unit_price
     FROM inventory_history ih
     JOIN products p ON p.id = ih.product_id
     WHERE p.user_id = $1
     ORDER BY ih.created_at DESC`,
    [userId]
  );

  for (const row of historyRows) {
    historySheet.addRow({
      date: new Date(row.created_at).toLocaleString("es-CO"),
      name: row.name,
      type: row.type === "ADD" ? "Entrada" : "Salida",
      quantity: row.quantity,
      unit_price: row.unit_price ? parseFloat(row.unit_price) : "—",
    });
  }

  return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}
