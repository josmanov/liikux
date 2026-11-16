import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { chains, enrichRuns, factChecks, gyms } from "../db/schema.js";
import { politeFetch, type Page } from "./verify/politeFetch.js";
import { hoursOnPage, longerCardOnPage, priceOnPage, pricesSeen } from "./verify/match.js";

/**
 * The daily data check.
 *
 * For every listed gym it opens the page the price came from (and the gym's
 * own page) and looks whether the price and opening hours we show are still
 * written there. It never changes a price or opening time. It only records:
 *
 *   confirmed    the value is on the page today
 *   not_found    the page loaded, but the value is not on it → look by hand
 *   unreachable  the page did not load (or is a PDF)
 *   blocked      the site's robots.txt does not allow robots there
 *   no_source    we have no page to check
 *
 * Run:   npm run db:verify            (writes to the fact_checks table)
 *        npm run db:verify:dry        (prints only, writes nothing)
 * Flags: --dry-run  --limit=50  --chain=c4  --concurrency=10
 */

type Gym = typeof gyms.$inferSelect;
type Chain = typeof chains.$inferSelect;
type Status = "confirmed" | "not_found" | "unreachable" | "blocked" | "no_source";
type Field = "price" | "hours";

type Check = {
  gym: Gym;
  field: Field;
  value: string;
  status: Status;
  sourceUrl: string | null;
  note: string | null;
};

const args = process.argv.slice(2);
const flag = (name: string) => (args.find((a) => a.startsWith(`--${name}=`)) ?? "").split("=")[1] ?? "";
const DRY_RUN = args.includes("--dry-run");
const LIMIT = Number(flag("limit") || 0);
const ONLY_CHAIN = flag("chain");
const CONCURRENCY = Number(flag("concurrency") || 10);
const MAX_PAGES_PER_FACT = 3;

function cleanUrl(raw: string | null | undefined) {
  const url = (raw ?? "").trim().replace(/#.*$/, "");
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : "https://" + url;
}

/** offer_source_url can hold several addresses: "a | b". */
function splitUrls(raw: string | null | undefined) {
  return (raw ?? "")
    .split("|")
    .map(cleanUrl)
    .filter((u): u is string => u != null);
}

function unique(urls: (string | null)[]) {
  return [...new Set(urls.filter((u): u is string => u != null))].slice(0, MAX_PAGES_PER_FACT);
}

/** The price and hours the site shows for this gym, and where to check them. */
function factsToCheck(gym: Gym, chain: Chain | undefined) {
  const mode = chain?.pricingMode ?? "location";
  const ownPage = cleanUrl(gym.www);
  const chainPage = cleanUrl(chain?.sourceUrl);
  const facts: { field: Field; value: string; urls: string[] }[] = [];

  const usesChainPrice = gym.priceFrom == null && (mode === "shared" || mode === "hybrid");
  const price = gym.priceFrom ?? (usesChainPrice ? chain?.priceFrom ?? null : null);
  if (price != null) {
    const urls = unique([
      ...splitUrls(gym.offerSourceUrl),
      usesChainPrice ? chainPage : null,
      ownPage,
    ]);
    facts.push({ field: "price", value: String(price), urls });
  }

  const usesChainHours = !gym.hoursWeekday && gym.is247 !== true && mode === "shared";
  const hours =
    gym.is247 === true
      ? "24/7"
      : gym.hoursWeekday ??
        (usesChainHours ? (chain?.is247 === true ? "24/7" : chain?.hoursWeekday ?? null) : null);
  if (hours) {
    const urls = unique([ownPage, ...splitUrls(gym.offerSourceUrl), usesChainHours ? chainPage : null]);
    facts.push({ field: "hours", value: hours, urls });
  }
  return facts;
}

async function checkFact(
  gym: Gym,
  fact: { field: Field; value: string; urls: string[] },
): Promise<Check> {
  const base = { gym, field: fact.field, value: fact.value };
  if (!fact.urls.length) {
    return { ...base, status: "no_source", sourceUrl: null, note: null };
  }

  const loaded: Extract<Page, { ok: true }>[] = [];
  const failed: Extract<Page, { ok: false }>[] = [];

  for (const url of fact.urls) {
    const page = await politeFetch(url);
    if (!page.ok) {
      failed.push(page);
      continue;
    }
    loaded.push(page);
    // Look in the visible text first, then in the raw page (some shops keep prices in scripts).
    const found =
      fact.field === "price"
        ? priceOnPage(page.text, Number(fact.value)) || priceOnPage(page.html, Number(fact.value))
        : hoursOnPage(page.text, fact.value);
    if (found) {
      return { ...base, status: "confirmed", sourceUrl: url, note: null };
    }
  }

  // The monthly price may be worked out from a 3, 6 or 12 month card.
  if (fact.field === "price") {
    for (const page of loaded) {
      const card = longerCardOnPage(page.text, Number(fact.value));
      if (card) {
        const note = `${card.months} kk: ${String(card.total).replace(".", ",")} €`;
        return { ...base, status: "confirmed", sourceUrl: page.url, note };
      }
    }
  }

  const first = loaded[0];
  if (first) {
    const seen = fact.field === "price" ? pricesSeen(first.text) : [];
    const note = seen.length
      ? "sivulla: " + seen.map((n) => String(n).replace(".", ",") + " €").join(", ")
      : null;
    return { ...base, status: "not_found", sourceUrl: first.url, note };
  }

  const blocked = failed.find((p) => p.reason === "blocked");
  const fail = blocked ?? failed[0];
  return {
    ...base,
    status: blocked ? "blocked" : "unreachable",
    sourceUrl: fail?.url ?? null,
    note: fail?.detail ?? null,
  };
}

async function runPool<T>(items: T[], size: number, work: (item: T) => Promise<void>) {
  let next = 0;
  const runners = Array.from({ length: Math.max(1, size) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      if (item !== undefined) await work(item);
    }
  });
  await Promise.all(runners);
}

/** Mix the order so one chain's site is not hit by every worker at once. */
function shuffled<T>(items: T[]) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

async function tableExists() {
  const rows = await db.execute(sql`select to_regclass('public.fact_checks') as name`);
  return Boolean((rows[0] as { name: string | null } | undefined)?.name);
}

async function save(checks: Check[], now: string) {
  const rows = checks.map((c) => ({
    gymId: c.gym.id,
    field: c.field,
    value: c.value,
    status: c.status,
    sourceUrl: c.sourceUrl,
    checkedAt: now,
    verifiedAt: c.status === "confirmed" ? now : null,
    note: c.note,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    await db
      .insert(factChecks)
      .values(rows.slice(i, i + 200))
      .onConflictDoUpdate({
        target: [factChecks.gymId, factChecks.field],
        set: {
          value: sql`excluded.value`,
          status: sql`excluded.status`,
          sourceUrl: sql`excluded.source_url`,
          checkedAt: sql`excluded.checked_at`,
          // Keep the old "last confirmed" date when today's check did not confirm.
          verifiedAt: sql`coalesce(excluded.verified_at, ${factChecks.verifiedAt})`,
          note: sql`excluded.note`,
        },
      });
  }
}

function count(checks: Check[], field: Field) {
  const out: Record<Status, number> = {
    confirmed: 0,
    not_found: 0,
    unreachable: 0,
    blocked: 0,
    no_source: 0,
  };
  for (const c of checks) if (c.field === field) out[c.status]++;
  return out;
}

async function main() {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();

  if (!DRY_RUN && !(await tableExists())) {
    console.error(
      "The fact_checks table does not exist yet. Run `npm run db:push` first, or use --dry-run.",
    );
    process.exit(1);
  }

  const chainById = new Map((await db.select().from(chains)).map((c) => [c.id, c]));
  let gymRows = await db.select().from(gyms).where(eq(gyms.listed, true));
  if (ONLY_CHAIN) gymRows = gymRows.filter((g) => g.chainId === ONLY_CHAIN);
  gymRows = shuffled(gymRows);
  if (LIMIT > 0) gymRows = gymRows.slice(0, LIMIT);

  console.log(`Data check start ${startedAt} gyms=${gymRows.length} dryRun=${DRY_RUN}`);

  const checks: Check[] = [];
  let done = 0;
  await runPool(gymRows, CONCURRENCY, async (gym) => {
    for (const fact of factsToCheck(gym, chainById.get(gym.chainId))) {
      checks.push(await checkFact(gym, fact));
    }
    done++;
    if (done % 100 === 0) console.log(`  ${done}/${gymRows.length}`);
  });

  const price = count(checks, "price");
  const hours = count(checks, "hours");
  const durationSec = Math.round((Date.now() - t0) / 100) / 10;

  // "Price not found on a page that loaded" is what a person should look at.
  const toReview = checks
    .filter((c) => c.field === "price" && c.status === "not_found")
    .sort((a, b) => a.gym.name.localeCompare(b.gym.name, "fi"));

  console.log("\n==== Data check report ====");
  console.log(`duration     ${durationSec}s`);
  console.log(`gyms         ${gymRows.length}`);
  for (const [label, c] of [["price", price], ["hours", hours]] as const) {
    console.log(
      `${label.padEnd(12)} confirmed=${c.confirmed} not_found=${c.not_found} unreachable=${c.unreachable} blocked=${c.blocked} no_source=${c.no_source}`,
    );
  }
  if (toReview.length) {
    console.log(`\nprice not found on the page (${toReview.length}), first 30:`);
    for (const c of toReview.slice(0, 30)) {
      console.log(`  ${c.gym.name} | ours ${c.value} € | ${c.note ?? "-"} | ${c.sourceUrl}`);
    }
  }

  if (DRY_RUN) {
    console.log("\nDRY RUN: nothing was written to the database.");
    process.exit(0);
  }

  await save(checks, startedAt);
  await db.insert(enrichRuns).values({
    id: `check-${startedAt.replace(/[:.]/g, "-")}`,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationSec,
    dryRun: false,
    scanned: gymRows.length,
    okCount: price.confirmed,
    partialCount: price.not_found,
    unknownCount: price.no_source,
    failCount: price.unreachable + price.blocked,
    skippedCount: 0,
    changesJson: JSON.stringify(
      toReview.slice(0, 400).map((c) => ({
        gym: c.gym.name,
        field: "price",
        old: `${c.value} €`,
        new: c.note ?? "ei löytynyt sivulta",
      })),
    ),
  });
  console.log(`\nSaved ${checks.length} checks.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
