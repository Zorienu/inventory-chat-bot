import dotenv from "dotenv";
import express from "express";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const MY_VERIFY_TOKEN = process.env.MY_VERIFY_TOKEN;

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "inventory bot is running" });
});

app.post("/webhook", (req, res) => {
  const body = req.body;
  console.log("Received message:", JSON.stringify(body, null, 2));
  res.sendStatus(200);
});

app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === MY_VERIFY_TOKEN) {
    console.log('Webhook verificado con éxito');
    return res.status(200).send(challenge);
  } else {
    return res.sendStatus(403);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
