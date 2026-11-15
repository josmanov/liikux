import express from "express";
import cors from "cors";
import { rateLimit } from "./rateLimit.js";
import { registerApiRoutes } from "./routes/api.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: "20kb" }));

const apiLimit = rateLimit({ windowMs: 60_000, max: 120 });
app.use("/api", apiLimit);

registerApiRoutes(app);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API http://localhost:${PORT}`);
  warmUp();
});

/**
 * Fill the in-memory cache right after start, so the first real visitor
 * doesn't have to wait for the database to wake up.
 */
function warmUp() {
  for (const path of ["/api/gyms", "/api/chains", "/api/stats"]) {
    fetch(`http://127.0.0.1:${PORT}${path}`).catch(() => {});
  }
}
