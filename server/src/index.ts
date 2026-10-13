import express from "express";
import cors from "cors";
import { rateLimit } from "./rateLimit.js";
import { registerApiRoutes } from "./routes/api.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json());

const apiLimit = rateLimit({ windowMs: 60_000, max: 120 });
app.use("/api", apiLimit);

registerApiRoutes(app);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API http://localhost:${PORT}`);
});
