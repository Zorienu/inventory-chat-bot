import dotenv from "dotenv";
import express from "express";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ status: "ok", message: "inventory bot is running" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
