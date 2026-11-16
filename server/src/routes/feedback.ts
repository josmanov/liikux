import { randomUUID } from "node:crypto";
import type express from "express";
import { desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { feedback } from "../../db/schema.js";
import { rateLimit } from "../rateLimit.js";

/**
 * POST /api/feedback        — anyone can send (max 5 per minute per visitor)
 * GET  /api/admin/feedback  — read messages (needs ADMIN_KEY)
 */
const TYPES = new Set(["suggest", "error", "feedback", "business"]);

function clean(v: unknown, max: number) {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s ? s.slice(0, max) : null;
}

export function registerFeedbackRoutes(
  app: express.Application,
  adminAllowed: (req: express.Request) => boolean,
) {
  const limit = rateLimit({ windowMs: 60_000, max: 5 });

  app.post("/api/feedback", limit, async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;

    // Honeypot: a hidden field real people never fill in. Bots do.
    if (clean(body.website, 10)) {
      res.json({ ok: true });
      return;
    }

    const type = clean(body.type, 16) ?? "feedback";
    const message = clean(body.message, 4000);
    const gymName = clean(body.gymName, 200);
    if (!TYPES.has(type) || (!message && !gymName)) {
      res.status(400).json({ ok: false, error: "message required" });
      return;
    }

    const email = clean(body.email, 200);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ ok: false, error: "bad email" });
      return;
    }

    try {
      await db.insert(feedback).values({
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        type,
        gymSlug: clean(body.gymSlug, 128),
        gymName,
        place: clean(body.place, 200),
        url: clean(body.url, 500),
        message: message ?? "",
        email,
        lang: body.lang === "en" ? "en" : "fi",
      });
      res.json({ ok: true });
    } catch (err) {
      console.error("feedback insert failed", err);
      res.status(500).json({ ok: false });
    }
  });

  app.get("/api/admin/feedback", async (req, res) => {
    if (!adminAllowed(req)) {
      res.status(403).json({ error: "forbidden" });
      return;
    }
    const rows = await db.select().from(feedback).orderBy(desc(feedback.createdAt)).limit(200);
    res.json(rows);
  });
}
