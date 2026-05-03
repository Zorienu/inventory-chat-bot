import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { whatsapp } from "./whatsapp";
import { createProduct, addStock, sellStock, getReport } from "./inventory";

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
  if (!message || message.type !== "text") {
    return res.sendStatus(200);
  }

  const from: string = message.from;
  const text: string = message.text.body.trim();

  const reply = parseCommand(text);
  console.log(`[${from}] ${text} → ${reply}`);

  await whatsapp.sendTextMessage(from, reply);
  res.sendStatus(200);
});

function parseCommand(text: string): string {
  let match: RegExpMatchArray | null;

  match = text.match(/^Crear producto (.+?) \$(\d+(?:[.,]\d+)?)$/i);
  if (match) {
    const name = match[1].trim();
    const price = parseFloat(match[2].replace(",", "."));
    return createProduct(name, price);
  }

  match = text.match(/^Agregar (\d+) de (.+)$/i);
  if (match) {
    const qty = parseInt(match[1], 10);
    const name = match[2].trim();
    return addStock(name, qty);
  }

  match = text.match(/^Vend[ií] (\d+) de (.+)$/i);
  if (match) {
    const qty = parseInt(match[1], 10);
    const name = match[2].trim();
    return sellStock(name, qty);
  }

  if (/^Reporte$/i.test(text)) {
    return getReport();
  }

  return "Comando no reconocido. Ejemplos:\n- Crear producto Nombre $1000\n- Agregar 10 de Nombre\n- Vendí 5 de Nombre\n- Reporte";
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
