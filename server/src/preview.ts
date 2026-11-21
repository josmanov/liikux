import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { dataChanges } from "../db/schema.js";
import { fromLogged, type Field } from "./refresh/apply.js";
import { activeOffers, offerLookup, offersFor } from "./offers.js";

/**
 * Preview mode: the whole site as it would look after you approve everything
 * that waits in the review queue. Nothing is saved; the public site is not
 * touched. Only requests with the admin key and `x-preview: 1` get this.
 *
 * It works on the answers the normal routes already built: `previewTransform`
 * takes the JSON of /api/gyms, /api/gyms/:slug, /api/chains or
 * /api/chains/:slug/gyms and lays the waiting values (and waiting offers) on top.
 */

type Patch = Partial<Record<Field, unknown>>;

async function loadPatches(): Promise<Map<string, Patch>> {
  const rows = await db.select().from(dataChanges).where(eq(dataChanges.status, "held"));
  const out = new Map<string, Patch>();
  for (const r of rows) {
    const key = `${r.entityType}|${r.entityId}`;
    const patch = out.get(key) ?? {};
    const field = r.field as Field;
    patch[field] = fromLogged(field, r.newValue);
    out.set(key, patch);
  }
  return out;
}

const CHAIN_FIELDS: Field[] = ["priceFrom", "is247", "freeTrial", "dayPass"];

function lay<T extends Record<string, unknown>>(target: T, patch: Patch | undefined, only?: Field[]): T {
  if (!patch) return target;
  const next: Record<string, unknown> = { ...target };
  for (const [k, v] of Object.entries(patch)) {
    if (only && !only.includes(k as Field)) continue;
    next[k] = v;
  }
  return next as T;
}

type Obj = Record<string, unknown>;

export async function previewTransform(path: string, body: unknown): Promise<unknown> {
  const patches = await loadPatches();
  const offers = await activeOffers(true);
  const hasOffer = offerLookup(offers);

  const gymRow = (g: Obj): Obj => {
    let out = lay(g, patches.get(`gym|${g.id}`));
    const chainId = String(g.chainId ?? "");
    const chainPatch = patches.get(`chain|${chainId}`);
    const chain = out.chain as Obj | null | undefined;
    if (chain && chainPatch) out = { ...out, chain: lay(chain, chainPatch, CHAIN_FIELDS) };
    if ("hasOffer" in out) out = { ...out, hasOffer: hasOffer({ id: String(g.id), chainId }) };
    return out;
  };

  if (path === "/gyms" && Array.isArray(body)) return (body as Obj[]).map(gymRow);

  if (path === "/chains" && Array.isArray(body)) {
    return (body as Obj[]).map((c) => lay(c, patches.get(`chain|${c.id}`)));
  }

  const chainGyms = /^\/chains\/[^/]+\/gyms$/.exec(path);
  if (chainGyms && body && typeof body === "object") {
    const b = body as { chain?: Obj; gyms?: Obj[] };
    return {
      ...b,
      chain: b.chain ? lay(b.chain, patches.get(`chain|${b.chain.id}`)) : b.chain,
      gyms: (b.gyms ?? []).map(gymRow),
    };
  }

  if (/^\/gyms\/[^/]+$/.test(path) && body && typeof body === "object" && !Array.isArray(body)) {
    const g = body as Obj;
    let out = lay(g, patches.get(`gym|${g.id}`));
    const chain = g.chain as Obj | null | undefined;
    if (chain) out = { ...out, chain: lay(chain, patches.get(`chain|${chain.id}`)) };
    return { ...out, offers: offersFor(offers, { id: String(g.id), chainId: String(g.chainId) }) };
  }

  return body;
}
