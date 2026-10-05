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
