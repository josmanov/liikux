import "dotenv/config";
import { eq, isNotNull, and, ne, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { gyms } from "../db/schema.js";

const CONCURRENCY = 12;
const TIMEOUT_MS = 10000;
const USER_AGENT = "LiikuxLinkCheck/1.0 (+https://liikux.local)";

type Verdict = "ok" | "dead";

type Result = {
  id: string;
  name: string;
  www: string;
  verdict: Verdict;
  reason: string;
};

function isDeadStatus(status: number) {
  return status === 404 || status === 410 || status === 523 || status === 524;
}

async function checkUrl(url: string): Promise<{ verdict: Verdict; reason: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": USER_AGENT,
      },
    });
    clearTimeout(timer);
    if (isDeadStatus(res.status)) {
      return { verdict: "dead", reason: `HTTP_${res.status}` };
    }
    return { verdict: "ok", reason: `HTTP_${res.status}` };
  } catch (err) {
    clearTimeout(timer);
    const e = err as {
      name?: string;
      cause?: { code?: string | number };
      code?: string | number;
      message?: string;
    };
    if (e.name === "AbortError") {
      return { verdict: "dead", reason: "TIMEOUT" };
    }
    const code = String(e.cause?.code || e.code || e.name || "FETCH_ERROR");
    if (
      code === "UND_ERR_CONNECT_TIMEOUT" ||
      code === "ETIMEDOUT"
    ) {
      return { verdict: "dead", reason: "TIMEOUT" };
    }
    if (
      code === "ENOTFOUND" ||
      code === "EAI_AGAIN" ||
      code === "ECONNREFUSED" ||
      code === "ECONNRESET" ||
      code === "EHOSTUNREACH" ||
      code === "ENETUNREACH" ||
      code.includes("SSL") ||
      code.includes("CERT") ||
      String(e.message || "").includes("SSL")
    ) {
      return { verdict: "dead", reason: code };
    }
    return { verdict: "dead", reason: code };
  }
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next;
      next += 1;
      out[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return out;
}

async function main() {
  const rows = await db
    .select({
      id: gyms.id,
      name: gyms.name,
      www: gyms.www,
    })
    .from(gyms)
    .where(and(eq(gyms.listed, true), isNotNull(gyms.www), ne(gyms.www, "")));

  console.log(`Checking ${rows.length} www links (concurrency ${CONCURRENCY})…`);

  let done = 0;
  const results = await mapPool(rows, CONCURRENCY, async (row) => {
    const www = (row.www ?? "").trim();
    const checked = await checkUrl(www);
    done += 1;
    if (done % 50 === 0 || done === rows.length) {
      console.log(`Progress ${done}/${rows.length}`);
    }
    return {
      id: row.id,
      name: row.name,
      www,
      verdict: checked.verdict,
      reason: checked.reason,
    } satisfies Result;
  });

  const dead = results.filter((r) => r.verdict === "dead");
  const ok = results.filter((r) => r.verdict === "ok");

  console.log(`OK: ${ok.length}`);
  console.log(`DEAD: ${dead.length}`);
  console.log("Sample dead:");
  for (const d of dead.slice(0, 25)) {
    console.log(` - ${d.reason} | ${d.name} | ${d.www}`);
  }

  const reasonCounts: Record<string, number> = {};
  for (const d of dead) {
    reasonCounts[d.reason] = (reasonCounts[d.reason] || 0) + 1;
  }
  console.log("Dead reasons:", reasonCounts);

  const CHUNK = 100;
  for (let i = 0; i < dead.length; i += CHUNK) {
    const slice = dead.slice(i, i + CHUNK);
    for (const d of slice) {
      await db
        .update(gyms)
        .set({ www: null, wwwDead: d.www })
        .where(eq(gyms.id, d.id));
    }
    console.log(`Cleared www ${Math.min(i + CHUNK, dead.length)}/${dead.length}`);
  }

  const left = await db.execute(sql`
    select count(*)::int as n from gyms where listed = true and www is not null and www <> ''
  `);
  console.log("Listed gyms with www left:", left);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
