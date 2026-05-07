import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { initDB } from "./db";
import { whatsapp } from "./whatsapp";
import {
  createProduct,
  deleteProduct,
  renameProduct,
  updatePrice,
  setThreshold,
  addStock,
  sellStock,
  getReport,
  getSalesReport,
  getTopSales,
  getLowStock,
} from "./inventory";
import { generateSpreadsheet } from "./spreadsheet";
import { importFromCSV } from "./csv-import";

const app = express();
const PORT = process.env.PORT || 3000;
const MY_VERIFY_TOKEN = process.env.MY_VERIFY_TOKEN;

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "inventory bot is running" });
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === MY_VERIFY_TOKEN) {
    console.log("Webhook verificado con éxito");
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  const body = req.body;

  const message = body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return res.sendStatus(200);

  const from: string = message.from;

  if (message.type === "document") {
    const { id: mediaId, filename = "" } = message.document;
    if (!filename.endsWith(".csv")) {
      await whatsapp.sendTextMessage(from, "Solo acepto archivos .csv para importar productos.");
      return res.sendStatus(200);
    }
    try {
      const buffer = await whatsapp.downloadMedia(mediaId);
      const reply = await importFromCSV(from, buffer);
      await whatsapp.sendTextMessage(from, reply);
    } catch (err) {
      console.error("Error importando CSV:", err);
      await whatsapp.sendTextMessage(from, "Ocurrió un error procesando el archivo.");
    }
    return res.sendStatus(200);
  }

  if (message.type !== "text") return res.sendStatus(200);

  const text: string = message.text.body.trim();

  if (/^Descargar inventario$/i.test(text)) {
    try {
      const buffer = await generateSpreadsheet(from);
      const filename = `inventario_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const mediaId = await whatsapp.uploadMedia(buffer, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      await whatsapp.sendDocument(from, mediaId, filename, "Tu inventario actualizado");
    } catch (err) {
      console.error("Error generando spreadsheet:", err);
      await whatsapp.sendTextMessage(from, "Ocurrió un error generando el archivo. Intenta de nuevo.");
    }
    return res.sendStatus(200);
  }

  const reply = await parseCommand(from, text);
  console.log(`[${from}] ${text} → ${reply}`);

  await whatsapp.sendTextMessage(from, reply);
  res.sendStatus(200);
});

const HELP_MESSAGE = [
  "Comandos disponibles:",
  "- Crear producto [nombre] $[precio]",
  "- Eliminar producto [nombre]",
  "- Renombrar [nombre] a [nuevo nombre]",
  "- Actualizar precio [nombre] $[precio]",
  "- Alerta [nombre] [cantidad mínima]",
  "- Agregar [cantidad] de [nombre]",
  "- Vendí [cantidad] de [nombre]",
  "- Reporte",
  "- Sin stock",
  "- Top ventas",
  "- Ventas hoy / esta semana / este mes",
  "- Descargar inventario",
  "- Ayuda",
].join("\n");

async function parseCommand(userId: string, text: string): Promise<string> {
  let match: RegExpMatchArray | null;

  match = text.match(/^Crear producto (.+?) \$(\d+(?:[.,]\d+)?)$/i);
  if (match) {
    return createProduct(userId, match[1].trim(), parseFloat(match[2].replace(",", ".")));
  }

  match = text.match(/^Eliminar producto (.+)$/i);
  if (match) {
    return deleteProduct(userId, match[1].trim());
  }

  match = text.match(/^Renombrar (.+) a (.+)$/i);
  if (match) {
    return renameProduct(userId, match[1].trim(), match[2].trim());
  }

  match = text.match(/^Actualizar precio (.+?) \$(\d+(?:[.,]\d+)?)$/i);
  if (match) {
    return updatePrice(userId, match[1].trim(), parseFloat(match[2].replace(",", ".")));
  }

  match = text.match(/^Alerta (.+?) (\d+)$/i);
  if (match) {
    return setThreshold(userId, match[1].trim(), parseInt(match[2], 10));
  }

  match = text.match(/^Agregar (\d+) de (.+)$/i);
  if (match) {
    return addStock(userId, match[2].trim(), parseInt(match[1], 10));
  }

  match = text.match(/^Vend[ií] (\d+) de (.+)$/i);
  if (match) {
    return sellStock(userId, match[2].trim(), parseInt(match[1], 10));
  }

  match = text.match(/^Ventas (hoy|esta semana|este mes)$/i);
  if (match) {
    const periodMap: Record<string, "hoy" | "semana" | "mes"> = {
      hoy: "hoy",
      "esta semana": "semana",
      "este mes": "mes",
    };
    return getSalesReport(userId, periodMap[match[1].toLowerCase()]);
  }

  if (/^Reporte$/i.test(text)) {
    return getReport(userId);
  }

  if (/^Sin stock$/i.test(text)) {
    return getLowStock(userId);
  }

  if (/^Top ventas$/i.test(text)) {
    return getTopSales(userId);
  }

  if (/^Ayuda$/i.test(text)) {
    return HELP_MESSAGE;
  }

  return `Comando no reconocido.\n\n${HELP_MESSAGE}`;
}

initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
