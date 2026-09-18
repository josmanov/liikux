import express from "express";
import cors from "cors";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
    res.json({ ok: true});
});

app.listen(PORT, () => {
    console.log(`API http://localhost:${PORT}`);
});