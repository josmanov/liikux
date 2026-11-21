import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Check, ChevronRight, ExternalLink, RotateCcw, Search, TriangleAlert, X } from "lucide-react";
import { API } from "../data/apiBase";
import "./AdminReviewPage.css";

/**
 * /admin/tarkistus – review new data before it goes on the site.
 *
 * Layout (desktop): tabs on top; under "Muutokset" a list of gyms/chains on the
 * left and the selected one on the right, with the current and new values side
 * by side and the buttons at the bottom. Keyboard: A approve, R reject,
 * J / ↓ next, K / ↑ previous. On phones the list and the detail take turns.
 *
 * The daily refresh (server/src/refresh-data.ts) only collects. Nothing goes on
 * the site before it is approved here; approved values can be undone.
 */

type Change = {
  id: string;
  entityType: "chain" | "gym";
  entityId: string;
  name: string;
  city: string | null;
  chain: string | null;
  slug: string | null;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  sourceUrl: string | null;
  status: string;
  reason: string | null;
  changedAt: string;
};

type Offer = {
  id: string;
  chain: string;
  gym: string | null;
  title: string;
  text: string;
  validUntil: string | null;
  sourceUrl: string;
  lastSeenAt: string;
  active: boolean;
};

type Data = {
  ready: boolean;
  lastRun?: { startedAt: string; scanned: number; failCount: number } | null;
  waiting?: Change[];
  recent?: Change[];
  brokenPages?: { url: string; chain: string; gym: string | null; detail: string | null }[];
  offersWaiting?: Offer[];
  offersLive?: Offer[];
};

type Group = { key: string; items: Change[]; first: Change; warn: boolean };
type Tab = "changes" | "offers" | "problems" | "history";

const KEY_STORAGE = "liikux-admin-key";

const FIELD: Record<string, string> = {
  priceFrom: "Hinta alkaen",
  hoursWeekday: "Aukiolo arkisin",
  hoursWeekend: "Aukiolo viikonloppuna",
  is247: "24/7",
  dayPass: "Kertakäynti",
  freeTrial: "Ilmainen kokeilu",
  membershipsJson: "Jäsenyydet",
};

const FIELD_SHORT: Record<string, string> = {
  priceFrom: "Hinta",
  hoursWeekday: "Aukiolo",
  hoursWeekend: "Aukiolo",
  is247: "24/7",
  dayPass: "Kertakäynti",
  freeTrial: "Kokeilu",
  membershipsJson: "Jäsenyydet",
};

function readKey() {
  try {
    return sessionStorage.getItem(KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

function when(iso: string | null | undefined) {
  if (!iso) return "–";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("fi-FI", { dateStyle: "short", timeStyle: "short" });
}

function show(field: string, value: string | null) {
  if (value == null || value === "") return null;
  if (field === "priceFrom") return `${value.replace(".", ",")} €/kk`;
  if (value === "true") return "Kyllä";
  if (value === "false") return "Ei";
  return value;
}

type Membership = { name: string; priceEur: number; note?: string };

function parseList(value: string | null): Membership[] {
  try {
    const list = JSON.parse(value ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const eur = (n: number) => `${String(n).replace(".", ",")} €`;

/** Membership list: one table, current on the left, new on the right. */
function MembershipTable({ oldValue, newValue }: { oldValue: string | null; newValue: string | null }) {
  const before = parseList(oldValue);
  const after = parseList(newValue);
  const rows = Math.max(before.length, after.length);
  const afterPrices = new Set(after.map((m) => `${m.name}|${m.priceEur}`));
  const beforePrices = new Set(before.map((m) => `${m.name}|${m.priceEur}`));
  return (
    <table className="rv-mtable">
      <tbody>
        {Array.from({ length: rows }, (_, i) => {
          const b = before[i];
          const a = after[i];
          return (
            <tr key={i}>
              <td className={b && !afterPrices.has(`${b.name}|${b.priceEur}`) ? "is-old" : ""}>
                {b ? (
                  <>
                    <span>{b.name}</span>
                    <b>{eur(b.priceEur)}</b>
                  </>
                ) : null}
              </td>
              <td className={a && !beforePrices.has(`${a.name}|${a.priceEur}`) ? "is-new" : ""}>
                {a ? (
                  <>
                    <span>
                      {a.name}
                      {a.note ? <em>{a.note}</em> : null}
                    </span>
                    <b>{eur(a.priceEur)}</b>
                  </>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function AdminReviewPage() {
  const [key, setKey] = useState(readKey);
  const [draft, setDraft] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("changes");
  const [chain, setChain] = useState("");
  const [q, setQ] = useState("");
  const [onlyWarn, setOnlyWarn] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const [pickedOffers, setPickedOffers] = useState<Set<string>>(new Set());

  const load = useCallback(
    async (k = key) => {
      try {
        const res = await fetch(`${API}/api/admin/refresh`, { headers: k ? { "x-admin-key": k } : {} });
        if (res.status === 403 || res.status === 429) {
          setForbidden(true);
          setData(null);
          return;
        }
        setForbidden(false);
        setData((await res.json()) as Data);
      } catch {
        setData(null);
      }
    },
    [key],
  );

  useEffect(() => {
    void load();
  }, [load]);

  function saveKey(e: FormEvent) {
    e.preventDefault();
    const next = draft.trim();
    if (!next) return;
    try {
      sessionStorage.setItem(KEY_STORAGE, next);
    } catch {
      /* ignore */
    }
    setKey(next);
    setDraft("");
  }

  const post = useCallback(
    async (path: string, body?: unknown) => {
      setBusy(true);
      try {
        await fetch(`${API}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json", ...(key ? { "x-admin-key": key } : {}) },
          body: body ? JSON.stringify(body) : undefined,
        });
        await load();
      } finally {
        setBusy(false);
      }
    },
    [key, load],
  );

  // ---- changes, grouped per gym / chain ----
  const waiting = useMemo(() => data?.waiting ?? [], [data]);
  const groupsAll: Group[] = useMemo(() => {
    const map = new Map<string, Change[]>();
    for (const c of waiting) {
      const k = `${c.entityType}|${c.entityId}`;
      map.set(k, [...(map.get(k) ?? []), c]);
    }
    return [...map.entries()].map(([k, items]) => ({ key: k, items, first: items[0]!, warn: items.some((i) => i.reason && !/odottaa/.test(i.reason)) }));
  }, [waiting]);

  const chainCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of groupsAll) {
      const c = g.first.entityType === "chain" ? "Ketjut" : g.first.chain ?? "Muut";
      m.set(c, (m.get(c) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "fi"));
  }, [groupsAll]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groupsAll.filter((g) => {
      const c = g.first.entityType === "chain" ? "Ketjut" : g.first.chain ?? "Muut";
      if (chain && c !== chain) return false;
      if (onlyWarn && !g.warn) return false;
      if (needle && !`${g.first.name} ${g.first.city ?? ""} ${g.first.chain ?? ""}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [groupsAll, chain, q, onlyWarn]);

  const current = groups.find((g) => g.key === selected) ?? groups[0] ?? null;
  const index = current ? groups.indexOf(current) : -1;

  const go = useCallback(
    (step: number) => {
      if (!groups.length) return;
      const next = groups[Math.min(groups.length - 1, Math.max(0, index + step))];
      if (next) setSelected(next.key);
    },
    [groups, index],
  );

  const decide = useCallback(
    async (ids: string[], action: "approve" | "reject") => {
      // Select the next card before the list reloads, so the flow continues.
      const after = groups[index + 1] ?? groups[index - 1];
      await post(`/api/admin/changes/${action}`, { ids });
      setSelected(after?.key ?? null);
    },
    [groups, index, post],
  );

  // Keyboard: A approve all, R reject all, J/↓ next, K/↑ previous.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (tab !== "changes" || busy || !current) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA")) return;
      const ids = current.items.map((c) => c.id);
      if (e.key === "a" || e.key === "A") void decide(ids, "approve");
      else if (e.key === "r" || e.key === "R") void decide(ids, "reject");
      else if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        go(1);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        go(-1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tab, busy, current, decide, go]);

  // ---------- states before the data ----------
  if (forbidden || (!data && !key)) {
    return (
      <main className="rv rv-gate">
        <div className="rv-gate-card">
          <h1>Tietojen tarkistus</h1>
          <p className="rv-muted">Anna admin-avain jatkaaksesi.</p>
          <form className="rv-key" onSubmit={saveKey}>
            <input type="password" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Admin-avain" aria-label="Admin-avain" autoFocus />
            <button type="submit" className="btn btn-primary">
              Avaa
            </button>
          </form>
          {forbidden && key ? <p className="rv-error">Avain on väärä, tai liian monta yritystä (odota 15 min).</p> : null}
        </div>
      </main>
    );
  }
  if (!data) return <main className="rv"><p className="rv-muted">Ladataan…</p></main>;
  if (!data.ready) {
    return (
      <main className="rv">
        <h1 className="rv-title">Tietojen tarkistus</h1>
        <p className="rv-muted">Tietokannan taulut puuttuvat. Aja ensin <code>npm run db:push --prefix server</code>.</p>
      </main>
    );
  }

  const offersWaiting = data.offersWaiting ?? [];
  const broken = data.brokenPages ?? [];
  const recent = data.recent ?? [];
  const tabs: [Tab, string, number][] = [
    ["changes", "Muutokset", groupsAll.length],
    ["offers", "Tarjoukset", offersWaiting.length],
    ["problems", "Ei luettu", broken.length],
    ["history", "Historia", recent.length],
  ];

  return (
    <main className="rv" aria-busy={busy}>
      <header className="rv-top">
        <div>
          <h1 className="rv-title">Tietojen tarkistus</h1>
          <p className="rv-muted">
            Mikään ei mene sivulle ennen hyväksyntää · viimeisin haku {when(data.lastRun?.startedAt)}
          </p>
        </div>
        <Link className="rv-toplink" to="/admin/data">
          Kaikki salit <ChevronRight size={15} strokeWidth={2.4} />
        </Link>
      </header>

      <nav className="rv-tabs" aria-label="Näkymät">
        {tabs.map(([id, label, n]) => (
          <button key={id} type="button" className={tab === id ? "is-on" : ""} onClick={() => setTab(id)}>
            {label}
            <span className={id === "problems" && n > 0 ? "rv-count is-bad" : "rv-count"}>{n}</span>
          </button>
        ))}
      </nav>

      {/* ================= Changes: list + detail ================= */}
      {tab === "changes" ? (
        <div className={mobileDetail ? "rv-split is-detail" : "rv-split"}>
          <aside className="rv-list">
            <div className="rv-list-tools">
              <label className="rv-search">
                <Search size={15} strokeWidth={2.3} aria-hidden="true" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Hae salia tai ketjua" aria-label="Hae" />
              </label>
              <div className="rv-filter-row">
                <select value={chain} onChange={(e) => setChain(e.target.value)} aria-label="Ketju">
                  <option value="">Kaikki ketjut ({groupsAll.length})</option>
                  {chainCounts.map(([c, n]) => (
                    <option key={c} value={c}>
                      {c} ({n})
                    </option>
                  ))}
                </select>
                <label className="rv-check">
                  <input type="checkbox" checked={onlyWarn} onChange={(e) => setOnlyWarn(e.target.checked)} />
                  Vain varoitukset
                </label>
              </div>
            </div>

            <ul className="rv-items">
              {groups.map((g) => (
                <li key={g.key}>
                  <button
                    type="button"
                    className={current?.key === g.key ? "rv-item is-on" : "rv-item"}
                    onClick={() => {
                      setSelected(g.key);
                      setMobileDetail(true);
                    }}
                  >
                    <span className="rv-item-top">
                      <span className="rv-item-name">{g.first.name}</span>
                      {g.warn ? <TriangleAlert className="rv-item-warn" size={14} strokeWidth={2.4} aria-label="Varoitus" /> : null}
                    </span>
                    <span className="rv-item-sub">
                      {g.first.entityType === "chain" ? "Koko ketju" : [g.first.chain, g.first.city].filter(Boolean).join(" · ")}
                    </span>
                    <span className="rv-item-tags">
                      {[...new Set(g.items.map((i) => FIELD_SHORT[i.field] ?? i.field))].map((f) => (
                        <span key={f}>{f}</span>
                      ))}
                    </span>
                  </button>
                </li>
              ))}
              {groups.length === 0 ? <li className="rv-none">{groupsAll.length ? "Ei osumia." : "Kaikki tarkistettu. 👍"}</li> : null}
            </ul>

            {groups.length > 1 ? (
              <div className="rv-list-foot">
                <span>{groups.length} näkyvissä</span>
                <button type="button" className="rv-btn is-ghost" disabled={busy} onClick={() => void post("/api/admin/changes/reject", { ids: groups.flatMap((g) => g.items.map((c) => c.id)) })}>
                  Hylkää kaikki
                </button>
                <button type="button" className="rv-btn is-ok" disabled={busy} onClick={() => void post("/api/admin/changes/approve", { ids: groups.flatMap((g) => g.items.map((c) => c.id)) })}>
                  Hyväksy kaikki
                </button>
              </div>
            ) : null}
          </aside>

          <section className="rv-detail">
            {current ? (
              <>
                <header className="rv-detail-head">
                  <button type="button" className="rv-back" onClick={() => setMobileDetail(false)}>
                    <ArrowLeft size={16} strokeWidth={2.4} /> Lista
                  </button>
                  <div className="rv-detail-title">
                    <span className="rv-eyebrow">{current.first.entityType === "chain" ? "Koko ketju" : current.first.chain}</span>
                    <h2>{current.first.name}</h2>
                    <p className="rv-muted">
                      {current.first.city ? `${current.first.city} · ` : ""}löydetty {when(current.first.changedAt)}
                    </p>
                  </div>
                  <div className="rv-detail-links">
                    {current.first.sourceUrl ? (
                      <a className="rv-btn is-ghost" href={current.first.sourceUrl} target="_blank" rel="noreferrer">
                        Lähde <ExternalLink size={14} strokeWidth={2.4} />
                      </a>
                    ) : null}
                    {current.first.slug ? (
                      <a className="rv-btn is-ghost" href={`/fi/sali/${current.first.slug}`} target="_blank" rel="noreferrer">
                        Salin sivu <ExternalLink size={14} strokeWidth={2.4} />
                      </a>
                    ) : null}
                  </div>
                </header>

                <div className="rv-table" role="table">
                  <div className="rv-tr rv-th" role="row">
                    <span role="columnheader">Tieto</span>
                    <span role="columnheader">Nyt sivulla</span>
                    <span role="columnheader">Uusi</span>
                    <span role="columnheader" aria-label="Toiminnot" />
                  </div>
                  {current.items.map((c) =>
                    c.field === "membershipsJson" ? (
                      <div key={c.id} className="rv-tr is-wide" role="row">
                        <span className="rv-td-field" role="cell">
                          {FIELD[c.field]}
                          {c.reason ? <small className="rv-note">{c.reason}</small> : null}
                        </span>
                        <span className="rv-td-span" role="cell">
                          <MembershipTable oldValue={c.oldValue} newValue={c.newValue} />
                        </span>
                        <span className="rv-td-actions" role="cell">
                          <button type="button" className="rv-icon is-ok" title="Hyväksy" aria-label="Hyväksy" disabled={busy} onClick={() => void post("/api/admin/changes/approve", { ids: [c.id] })}>
                            <Check size={16} strokeWidth={2.8} />
                          </button>
                          <button type="button" className="rv-icon" title="Hylkää" aria-label="Hylkää" disabled={busy} onClick={() => void post("/api/admin/changes/reject", { ids: [c.id] })}>
                            <X size={16} strokeWidth={2.8} />
                          </button>
                        </span>
                      </div>
                    ) : (
                      <div key={c.id} className="rv-tr" role="row">
                        <span className="rv-td-field" role="cell">
                          {FIELD[c.field] ?? c.field}
                          {c.reason ? (
                            <small className="rv-warn">
                              <TriangleAlert size={12} strokeWidth={2.4} /> {c.reason}
                            </small>
                          ) : null}
                        </span>
                        <span className="rv-td-old" role="cell">
                          {show(c.field, c.oldValue) ?? <i>ei tietoa</i>}
                        </span>
                        <span className="rv-td-new" role="cell">
                          {show(c.field, c.newValue)}
                        </span>
                        <span className="rv-td-actions" role="cell">
                          <button type="button" className="rv-icon is-ok" title="Hyväksy" aria-label="Hyväksy" disabled={busy} onClick={() => void post("/api/admin/changes/approve", { ids: [c.id] })}>
                            <Check size={16} strokeWidth={2.8} />
                          </button>
                          <button type="button" className="rv-icon" title="Hylkää" aria-label="Hylkää" disabled={busy} onClick={() => void post("/api/admin/changes/reject", { ids: [c.id] })}>
                            <X size={16} strokeWidth={2.8} />
                          </button>
                        </span>
                      </div>
                    ),
                  )}
                </div>

                <footer className="rv-actions">
                  <span className="rv-muted rv-keys">
                    {index + 1} / {groups.length} · <kbd>A</kbd> hyväksy · <kbd>R</kbd> hylkää · <kbd>J</kbd>/<kbd>K</kbd> seuraava/edellinen
                  </span>
                  <div className="rv-actions-btns">
                    <button type="button" className="rv-btn is-ghost" disabled={busy || index <= 0} onClick={() => go(-1)}>
                      Edellinen
                    </button>
                    <button type="button" className="rv-btn is-bad" disabled={busy} onClick={() => void decide(current.items.map((c) => c.id), "reject")}>
                      <X size={15} strokeWidth={2.8} /> Hylkää
                    </button>
                    <button type="button" className="rv-btn is-ok is-big" disabled={busy} onClick={() => void decide(current.items.map((c) => c.id), "approve")}>
                      <Check size={15} strokeWidth={2.8} /> Hyväksy{current.items.length > 1 ? ` (${current.items.length})` : ""}
                    </button>
                  </div>
                </footer>
              </>
            ) : (
              <div className="rv-empty">
                <Check size={28} strokeWidth={2.4} />
                <p>Ei mitään tarkistettavaa.</p>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {/* ================= Offers ================= */}
      {tab === "offers" ? (
        <section className="rv-panel">
          <div className="rv-panel-head">
            <p className="rv-muted">Hyväksytty tarjous näkyy salin sivulla, kunnes se poistuu ketjun sivulta tai vanhenee. Hylätty ei tule takaisin.</p>
            {pickedOffers.size ? (
              <div className="rv-actions-btns">
                <button type="button" className="rv-btn is-bad" disabled={busy} onClick={async () => { for (const id of pickedOffers) await post(`/api/admin/offers/${id}/reject`); setPickedOffers(new Set()); }}>
                  Hylkää valitut ({pickedOffers.size})
                </button>
                <button type="button" className="rv-btn is-ok" disabled={busy} onClick={async () => { for (const id of pickedOffers) await post(`/api/admin/offers/${id}/approve`); setPickedOffers(new Set()); }}>
                  Näytä valitut ({pickedOffers.size})
                </button>
              </div>
            ) : null}
          </div>
          {offersWaiting.length ? (
            <table className="rv-grid">
              <thead>
                <tr>
                  <th className="rv-col-check">
                    <input
                      type="checkbox"
                      aria-label="Valitse kaikki"
                      checked={pickedOffers.size === offersWaiting.length}
                      onChange={(e) => setPickedOffers(e.target.checked ? new Set(offersWaiting.map((o) => o.id)) : new Set())}
                    />
                  </th>
                  <th>Missä</th>
                  <th>Tarjous</th>
                  <th>Voimassa</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {offersWaiting.map((o) => (
                  <tr key={o.id}>
                    <td className="rv-col-check">
                      <input
                        type="checkbox"
                        aria-label="Valitse"
                        checked={pickedOffers.has(o.id)}
                        onChange={(e) => {
                          const next = new Set(pickedOffers);
                          if (e.target.checked) next.add(o.id);
                          else next.delete(o.id);
                          setPickedOffers(next);
                        }}
                      />
                    </td>
                    <td>
                      <strong>{o.chain}</strong>
                      <div className="rv-muted">{o.gym ?? "koko ketju"}</div>
                    </td>
                    <td>
                      <strong>{o.title}</strong>
                      {o.text !== o.title ? <div className="rv-muted">{o.text}</div> : null}
                      <a className="rv-inline-link" href={o.sourceUrl} target="_blank" rel="noreferrer">
                        Lähde <ExternalLink size={12} strokeWidth={2.4} />
                      </a>
                    </td>
                    <td className="rv-nowrap">{o.validUntil ?? "–"}</td>
                    <td className="rv-td-actions">
                      <button type="button" className="rv-icon is-ok" title="Näytä sivulla" aria-label="Näytä sivulla" disabled={busy} onClick={() => void post(`/api/admin/offers/${o.id}/approve`)}>
                        <Check size={16} strokeWidth={2.8} />
                      </button>
                      <button type="button" className="rv-icon" title="Hylkää" aria-label="Hylkää" disabled={busy} onClick={() => void post(`/api/admin/offers/${o.id}/reject`)}>
                        <X size={16} strokeWidth={2.8} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="rv-empty"><p>Ei uusia tarjouksia.</p></div>
          )}

          {(data.offersLive ?? []).length ? (
            <>
              <h3 className="rv-subh">Sivulla nyt</h3>
              <table className="rv-grid">
                <tbody>
                  {(data.offersLive ?? []).map((o) => (
                    <tr key={o.id}>
                      <td>
                        <strong>{o.chain}</strong>
                        <div className="rv-muted">{o.gym ?? "koko ketju"}</div>
                      </td>
                      <td>{o.title}</td>
                      <td className="rv-nowrap">{o.active ? "näkyy" : "ei näy (vanhentunut)"}</td>
                      <td className="rv-td-actions">
                        <button type="button" className="rv-btn is-ghost" disabled={busy} onClick={() => void post(`/api/admin/offers/${o.id}/hide`)}>
                          Piilota
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : null}
        </section>
      ) : null}

      {/* ================= Pages not read ================= */}
      {tab === "problems" ? (
        <section className="rv-panel">
          <p className="rv-muted">Näiltä sivuilta robotti ei saanut hintaa tai aukioloa. Jos koko ketju on listalla, ketju on uudistanut sivunsa: pyydä Claudea korjaamaan sen lukija.</p>
          {broken.length ? (
            <table className="rv-grid">
              <thead>
                <tr>
                  <th>Ketju</th>
                  <th>Sali</th>
                  <th>Syy</th>
                  <th>Sivu</th>
                </tr>
              </thead>
              <tbody>
                {broken.map((p) => (
                  <tr key={p.url}>
                    <td><strong>{p.chain}</strong></td>
                    <td>{p.gym ?? "–"}</td>
                    <td>{p.detail ?? "ei luettu"}</td>
                    <td>
                      <a className="rv-inline-link" href={p.url} target="_blank" rel="noreferrer">
                        Avaa <ExternalLink size={12} strokeWidth={2.4} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="rv-empty"><p>Kaikki sivut luettiin.</p></div>
          )}
        </section>
      ) : null}

      {/* ================= History ================= */}
      {tab === "history" ? (
        <section className="rv-panel">
          <p className="rv-muted">Viimeisen 7 päivän päätökset. Hyväksytyn voi perua.</p>
          {recent.length ? (
            <table className="rv-grid">
              <thead>
                <tr>
                  <th>Päätös</th>
                  <th>Sali / ketju</th>
                  <th>Tieto</th>
                  <th>Muutos</th>
                  <th>Aika</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <span className={`rv-badge is-${c.status}`}>{c.status === "approved" ? "Hyväksytty" : c.status === "rejected" ? "Hylätty" : "Peruttu"}</span>
                    </td>
                    <td>
                      <strong>{c.name}</strong>
                      <div className="rv-muted">{c.chain ?? ""}</div>
                    </td>
                    <td>{FIELD[c.field] ?? c.field}</td>
                    <td>{c.field === "membershipsJson" ? "lista" : `${show(c.field, c.oldValue) ?? "–"} → ${show(c.field, c.newValue) ?? "–"}`}</td>
                    <td className="rv-nowrap">{when(c.changedAt)}</td>
                    <td className="rv-td-actions">
                      {c.status === "approved" ? (
                        <button type="button" className="rv-btn is-ghost" disabled={busy} onClick={() => void post(`/api/admin/changes/${c.id}/undo`)}>
                          <RotateCcw size={13} strokeWidth={2.6} /> Peru
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="rv-empty"><p>Ei vielä päätöksiä.</p></div>
          )}
        </section>
      ) : null}
    </main>
  );
}
