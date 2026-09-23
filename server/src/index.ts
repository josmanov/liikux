import express from "express";
import cors from "cors";
import { eq } from "drizzle-orm";

import { db } from "../db/index.js";
import { chains, gyms } from "../db/schema.js";

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/chains", async (_req, res) => {
  const rows = await db.select().from(chains);
  res.json(rows);
});

app.get("/api/gyms", async (_req, res) => {
  const rows = await db.select().from(gyms);
  res.json(rows);
});

app.get("/api/gyms/:slug", async (req, res) => {
  const slug = String(req.params.slug ?? "").trim();
  if (!slug) {
    res.status(400).json({ error: "slug required" });
    return;
  }

  const rows = await db.select().from(gyms).where(eq(gyms.slug, slug)).limit(1);
  const gym = rows[0];
  if (!gym) {
    res.status(404).json({ error: "not found" });
    return;
  }

  const chainRows = await db
    .select()
    .from(chains)
    .where(eq(chains.id, gym.chainId))
    .limit(1);

  res.json({
    ...gym,
    chain: chainRows[0] ?? null,
  });
});

app.get("/api/geocode", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  if (q.length < 2) {
    res.json([]);
    return;
  }

  try {
    const url =
      "https://nominatim.openstreetmap.org/search?" +
      new URLSearchParams({
        format: "json",
        q,
        countrycodes: "fi",
        limit: "6",
        addressdetails: "1",
      });

    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Liikux/1.0 (localhost dev)",
        "Accept-Language": "fi",
      },
    });

    if (!upstream.ok) {
      res.status(502).json([]);
      return;
    }

    const rows = (await upstream.json()) as Array<{
      place_id: number;
      lat: string;
      lon: string;
      display_name: string;
      address?: Record<string, string>;
    }>;

    const results = rows.map((row) => {
      const a = row.address ?? {};
      const road = a.road || a.pedestrian || a.street || "";
      const num = a.house_number || "";
      const city = a.city || a.town || a.municipality || a.village || "";
      let label = "";
      if (road && num && city) label = `${road} ${num}, ${city}`;
      else if (road && city) label = `${road}, ${city}`;
      else if (city && !road) label = city;
      else
        label = row.display_name
          .split(",")
          .slice(0, 3)
          .map((p) => p.trim())
          .join(", ");

      return {
        id: String(row.place_id),
        label,
        lat: Number(row.lat),
        lng: Number(row.lon),
      };
    });

    res.json(results);
  } catch {
    res.status(502).json([]);
  }
});

app.listen(PORT, () => {
  console.log(`API http://localhost:${PORT}`);
});
