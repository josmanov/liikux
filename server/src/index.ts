import express from "express";
import cors from "cors";

import { db } from "../db/index.js";
import { chains, gyms } from "../db/schema.js"

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
    res.json({ ok: true});
});

app.get("/api/chains", async (_req, res) => {
    const rows = await db.select().from(chains);
    res.json(rows);
})

app.get("/api/gyms", async (_req, res) => {
  const rows = await db.select().from(gyms);
  res.json(rows);
});

app.listen(PORT, () => {
    console.log(`API http://localhost:${PORT}`);
});