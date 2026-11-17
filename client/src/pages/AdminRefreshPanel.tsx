import { useEffect, useState } from "react";
import { API } from "../data/apiBase";

/**
 * Admin: what the daily refresh (server/src/refresh-data.ts) changed.
 *
 *   - Odottaa hyväksyntää: price jumps over 40 % that were not written.
 *   - Muutokset (7 pv): what was written automatically, with an undo button.
 *   - Ketjujen lukijat: pages where the chain's parser stopped finding prices
 *     (red = the site probably changed; the parser needs a fix).
 *   - Tarjoukset: offers on the site now, with a hide button.
 */

type Change = {
  id: string;
  entityType: "chain" | "gym";
  entityId: string;
  name: string;
  slug: string | null;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  sourceUrl: string | null;
  status: string;
  reason: string | null;
  changedAt: string;
};

type ChainHealth = { chainId: string; name: string; ok: number; broken: number };
type BrokenPage = { url: string; chain: string; gym: string | null; detail: string | null; lastOkAt: string | null };
type Offer = {
  id: string;
  chain: string;
  gym: string | null;
  title: string;
  text: string;
  validUntil: string | null;
  sourceUrl: string;
  lastSeenAt: string;
  hiddenAt: string | null;
  active: boolean;
};
type Refresh = {
  ready: boolean;
  lastRun?: { startedAt: string; durationSec: number | null; scanned: number; failCount: number } | null;
  recent?: Change[];
  held?: Change[];
  chains?: ChainHealth[];
  brokenPages?: BrokenPage[];
  offers?: Offer[];
};

const FIELD_TEXT: Record<string, string> = {
  priceFrom: "hinta alk.",
  hoursWeekday: "aukiolo arki",
  hoursWeekend: "aukiolo vkl",
  is247: "24/7",
  dayPass: "kertakäynti",
  freeTrial: "ilmainen kokeilu",
  membershipsJson: "jäsenyydet",
};

function short(value: string | null) {
  if (value == null) return "–";
  if (value.startsWith("[")) {
    try {
      const list = JSON.parse(value) as { name: string; priceEur: number }[];
      return `${list.length} kpl: ${list
        .slice(0, 3)
        .map((m) => `${m.name} ${m.priceEur} €`)
        .join(", ")}${list.length > 3 ? " …" : ""}`;
    } catch {
      return value.slice(0, 80);
    }
  }
  return value;
}

function day(iso: string | null) {
  if (!iso) return "–";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("fi-FI", { dateStyle: "short", timeStyle: "short" });
}

function ChangeLine({ c, action, onAction }: { c: Change; action: string | null; onAction: () => void }) {
  return (
    <li>
      <strong>
        {c.slug ? (
          <a href={`/fi/sali/${c.slug}`} target="_blank" rel="noreferrer">
            {c.name}
          </a>
        ) : (
          `${c.name} (ketju)`
        )}
      </strong>{" "}
      · {FIELD_TEXT[c.field] ?? c.field}: <span className="old">{short(c.oldValue)}</span> →{" "}
      <span className="new">{short(c.newValue)}</span>
      {c.reason ? <em> ({c.reason})</em> : null}
      {c.sourceUrl ? (
        <>
          {" "}
          ·{" "}
          <a href={c.sourceUrl} target="_blank" rel="noreferrer">
            lähde
          </a>
        </>
      ) : null}
      {action ? (
        <>
          {" "}
          <button type="button" className="admin-link-btn" onClick={onAction}>
            {action}
          </button>
        </>
      ) : null}
    </li>
  );
}

export default function AdminRefreshPanel({ adminKey }: { adminKey: string }) {
  const [data, setData] = useState<Refresh | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await fetch(`${API}/api/admin/refresh`, { headers: adminKey ? { "x-admin-key": adminKey } : {} });
      setData(res.ok ? ((await res.json()) as Refresh) : null);
    } catch {
      setData(null);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  async function post(path: string) {
    setBusy(true);
    try {
      await fetch(`${API}${path}`, { method: "POST", headers: adminKey ? { "x-admin-key": adminKey } : {} });
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!data) return null;
  if (!data.ready) {
    return (
      <section className="admin-run">
        <h2>Automaattiset päivitykset</h2>
        <p className="admin-muted">Ei vielä käytössä: taulut offers / data_changes / page_health puuttuvat (npm run db:push).</p>
      </section>
    );
  }

  const recent = data.recent ?? [];
  const held = data.held ?? [];
  const chains = data.chains ?? [];
  const broken = data.brokenPages ?? [];
  const offers = data.offers ?? [];
  const visibleRecent = showAll ? recent : recent.filter((c) => c.field !== "membershipsJson").slice(0, 30);

  return (
    <section className="admin-run" aria-busy={busy}>
      <h2>Automaattiset päivitykset</h2>
      <p className="admin-muted">
        Viimeisin ajo: {day(data.lastRun?.startedAt ?? null)}
        {data.lastRun ? ` · ${data.lastRun.scanned} sivua · ${data.lastRun.failCount} ongelmaa` : ""}
      </p>

      <h3>Odottaa hyväksyntää ({held.length})</h3>
      {held.length ? (
        <ul className="admin-changes">
          {held.map((c) => (
            <ChangeLine key={c.id} c={c} action={c.field === "membershipsJson" ? null : "Hyväksy"} onAction={() => void post(`/api/admin/changes/${c.id}/approve`)} />
          ))}
        </ul>
      ) : (
        <p className="admin-muted">Ei mitään hyväksyttävää.</p>
      )}

      <h3>Ketjujen lukijat</h3>
      <div className="admin-chain-grid">
        {chains.map((c) => (
          <div key={c.chainId} className="admin-chain-card">
            <strong>{c.name}</strong>
            <span className={c.broken ? "bad" : "ok"}>
              {c.broken ? `${c.broken} sivua ei luettu` : "kaikki sivut luettu"} · {c.ok} ok
            </span>
          </div>
        ))}
      </div>
      {broken.length ? (
        <ul className="admin-changes">
          {broken.map((p) => (
            <li key={p.url}>
              <strong>{p.gym ?? p.chain}</strong> ·{" "}
              <a href={p.url} target="_blank" rel="noreferrer">
                {p.url}
              </a>{" "}
              · {p.detail ?? "ei luettu"} · viimeksi ok {day(p.lastOkAt)}
            </li>
          ))}
        </ul>
      ) : null}

      <h3>Muutokset (7 pv, {recent.length})</h3>
      {recent.length ? (
        <>
          <ul className="admin-changes">
            {visibleRecent.map((c) => (
              <ChangeLine
                key={c.id}
                c={c}
                action={c.status === "applied" || c.status === "approved" ? "Peru" : null}
                onAction={() => void post(`/api/admin/changes/${c.id}/undo`)}
              />
            ))}
          </ul>
          <button type="button" className="admin-link-btn" onClick={() => setShowAll((s) => !s)}>
            {showAll ? "Näytä vähemmän" : "Näytä kaikki (myös jäsenyyslistat)"}
          </button>
        </>
      ) : (
        <p className="admin-muted">Ei muutoksia.</p>
      )}

      <h3>Tarjoukset ({offers.filter((o) => o.active).length} näkyvillä)</h3>
      {offers.length ? (
        <ul className="admin-changes">
          {offers.map((o) => (
            <li key={o.id} className={o.active ? "" : "admin-muted"}>
              <strong>{o.gym ?? `${o.chain} (koko ketju)`}</strong> · {o.title}
              {o.text !== o.title ? ` – ${o.text}` : ""}
              {o.validUntil ? ` · ${o.validUntil} asti` : ""} ·{" "}
              <a href={o.sourceUrl} target="_blank" rel="noreferrer">
                lähde
              </a>{" "}
              · nähty {day(o.lastSeenAt)}{" "}
              <button
                type="button"
                className="admin-link-btn"
                onClick={() => void post(`/api/admin/offers/${o.id}/${o.hiddenAt ? "show" : "hide"}`)}
              >
                {o.hiddenAt ? "Näytä" : "Piilota"}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-muted">Ei tarjouksia.</p>
      )}
    </section>
  );
}
