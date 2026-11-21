import type { RequestHandler } from "express";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function rateLimit(options: {
  windowMs: number;
  max: number;
}): RequestHandler {
  const { windowMs, max } = options;

  return (req, res, next) => {
    const ip =
      String(req.headers["x-forwarded-for"] ?? "")
        .split(",")[0]
        ?.trim() ||
      req.socket.remoteAddress ||
      "unknown";
    const now = Date.now();
    let bucket = buckets.get(ip);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const retrySec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retrySec));
      res.status(429).json({ error: "too many requests" });
      return;
    }

    next();
  };
}

const failures = new Map<string, Bucket>();

/**
 * For /api/admin: after `max` wrong admin keys (403 answers) from one address
 * within `windowMs`, that address gets 429 until the window ends, even with
 * the right key. Stops anyone from guessing the key.
 */
export function failedKeyLimit(options: { windowMs: number; max: number }): RequestHandler {
  const { windowMs, max } = options;
  return (req, res, next) => {
    const ip =
      String(req.headers["x-forwarded-for"] ?? "")
        .split(",")[0]
        ?.trim() ||
      req.socket.remoteAddress ||
      "unknown";
    const now = Date.now();
    const bucket = failures.get(ip);
    if (bucket && bucket.resetAt > now && bucket.count >= max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: "too many wrong keys, try again later" });
      return;
    }
    res.on("finish", () => {
      if (res.statusCode !== 403) return;
      const t = Date.now();
      let b = failures.get(ip);
      if (!b || b.resetAt <= t) {
        b = { count: 0, resetAt: t + windowMs };
        failures.set(ip, b);
      }
      b.count += 1;
    });
    next();
  };
}
