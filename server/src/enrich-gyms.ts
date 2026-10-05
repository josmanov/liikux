import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { chains, enrichRuns, gyms } from "../db/schema.js";
import { fetchPage } from "./enrich/fetchPage.js";
import {
  chainPatternUrls,
  findCandidateLinks,
  guessedOfferPaths,
  sameHost,
} from "./enrich/discover.js";
import {
  adapterFor,
  emptyExtracted,
  extractGeneric,
  mergeExtracted,
  type Extracted,
} from "./enrich/adapters.js";
import {
  aiExtractOffer,
  hasAiKey,
  pagesToAiInput,
} from "./enrich/aiExtract.js";
import { buildSearchQuery, googleCandidateUrls } from "./enrich/googleFind.js";

type Gym = typeof gyms.$inferSelect;
type Chain = typeof chains.$inferSelect;

type Change = {
  gym: string;
  field: "price" | "hours";
  old: string | number | null;
  new: string | number | null;
};

type GymResult = {
  status: "ok" | "partial" | "unknown" | "fail" | "chain" | "skipped";
  missReason: string | null;
  sourceUrl: string | null;
  method: string | null;
  extracted: Extracted;
  pagesTried: number;
};

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ONLY_MISSING = args.includes("--only-missing");
const SKIP_OTHER = args.includes("--skip-other");
const NO_AI = args.includes("--no-ai");
const NO_GOOGLE = args.includes("--no-google");
const LIMIT = Number(
  (args.find((a) => a.startsWith("--limit=")) ?? "").split("=")[1] || 0,
);
const ONLY_CHAIN =
  (args.find((a) => a.startsWith("--chain=")) ?? "").split("=")[1] || "";
const CONCURRENCY = Number(
  (args.find((a) => a.startsWith("--concurrency=")) ?? "").split("=")[1] || 6,
);
const MAX_PAGES = 8;

function nowIso() {
  return new Date().toISOString();
}

function normalizeWww(www: string | null) {
  if (!www) return null;
  let w = www.trim();
  if (!w) return null;
  if (!/^https?:\/\//i.test(w)) w = "https://" + w;
  w = w.replace(/#.*$/, "");
  return w;
}

function fmtHours(e: { hoursWeekday: string | null; is247: boolean | null }) {
  if (e.is247 === true) return "24/7";
  return e.hoursWeekday;
}

function complete(e: Extracted) {
  return e.priceFrom != null && Boolean(fmtHours(e));
}

function applyPage(
  html: string,
  chainId: string,
  acc: Extracted,
): Extracted {
  const adapter = adapterFor(chainId);
  let got = adapter ? adapter(html) : emptyExtracted();
  if (got.priceFrom == null || !fmtHours(got)) {
    got = mergeExtracted(got, extractGeneric(html));
  }
  return mergeExtracted(acc, got);
}

function finishStatus(
  acc: Extracted,
  sourceUrl: string | null,
  method: string | null,
  pagesTried: number,
  fetchFails: number,
  httpErrors: number,
  extraMiss: string | null,
): GymResult {
  const hasPrice = acc.priceFrom != null;
  const hasHours = Boolean(fmtHours(acc));
  if (hasPrice && hasHours) {
    return {
      status: "ok",
      missReason: null,
      sourceUrl,
      method,
      extracted: acc,
      pagesTried,
    };
  }
  if (hasPrice || hasHours) {
    return {
      status: "partial",
      missReason:
        (hasPrice ? "hours_not_found" : "price_not_found") +
        (extraMiss ? `; ${extraMiss}` : ""),
      sourceUrl,
      method,
      extracted: acc,
      pagesTried,
    };
  }
  if (pagesTried > 0 && fetchFails + httpErrors === pagesTried) {
    return {
      status: "fail",
      missReason:
        (httpErrors
          ? `http_error_or_timeout (${pagesTried} sivua)`
          : "fetch_fail") + (extraMiss ? `; ${extraMiss}` : ""),
      sourceUrl: null,
      method,
      extracted: acc,
      pagesTried,
    };
  }
  return {
    status: "unknown",
    missReason:
      `no_price_or_hours_on_pages (${pagesTried} sivua)` +
      (extraMiss ? `; ${extraMiss}` : ""),
    sourceUrl: null,
    method,
    extracted: acc,
    pagesTried,
  };
}

async function enrichOne(gym: Gym, chain: Chain | undefined): Promise<GymResult> {
  const mode = chain?.pricingMode ?? "location";
  if (mode === "shared") {
    return {
      status: "chain",
      missReason: null,
      sourceUrl: chain?.sourceUrl ?? null,
      method: "chain",
      extracted: emptyExtracted(),
      pagesTried: 0,
    };
  }

  const queue: string[] = [];
  const www = normalizeWww(gym.www);
  if (www) queue.push(www);
  for (const u of chainPatternUrls(gym.chainId, gym.name)) {
    if (!queue.includes(u)) queue.push(u);
  }
  for (const u of guessedOfferPaths(www)) {
    if (!queue.includes(u)) queue.push(u);
  }

  const visited = new Set<string>();
  let acc = emptyExtracted();
  let sourceUrl: string | null = null;
  let method: string | null = null;
  let fetchFails = 0;
  let httpErrors = 0;
  let pagesTried = 0;
  const collected: { url: string; html: string }[] = [];
  const notes: string[] = [];

  if (!queue.length) {
    notes.push("no_www");
  }

  while (queue.length && pagesTried < MAX_PAGES) {
    const url = queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);
    pagesTried++;

    const page = await fetchPage(url);
    if (!page) {
      fetchFails++;
      continue;
    }
    if (!page.html) {
      httpErrors++;
      continue;
    }

    collected.push({ url: page.finalUrl || url, html: page.html });
    const before = acc;
    acc = applyPage(page.html, gym.chainId, acc);
    if (
      (acc.priceFrom != null && before.priceFrom == null) ||
      (fmtHours(acc) && !fmtHours(before))
    ) {
      sourceUrl = page.finalUrl || url;
      method = "deterministic";
    }
    if (complete(acc)) break;

    const base = page.finalUrl || url;
    for (const link of findCandidateLinks(page.html, base, 6)) {
      if (!visited.has(link) && !queue.includes(link) && sameHost(link, base)) {
        queue.push(link);
      }
    }
  }

  if (!complete(acc) && !NO_AI && hasAiKey() && collected.length) {
    const ai = await aiExtractOffer({
      gymName: gym.name,
      city: gym.city,
      chainName: chain?.name,
      pageTexts: pagesToAiInput(collected),
    });
    if (ai) {
      if (ai.rawNote) notes.push(ai.rawNote);
      const before = acc;
      acc = mergeExtracted(acc, ai.extracted);
      if (
        (acc.priceFrom != null && before.priceFrom == null) ||
        (fmtHours(acc) && !fmtHours(before))
      ) {
        sourceUrl = ai.sourceUrl ?? sourceUrl;
        method = method ? `${method}+ai` : "ai";
      }
    } else {
      notes.push("ai_skipped_or_empty");
    }
  } else if (!complete(acc) && !NO_AI && !hasAiKey()) {
    notes.push("ai_no_key");
  }

  if (!complete(acc) && !NO_GOOGLE) {
    const need =
      acc.priceFrom == null && !fmtHours(acc)
        ? "both"
        : acc.priceFrom == null
          ? "price"
          : "hours";
    const q = buildSearchQuery(gym.name, gym.city, need);
    let found: string[] = [];
    try {
      found = await googleCandidateUrls(q, 5);
    } catch {
      notes.push("google_search_fail");
    }
    const extra: string[] = [];
    for (const u of found) {
      for (const g of guessedOfferPaths(u)) {
        if (!found.includes(g) && !extra.includes(g)) extra.push(g);
      }
    }
    const toFetch = [...found, ...extra];
    for (const u of toFetch) {
      if (visited.has(u)) continue;
      visited.add(u);
      if (pagesTried >= MAX_PAGES + 6) break;
      pagesTried++;
      const page = await fetchPage(u);
      if (!page?.html) continue;
      collected.push({ url: page.finalUrl || u, html: page.html });
      const before = acc;
      acc = applyPage(page.html, gym.chainId, acc);
      if (
        (acc.priceFrom != null && before.priceFrom == null) ||
        (fmtHours(acc) && !fmtHours(before))
      ) {
        sourceUrl = page.finalUrl || u;
        method = method ? `${method}+google` : "google";
      }
      if (complete(acc)) break;
      const base = page.finalUrl || u;
      for (const link of findCandidateLinks(page.html, base, 4)) {
        if (!visited.has(link) && !toFetch.includes(link)) {
          toFetch.push(link);
        }
      }
    }
    if (!found.length) notes.push("google_no_results");

    if (!complete(acc) && !NO_AI && hasAiKey() && collected.length) {
      const ai = await aiExtractOffer({
        gymName: gym.name,
        city: gym.city,
        chainName: chain?.name,
        pageTexts: pagesToAiInput(collected.slice(-4)),
      });
      if (ai) {
        if (ai.rawNote) notes.push(ai.rawNote);
        const before = acc;
        acc = mergeExtracted(acc, ai.extracted);
        if (
          (acc.priceFrom != null && before.priceFrom == null) ||
          (fmtHours(acc) && !fmtHours(before))
        ) {
          sourceUrl = ai.sourceUrl ?? sourceUrl;
          method = method ? `${method}+ai` : "ai";
        }
      }
    }
  }

  if (!complete(acc) && !notes.includes("needs_manual")) {
    notes.push("needs_manual");
  }

  return finishStatus(
    acc,
    sourceUrl,
    method,
    pagesTried,
    fetchFails,
    httpErrors,
    notes.length ? notes.join("; ") : null,
  );
}

async function runPool<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<void>,
  size: number,
) {
  let next = 0;
  const runners = Array.from({ length: Math.max(1, size) }, async () => {
    while (next < items.length) {
      const i = next++;
      const item = items[i];
      if (item === undefined) break;
      await worker(item, i);
    }
  });
  await Promise.all(runners);
}

async function main() {
  const startedAt = nowIso();
  const t0 = Date.now();
  const runId = `run-${startedAt.replace(/[:.]/g, "-")}`;

  const chainRows = await db.select().from(chains);
  const chainById = new Map(chainRows.map((c) => [c.id, c]));

  let gymRows = (await db.select().from(gyms).where(eq(gyms.listed, true))).sort(
    (a, b) => a.name.localeCompare(b.name, "fi"),
  );
  if (SKIP_OTHER) gymRows = gymRows.filter((g) => g.chainId !== "c-other");
  if (ONLY_CHAIN) gymRows = gymRows.filter((g) => g.chainId === ONLY_CHAIN);
  if (ONLY_MISSING) {
    gymRows = gymRows.filter((g) => {
      const c = chainById.get(g.chainId);
      const mode = c?.pricingMode ?? "location";
      if (mode === "shared") return false;
      return g.priceFrom == null || (!g.hoursWeekday && g.is247 !== true);
    });
  }
  if (LIMIT > 0) gymRows = gymRows.slice(0, LIMIT);

  console.log(
    `Enrich start ${startedAt} gyms=${gymRows.length} dryRun=${DRY_RUN} concurrency=${CONCURRENCY} ai=${!NO_AI && hasAiKey()} google=${!NO_GOOGLE}`,
  );

  const counts = {
    scanned: 0,
    ok: 0,
    partial: 0,
    unknown: 0,
    fail: 0,
    skipped: 0,
    pricesNew: 0,
    pricesChanged: 0,
    hoursNew: 0,
    hoursChanged: 0,
  };
  const changes: Change[] = [];
  let done = 0;

  await runPool(
    gymRows,
    async (gym) => {
      const chain = chainById.get(gym.chainId);
      let result: GymResult;
      try {
        result = await enrichOne(gym, chain);
      } catch (e) {
        result = {
          status: "fail",
          missReason: `exception: ${String(e).slice(0, 120)}`,
          sourceUrl: null,
          method: null,
          extracted: emptyExtracted(),
          pagesTried: 0,
        };
      }

      counts.scanned++;
      if (result.status === "chain") counts.skipped++;
      else counts[result.status]++;

      const e = result.extracted;
      const oldPrice = gym.priceFrom ?? null;
      const oldHours = fmtHours(gym);
      const newPrice = e.priceFrom ?? oldPrice;
      const newHoursWeekday = e.hoursWeekday ?? gym.hoursWeekday ?? null;
      const newHoursWeekend = e.hoursWeekend ?? gym.hoursWeekend ?? null;
      const newIs247 = e.is247 ?? gym.is247 ?? null;
      const newHours = fmtHours({ hoursWeekday: newHoursWeekday, is247: newIs247 });

      if (e.priceFrom != null) {
        if (oldPrice == null) counts.pricesNew++;
        else if (Math.abs(oldPrice - e.priceFrom) > 0.001) counts.pricesChanged++;
        if (oldPrice == null || Math.abs(oldPrice - e.priceFrom) > 0.001) {
          changes.push({ gym: gym.name, field: "price", old: oldPrice, new: e.priceFrom });
        }
      }
      if (newHours && newHours !== oldHours) {
        if (!oldHours) counts.hoursNew++;
        else counts.hoursChanged++;
        changes.push({ gym: gym.name, field: "hours", old: oldHours, new: newHours });
      }

      let missReason = result.missReason;
      if (result.status !== "chain" && e.priceFrom == null && oldPrice != null) {
        missReason = (missReason ? missReason + "; " : "") + "kept_old_price";
      }

      if (!DRY_RUN) {
        await db
          .update(gyms)
          .set({
            priceFrom: newPrice,
            hoursWeekday: newHoursWeekday,
            hoursWeekend: newHoursWeekend,
            is247: newIs247,
            membershipsJson: e.memberships
              ? JSON.stringify(e.memberships)
              : gym.membershipsJson,
            offerCheckedAt: nowIso(),
            enrichStatus: result.status,
            missReason,
            offerSourceUrl: result.sourceUrl ?? gym.offerSourceUrl ?? null,
            offerMethod: result.method ?? gym.offerMethod ?? null,
          })
          .where(eq(gyms.id, gym.id));
      }

      done++;
      const tag = result.status.toUpperCase().padEnd(7);
      console.log(
        `${tag} ${String(done).padStart(4)}/${gymRows.length} ${gym.chainId.padEnd(7)} ${gym.name} | price=${e.priceFrom ?? "-"} hours=${fmtHours(e) ?? "-"} method=${result.method ?? "-"} pages=${result.pagesTried}${missReason ? " | " + missReason : ""}`,
      );
    },
    CONCURRENCY,
  );

  const finishedAt = nowIso();
  const durationSec = Math.round((Date.now() - t0) / 100) / 10;

  console.log("\n==== Enrich report ====");
  console.log(`started   ${startedAt}`);
  console.log(`finished  ${finishedAt}`);
  console.log(`duration  ${durationSec}s`);
  console.log(`scanned   ${counts.scanned}`);
  console.log(`ok        ${counts.ok}`);
  console.log(`partial   ${counts.partial}`);
  console.log(`unknown   ${counts.unknown}`);
  console.log(`fail      ${counts.fail}`);
  console.log(`chain     ${counts.skipped} (shared-ketju, hinta ketjulta)`);
  console.log(`prices    new=${counts.pricesNew} changed=${counts.pricesChanged}`);
  console.log(`hours     new=${counts.hoursNew} changed=${counts.hoursChanged}`);
  const sample = changes.slice(0, 25);
  if (sample.length) {
    console.log("\nmuutokset (vanha -> uusi):");
    for (const c of sample) {
      console.log(`  ${c.gym} [${c.field}] ${c.old ?? "-"} -> ${c.new ?? "-"}`);
    }
    if (changes.length > sample.length) {
      console.log(`  ... +${changes.length - sample.length} lisää`);
    }
  }
  if (DRY_RUN) console.log("\nDRY RUN: mitään ei kirjoitettu tietokantaan.");

  if (!DRY_RUN) {
    await db.insert(enrichRuns).values({
      id: runId,
      startedAt,
      finishedAt,
      durationSec,
      dryRun: false,
      scanned: counts.scanned,
      okCount: counts.ok,
      partialCount: counts.partial,
      unknownCount: counts.unknown,
      failCount: counts.fail,
      skippedCount: counts.skipped,
      pricesNew: counts.pricesNew,
      pricesChanged: counts.pricesChanged,
      hoursNew: counts.hoursNew,
      hoursChanged: counts.hoursChanged,
      changesJson: JSON.stringify(changes.slice(0, 400)),
    });
  }

  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
