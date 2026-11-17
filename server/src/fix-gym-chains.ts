import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { chains, gyms } from "../db/schema.js";

/**
 * Puts gyms in the right chain, using the gym's own website.
 *
 * A gym whose website is on a chain's domain (e.g. porttipuisto.ole.fit →
 * Ole.Fit) belongs to that chain. The LIPAS import guessed chains from the
 * name only, so gyms like "Fit Porttipuisto" ended up under "Muut".
 * A gym is also moved when its name clearly has a chain's brand in it and it
 * has no website that says otherwise.
 *
 * Run:   npm run db:fix-chains          (prints the list, writes nothing)
 *        npm run db:fix-chains -- --apply
 * Before writing, the old chain of every moved gym is saved to
 * exports/gym-chains-before-<time>.json, so the change can be undone.
 */

const APPLY = process.argv.includes("--apply");

/** chain id → website hosts (and their subdomains) that belong to it. */
const CHAIN_HOSTS: Record<string, string[]> = {
  c1: ["easyfit.fi"],
  c2: ["elixia.fi", "sats.fi"],
  c3: ["fressi.fi"],
  c4: ["fitness24seven.com", "f24s.fi"],
  c6: ["liikku.fi"],
  c7: ["foreverclub.fi", "forever.fi"],
  c8: ["ladyline.fi"],
  c9: ["ole.fit"],
  c10: ["esport.fi"],
  c11: ["unisport.fi"],
  c12: ["mmkuntotalo.fi"],
};

/** Brand names that only that chain uses. */
const CHAIN_NAMES: Record<string, RegExp> = {
  c1: /\beasy\s?fit\b/i,
  c2: /\belixia\b/i,
  c3: /\bfressi\b/i,
  c4: /fitness\s?24\s?seven|\bf24s?\b/i,
  c6: /\bliikku\b/i,
  c7: /\bforever\b/i,
  c8: /\blady\s?line\b/i,
  c9: /\bole\.?\s?fit\b/i,
  c10: /\besport\b/i,
  c11: /\bunisport\b/i,
  c12: /\bm\s?&\s?m\b|mm\s?kuntotalo/i,
};

function chainForHost(url: string | null): string | null {
  if (!url) return null;
  let host: string;
  try {
    host = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).host.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
  for (const [chainId, hosts] of Object.entries(CHAIN_HOSTS)) {
    if (hosts.some((h) => host === h || host.endsWith(`.${h}`))) return chainId;
  }
  return null;
}

function chainForName(name: string): string | null {
  const hits = Object.entries(CHAIN_NAMES).filter(([, re]) => re.test(name));
  return hits.length === 1 ? hits[0]![0] : null;
}

async function main() {
  const chainRows = await db.select({ id: chains.id, name: chains.name }).from(chains);
  const chainName = new Map(chainRows.map((c) => [c.id, c.name]));
  const rows = await db.select({ id: gyms.id, name: gyms.name, city: gyms.city, chainId: gyms.chainId, www: gyms.www, listed: gyms.listed }).from(gyms);

  const moves: { id: string; name: string; city: string; www: string | null; from: string; to: string; why: string }[] = [];
  const unsure: string[] = [];
  for (const g of rows) {
    const byHost = chainForHost(g.www);
    const byName = chainForName(g.name);
    let to: string | null = null;
    let why = "";
    if (byHost) {
      to = byHost;
      why = `sivu ${g.www}`;
      if (byName && byName !== byHost) {
        unsure.push(`${g.name} (${g.city}): nimi → ${chainName.get(byName)}, sivu → ${chainName.get(byHost)}`);
        continue;
      }
    } else if (byName && !g.www) {
      to = byName;
      why = "nimi";
    } else if (byName && g.chainId === "c-other") {
      // Own domain (e.g. olefittampella.fi), but the brand is in the name and
      // the gym is under "Muut" now: the name wins.
      to = byName;
      why = `nimi (oma sivu ${g.www})`;
    } else if (byName && g.www && byName !== g.chainId) {
      unsure.push(`${g.name} (${g.city}): nimi → ${chainName.get(byName)}, mutta sivu ${g.www}`);
      continue;
    }
    if (to && to !== g.chainId) {
      moves.push({ id: g.id, name: g.name, city: g.city, www: g.www, from: g.chainId, to, why });
    }
  }

  console.log(`\n${moves.length} gyms in the wrong chain:`);
  for (const m of moves) {
    console.log(`  ${m.name} (${m.city}): ${chainName.get(m.from) ?? m.from} → ${chainName.get(m.to) ?? m.to}   [${m.why}]`);
  }
  if (unsure.length) {
    console.log(`\n${unsure.length} left alone (name and website disagree):`);
    for (const u of unsure) console.log(`  ${u}`);
  }

  if (!APPLY) {
    console.log("\nNothing written. Run with --apply to move them.");
    process.exit(0);
  }

  mkdirSync("../exports", { recursive: true });
  const file = `../exports/gym-chains-before-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  writeFileSync(file, JSON.stringify(moves.map((m) => ({ id: m.id, name: m.name, chainId: m.from })), null, 2));
  for (const m of moves) {
    await db.update(gyms).set({ chainId: m.to }).where(eq(gyms.id, m.id));
  }
  console.log(`\nMoved ${moves.length} gyms. Old chains saved to ${file.replace("../", "")}.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
