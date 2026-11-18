import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { chains, dataChanges, enrichRuns, gyms, offers, pageHealth } from "../db/schema.js";
import { politeFetch } from "./verify/politeFetch.js";
import { adapterFor, extractGeneric, type Extracted } from "./enrich/adapters.js";
import { CHAIN_SOURCES, GYM_PAGE_CHAINS, type ChainFacts, type ChainSource, type Membership } from "./refresh/chainSources.js";
import { findOffers, offerKey, type FoundOffer } from "./refresh/offers.js";
import { planChanges, type Change, type Current, type Facts } from "./refresh/apply.js";
import { hashOf } from "./refresh/text.js";
import { GYM_PRICE_READERS } from "./refresh/gymParsers.js";

/**
 * The daily data refresh. Runs every morning on GitHub Actions, before the
 * data check (verify-data.ts). It costs nothing to run and uses no AI.
 *
 *   1. Chains: reads each chain's own price list page (refresh/chainSources.ts)
 *      and updates the chain's price, memberships, terms and hours.
 *   2. Gyms: for chains where every gym has its own price, reads each gym's
 *      own page (gym.www) and updates its price and hours.
 *   3. Offers: collects campaigns from the same pages (refresh/offers.ts).
 *      An offer seen on 3+ gym pages of a chain is stored for the whole chain.
 *
 * NOTHING IS WRITTEN TO THE SITE BY ITSELF. Every new value and every new
 * offer waits in the review page (/admin/tarkistus) until a person approves
 * it. A value that jumps more than 40 % gets a warning there (refresh/apply.ts).
 * The same change found again the next day is not added twice.
 *
 * Run:   npm run db:refresh          (writes)
 *        npm run db:refresh:dry      (prints what would change, writes nothing;
 *                                     also saves exports/refresh-report.json)
 * Flags: --dry-run  --chain=c2  --limit=5 (gyms per chain)
 */

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const ACCEPT_BIG = args.includes("--accept-big");
const ONLY_CHAIN = args.find((a) => a.startsWith("--chain="))?.split("=")[1];
const LIMIT = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 0);

type Gym = typeof gyms.$inferSelect;
type Chain = typeof chains.$inferSelect;

type Planned = {
  entityType: "chain" | "gym";
  entityId: string;
  name: string;
  chainId: string;
  sourceUrl: string;
  set: Record<string, unknown>;
  changes: Change[];
};

type Health = { url: string; chainId: string; gymId: string | null; hash: string | null; ok: boolean; detail: string | null };

type OfferHit = { chainId: string; gymId: string | null; offer: FoundOffer; sourceUrl: string };

const now = new Date();
const nowIso = now.toISOString();
const runId = `refresh-${nowIso.replace(/[:.]/g, "-")}`;

function currentOf(row: Chain | Gym): Current {
  return {
    priceFrom: row.priceFrom ?? null,
    hoursWeekday: row.hoursWeekday ?? null,
    hoursWeekend: row.hoursWeekend ?? null,
    is247: row.is247 ?? null,
    dayPass: row.dayPass ?? null,
    freeTrial: row.freeTrial ?? null,
    membershipsJson: row.membershipsJson ?? null,
  };
}

// ---------------------------------------------------------------------------
// Gym pages

function gymFacts(chainId: string, html: string, text: string, fields: ChainSource["gymFields"]): Facts {
  const adapter = adapterFor(chainId);
  const x: Extracted = adapter ? adapter(html) : extractGeneric(html);
  const want = new Set(fields ?? ["price", "hours", "memberships"]);
  const facts: Facts = {};
  if (want.has("price")) facts.priceFrom = x.priceFrom;
  if (want.has("hours")) {
    facts.hoursWeekday = x.hoursWeekday;
    facts.hoursWeekend = x.hoursWeekend;
    facts.is247 = x.is247;
  }
  if (want.has("memberships")) facts.memberships = x.memberships?.length ? x.memberships : null;
  // Better readers for chains whose old parser mixed in student or day-time prices.
  const reader = GYM_PRICE_READERS[chainId];
  const read = reader ? reader(text) : null;
  if (read) {
    if (want.has("price")) facts.priceFrom = read.priceFrom;
    if (want.has("memberships")) facts.memberships = read.memberships.length ? read.memberships : null;
    if (want.has("hours") && read.hours) {
      facts.hoursWeekday = read.hours === "00:00–24:00" ? "24/7" : read.hours;
      facts.hoursWeekend = facts.hoursWeekday;
      facts.is247 = facts.hoursWeekday === "24/7";
    }
  } else if (reader && want.has("price")) {
    facts.priceFrom = null; // the page did not have the list we expect: trust nothing from it
  }
  return facts;
}

/**
 * The gym's own membership list is only replaced when it is known to be out
 * of date (the price changed, or there was no list): a page often shows fewer
 * memberships than an earlier, more careful import found.
 */
function keepRicherList(current: Current, facts: Facts) {
  if (!facts.memberships) return;
  const priceChanged = facts.priceFrom != null && current.priceFrom != null && Math.abs(facts.priceFrom - current.priceFrom) >= 0.005;
  let oldCount = 0;
  try {
    oldCount = JSON.parse(current.membershipsJson ?? "[]").length;
  } catch {
    oldCount = 0;
  }
  if (!priceChanged && oldCount > facts.memberships.length) facts.memberships = null;
}

/**
 * The "new" price is already in the gym's price list as another contract
 * (e.g. Elixia's page shows only the no-commitment 49,90, while our list also
 * has the 12-month 34,90). That is not a price change: propose nothing.
 */
function sameListedPrice(current: Current, facts: Facts) {
  if (facts.priceFrom == null || current.priceFrom == null) return;
  if (Math.abs(facts.priceFrom - current.priceFrom) < 0.005) return;
  let list: { priceEur?: number }[] = [];
  try {
    list = JSON.parse(current.membershipsJson ?? "[]");
  } catch {
    list = [];
  }
  if (list.some((m) => typeof m.priceEur === "number" && Math.abs(m.priceEur - facts.priceFrom!) < 0.005)) {
    facts.priceFrom = null;
    facts.memberships = null;
  }
}

/**
 * Gym parsers often know only one opening time and copy it to the weekend.
 * If we already have a different weekend time, keep it.
 */
function keepOwnWeekend(current: Current, facts: Facts) {
  if (!facts.hoursWeekend || facts.hoursWeekend !== facts.hoursWeekday) return;
  if (current.hoursWeekend && current.hoursWeekend !== current.hoursWeekday) facts.hoursWeekend = null;
}

/** false when a redirect took us to a different page (not just http→https or a slash). */
function samePage(asked: string, got: string) {
  try {
    const a = new URL(asked);
    const b = new URL(got);
    const path = (u: URL) => decodeURIComponent(u.pathname).replace(/\/+$/, "").toLowerCase();
    return a.host.replace(/^www\./, "") === b.host.replace(/^www\./, "") && path(a) === path(b);
  } catch {
    return true;
  }
}

async function refreshGyms(source: ChainSource, chainGyms: Gym[], planned: Planned[], health: Health[], hits: OfferHit[]) {
  const list = LIMIT ? chainGyms.slice(0, LIMIT) : chainGyms;
  for (const gym of list) {
    const url = gym.www?.trim();
    if (!url || !/^https?:\/\//.test(url)) continue;
    const page = await politeFetch(url);
    if (!page.ok) {
      health.push({ url, chainId: source.chainId, gymId: gym.id, hash: null, ok: false, detail: `${page.reason}: ${page.detail}` });
      continue;
    }
    // The gym's address now leads to another page (a city list, the front
    // page): the gym may have closed or moved. Read nothing from it.
    if (samePage(url, page.finalUrl) === false) {
      health.push({ url, chainId: source.chainId, gymId: gym.id, hash: null, ok: false, detail: `ohjautuu toiselle sivulle: ${page.finalUrl}` });
      continue;
    }
    const current = currentOf(gym);
    const facts = gymFacts(source.chainId, page.html, page.text, source.gymFields);
    // Did the reader find anything at all? (Checked before the rules below drop values.)
    const parsedSomething = facts.priceFrom != null || facts.hoursWeekday != null || facts.is247 != null;
    sameListedPrice(current, facts);
    keepRicherList(current, facts);
    keepOwnWeekend(current, facts);
    health.push({ url, chainId: source.chainId, gymId: gym.id, hash: hashOf(page.text), ok: parsedSomething, detail: parsedSomething ? null : "hintaa tai aukioloa ei löytynyt" });
    const { set, changes } = planChanges(current, facts, { acceptBig: ACCEPT_BIG });
    if (changes.length) planned.push({ entityType: "gym", entityId: gym.id, name: gym.name, chainId: source.chainId, sourceUrl: url, set, changes });
    for (const offer of findOffers(page.text, now)) hits.push({ chainId: source.chainId, gymId: gym.id, offer, sourceUrl: url });
  }
}

// ---------------------------------------------------------------------------
// Chain pages

async function refreshChain(source: ChainSource, chain: Chain, planned: Planned[], health: Health[], hits: OfferHit[]) {
  const texts: string[] = [];
  for (const url of source.priceUrls) {
    const page = await politeFetch(url);
    if (!page.ok) {
      health.push({ url, chainId: chain.id, gymId: null, hash: null, ok: false, detail: `${page.reason}: ${page.detail}` });
      continue;
    }
    texts.push(page.text);
  }
  if (source.parse && texts.length) {
    const facts: ChainFacts = source.parse(texts);
    const ok = facts.priceFrom != null;
    for (const url of source.priceUrls) {
      health.push({ url, chainId: chain.id, gymId: null, hash: hashOf(texts.join("\n")), ok, detail: ok ? null : "hintaa ei löytynyt: sivu on ehkä muuttunut" });
    }
    if (ok) {
      const { set, changes } = planChanges(currentOf(chain), { ...facts, memberships: facts.memberships.length ? facts.memberships : null }, { acceptBig: ACCEPT_BIG });
      if (changes.length) planned.push({ entityType: "chain", entityId: chain.id, name: chain.name, chainId: chain.id, sourceUrl: source.priceUrls[0]!, set, changes });
    }
  }
  for (const url of [...source.priceUrls, ...source.offerUrls]) {
    const page = await politeFetch(url);
    if (!page.ok) continue;
    for (const offer of findOffers(page.text, now)) hits.push({ chainId: chain.id, gymId: null, offer, sourceUrl: url });
  }
}

/** The same offer on 3+ gym pages (or on a chain page) belongs to the whole chain. */
function groupOffers(hits: OfferHit[], chainSites: Map<string, string>) {
  const byKey = new Map<string, { hit: OfferHit; gymIds: Set<string>; chainWide: boolean }>();
  for (const h of hits) {
    const key = `${h.chainId}|${offerKey(h.offer.text)}`;
    const entry = byKey.get(key) ?? { hit: h, gymIds: new Set<string>(), chainWide: false };
    if (h.gymId) entry.gymIds.add(h.gymId);
    else {
      entry.chainWide = true;
      entry.hit = h;
    }
    byKey.set(key, entry);
  }
  const rows: (typeof offers.$inferInsert)[] = [];
  for (const [key, e] of byKey) {
    const base = {
      chainId: e.hit.chainId,
      title: e.hit.offer.title,
      text: e.hit.offer.text,
      priceEur: e.hit.offer.priceEur,
      discountPct: e.hit.offer.discountPct,
      validUntil: e.hit.offer.validUntil,
      firstSeenAt: nowIso,
      lastSeenAt: nowIso,
    };
    if (e.chainWide || e.gymIds.size >= 3) {
      // Seen on many gym pages: link to the chain's own site, not to one random gym.
      const sourceUrl = e.chainWide ? e.hit.sourceUrl : (chainSites.get(e.hit.chainId) ?? e.hit.sourceUrl);
      rows.push({ ...base, id: hashOf(`${key}|*`), gymId: null, sourceUrl });
    } else {
      for (const gymId of e.gymIds) {
        const hit = hits.find((h) => h.gymId === gymId && `${h.chainId}|${offerKey(h.offer.text)}` === key)!;
        rows.push({ ...base, id: hashOf(`${key}|${gymId}`), gymId, sourceUrl: hit.sourceUrl });
      }
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Saving

async function tablesExist() {
  const rows = await db.execute(sql`select to_regclass('public.data_changes') as a, to_regclass('public.offers') as b, to_regclass('public.page_health') as c`);
  const r = rows[0] as { a: string | null; b: string | null; c: string | null } | undefined;
  return Boolean(r?.a && r?.b && r?.c);
}

async function save(planned: Planned[], health: Health[], offerRows: (typeof offers.$inferInsert)[]) {
  // Everything goes to the review queue (status "held"); nothing is written to
  // gyms or chains here. A change already waiting with the same new value is
  // only marked as seen again; one waiting with an older value is replaced.
  const waiting = await db.select().from(dataChanges).where(eq(dataChanges.status, "held"));
  const byKey = new Map(waiting.map((w) => [`${w.entityType}|${w.entityId}|${w.field}`, w]));
  for (const p of planned) {
    for (const [i, c] of p.changes.entries()) {
      const key = `${p.entityType}|${p.entityId}|${c.field}`;
      const old = byKey.get(key);
      if (old && old.newValue === c.newValue) {
        await db.update(dataChanges).set({ changedAt: nowIso, sourceUrl: p.sourceUrl }).where(eq(dataChanges.id, old.id));
        continue;
      }
      if (old) await db.update(dataChanges).set({ status: "superseded" }).where(eq(dataChanges.id, old.id));
      await db.insert(dataChanges).values({
        // short and unique: long gym ids cut to 64 characters made two fields collide
        id: `${runId.slice(0, 32)}-${hashOf(`${p.entityType}|${p.entityId}|${c.field}|${i}`)}`,
        runId,
        entityType: p.entityType,
        entityId: p.entityId,
        field: c.field,
        oldValue: c.oldValue,
        newValue: c.newValue,
        sourceUrl: p.sourceUrl,
        status: "held",
        reason: c.reason ?? null,
        changedAt: nowIso,
      });
    }
  }

  for (const h of health) {
    await db
      .insert(pageHealth)
      .values({ url: h.url, chainId: h.chainId, gymId: h.gymId, hash: h.hash, ok: h.ok, detail: h.detail, lastFetchedAt: nowIso, lastOkAt: h.ok ? nowIso : null, changedAt: nowIso })
      .onConflictDoUpdate({
        target: pageHealth.url,
        set: {
          ok: h.ok,
          detail: h.detail,
          lastFetchedAt: nowIso,
          ...(h.ok ? { lastOkAt: nowIso } : {}),
          hash: h.hash,
          changedAt: sql`case when ${pageHealth.hash} is distinct from ${h.hash} then ${nowIso} else ${pageHealth.changedAt} end`,
        },
      });
  }

  for (const o of offerRows) {
    await db
      .insert(offers)
      .values(o)
      .onConflictDoUpdate({
        target: offers.id,
        // status is not touched: an approved offer stays approved, a rejected one stays away.
        set: { lastSeenAt: nowIso, title: o.title, text: o.text, priceEur: o.priceEur, discountPct: o.discountPct, validUntil: o.validUntil, sourceUrl: o.sourceUrl },
      });
  }
}

// ---------------------------------------------------------------------------

function show(v: string | null) {
  if (v == null) return "–";
  if (v.startsWith("[")) {
    try {
      return (JSON.parse(v) as Membership[]).map((m) => `${m.name} ${m.priceEur}`).join("; ");
    } catch {
      return v;
    }
  }
  return v;
}

async function main() {
  const t0 = Date.now();
  const chainRows = await db.select().from(chains);
  const chainById = new Map(chainRows.map((c) => [c.id, c]));
  const sources = CHAIN_SOURCES.filter((s) => !ONLY_CHAIN || s.chainId === ONLY_CHAIN);
  const gymChainIds = sources.map((s) => s.chainId).filter((id) => GYM_PAGE_CHAINS.has(id));
  const gymRows = gymChainIds.length
    ? await db.select().from(gyms).where(and(eq(gyms.listed, true), inArray(gyms.chainId, gymChainIds)))
    : [];

  const planned: Planned[] = [];
  const health: Health[] = [];
  const hits: OfferHit[] = [];

  // Chains run side by side; within a chain politeFetch waits 1 s per request.
  await Promise.all(
    sources.map(async (source) => {
      const chain = chainById.get(source.chainId);
      if (!chain) return;
      await refreshChain(source, chain, planned, health, hits);
      if (GYM_PAGE_CHAINS.has(source.chainId)) {
        await refreshGyms(source, gymRows.filter((g) => g.chainId === source.chainId), planned, health, hits);
      }
    }),
  );

  const chainSites = new Map(chainRows.filter((c) => c.website).map((c) => [c.id, c.website!]));
  const offerRows = groupOffers(hits, chainSites);
  const durationSec = Math.round((Date.now() - t0) / 100) / 10;

  // ---- report
  const applied = planned.flatMap((p) => p.changes.filter((c) => c.status === "applied").map((c) => ({ p, c })));
  const held = planned.flatMap((p) => p.changes.filter((c) => c.status === "held").map((c) => ({ p, c })));
  console.log("\n==== Data refresh ====");
  console.log(`duration ${durationSec}s, pages ${health.length}, gyms read ${health.filter((h) => h.gymId).length}`);
  console.log(`changes found: ${applied.length + held.length} (all go to the review page; ${held.length} with a warning)`);
  console.log("\n-- chains --");
  for (const p of planned.filter((x) => x.entityType === "chain")) {
    console.log(`${p.name} (${p.sourceUrl})`);
    for (const c of p.changes) console.log(`   ${c.status === "held" ? "HELD " : ""}${c.field}: ${show(c.oldValue)}  →  ${show(c.newValue)}${c.reason ? `  (${c.reason})` : ""}`);
  }
  console.log("\n-- gym prices that change --");
  for (const { p, c } of [...applied, ...held].filter(({ p, c }) => p.entityType === "gym" && c.field === "priceFrom")) {
    console.log(`   ${c.status === "held" ? "HELD " : ""}${p.name}: ${c.oldValue ?? "–"} → ${c.newValue}${c.reason ? `  (${c.reason})` : ""}`);
  }
  const hoursChanged = applied.filter(({ p, c }) => p.entityType === "gym" && c.field.startsWith("hours"));
  console.log(`\n-- gym hours that change: ${hoursChanged.length} values --`);
  for (const { p, c } of hoursChanged.slice(0, 25)) console.log(`   ${p.name} ${c.field}: ${c.oldValue ?? "–"} → ${c.newValue}`);
  const broken = health.filter((h) => !h.ok);
  console.log(`\n-- pages that failed or could not be read: ${broken.length} --`);
  for (const h of broken.slice(0, 25)) console.log(`   ${h.chainId} ${h.url}  ${h.detail ?? ""}`);
  console.log(`\n-- offers: ${offerRows.length} --`);
  for (const o of offerRows) {
    const who = o.gymId ? gymRows.find((g) => g.id === o.gymId)?.name : `${chainById.get(o.chainId)?.name} (koko ketju)`;
    console.log(`   ${who}: [${o.title}] ${o.text}${o.validUntil ? ` (voimassa ${o.validUntil} asti)` : ""}`);
  }

  if (DRY_RUN) {
    mkdirSync("../exports", { recursive: true });
    writeFileSync("../exports/refresh-report.json", JSON.stringify({ at: nowIso, planned, health, offers: offerRows }, null, 2));
    console.log("\nDRY RUN: nothing was written. Full report: exports/refresh-report.json");
    process.exit(0);
  }

  if (!(await tablesExist())) {
    console.error("\nThe tables offers / data_changes / page_health are missing. Run `npm run db:push` first.");
    process.exit(1);
  }
  await save(planned, health, offerRows);
  await db.insert(enrichRuns).values({
    id: runId,
    startedAt: nowIso,
    finishedAt: new Date().toISOString(),
    durationSec,
    dryRun: false,
    scanned: health.length,
    okCount: health.filter((h) => h.ok).length,
    partialCount: held.length,
    unknownCount: 0,
    failCount: broken.length,
    skippedCount: 0,
    pricesChanged: applied.filter(({ c }) => c.field === "priceFrom").length,
    hoursChanged: hoursChanged.length,
    changesJson: JSON.stringify(
      [...applied, ...held].filter(({ c }) => c.field !== "membershipsJson").slice(0, 400).map(({ p, c }) => ({ gym: p.name, field: c.field, old: c.oldValue, new: c.newValue, status: c.status })),
    ),
  });
  console.log(`\nSent to review: ${applied.length + held.length} changes, ${offerRows.length} offers seen. Approve them at /admin/tarkistus.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
