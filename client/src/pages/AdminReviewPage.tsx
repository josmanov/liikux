import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Check, ExternalLink, RotateCcw, TriangleAlert, X } from "lucide-react";
import { API } from "../data/apiBase";
import "./AdminReviewPage.css";

/**
 * /admin/tarkistus – review new data before it goes on the site.
 *
 * The daily refresh (server/src/refresh-data.ts) only collects. Every new
 * price, opening time, membership list and offer waits here until you approve
 * it. Rejected values stay as they were. Approved values can be undone.
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
  chains?: { chainId: string; name: string; ok: number; broken: number }[];
  brokenPages?: { url: string; chain: string; gym: string | null; detail: string | null }[];
  offersWaiting?: Offer[];
  offersLive?: Offer[];
};

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
  if (value == null || value === "") return "–";
  if (field === "priceFrom") return `${value.replace(".", ",")} €`;
  if (value === "true") return "kyllä";
  if (value === "false") return "ei";
  return value;
}

type Membership = { name: string; priceEur: number; note?: string };

function memberships(value: string | null): Membership[] {
  try {
    const list = JSON.parse(value ?? "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Old and new membership lists side by side; lines that changed are marked. */
function MembershipDiff({ oldValue, newValue }: { oldValue: string | null; newValue: string | null }) {
  const before = memberships(oldValue);
  const after = memberships(newValue);
  const line = (m: Membership) => `${m.name} ${String(m.priceEur).replace(".", ",")} €`;
  const beforeSet = new Set(before.map(line));
  const afterSet = new Set(after.map(line));
  return (
    <div className="rv-lists">
      <div>
        <span className="rv-lists-h">Nyt sivulla</span>
        {before.length ? (
          <ul>
            {before.map((m) => (
              <li key={line(m)} className={afterSet.has(line(m)) ? "" : "is-gone"}>
                {line(m)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rv-muted">ei listaa</p>
        )}
      </div>
      <div>
        <span className="rv-lists-h">Uusi</span>
        <ul>
          {after.map((m) => (
            <li key={line(m)} className={beforeSet.has(line(m)) ? "" : "is-new"}>
              {line(m)}
              {m.note ? <em> · {m.note}</em> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function AdminReviewPage() {
  const [key, setKey] = useState(readKey);
  const [draft, setDraft] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [busy, setBusy] = useState(false);
  const [chainFilter, setChainFilter] = useState("");

  async function load(k = key) {
    try {
      const res = await fetch(`${API}/api/admin/refresh`, { headers: k ? { "x-admin-key": k } : {} });
      if (res.status === 403) {
        setForbidden(true);
        setData(null);
        return;
      }
      setForbidden(false);
      setData((await res.json()) as Data);
    } catch {
      setData(null);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    void load(next);
  }

  async function post(path: string, body?: unknown) {
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
  }
  const decide = (ids: string[], action: "approve" | "reject") => post(`/api/admin/changes/${action}`, { ids });

  const waiting = useMemo(() => data?.waiting ?? [], [data]);
  const chainsInQueue = useMemo(() => [...new Set(waiting.map((c) => c.chain ?? "Muut"))].sort((a, b) => a.localeCompare(b, "fi")), [waiting]);
  const shown = chainFilter ? waiting.filter((c) => (c.chain ?? "Muut") === chainFilter) : waiting;

  // One card per gym or chain, in the order they came in.
  const groups = useMemo(() => {
    const map = new Map<string, Change[]>();
    for (const c of shown) {
      const k = `${c.entityType}|${c.entityId}`;
      map.set(k, [...(map.get(k) ?? []), c]);
    }
    return [...map.values()];
  }, [shown]);

  if (forbidden || (!data && !key)) {
    return (
      <main className="rv">
        <h1 className="rv-title">Tietojen tarkistus</h1>
        <form className="rv-key" onSubmit={saveKey}>
          <input type="password" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Admin-avain" aria-label="Admin-avain" />
          <button type="submit" className="btn btn-primary">
            Avaa
          </button>
        </form>
        {forbidden ? <p className="rv-error">Avain puuttuu tai on väärä.</p> : null}
      </main>
    );
  }

  if (!data) return <main className="rv"><p className="rv-muted">Ladataan…</p></main>;

  if (!data.ready) {
    return (
      <main className="rv">
        <h1 className="rv-title">Tietojen tarkistus</h1>
        <p className="rv-muted">Ei vielä käytössä: tietokannan taulut puuttuvat. Aja ensin <code>npm run db:push --prefix server</code>.</p>
      </main>
    );
  }

  const offersWaiting = data.offersWaiting ?? [];

  return (
    <main className="rv" aria-busy={busy}>
      <header className="rv-head">
        <div>
          <h1 className="rv-title">Tietojen tarkistus</h1>
          <p className="rv-muted">
            Robotti kerää uudet tiedot joka aamu. Mikään ei mene sivulle ennen kuin hyväksyt sen. Viimeisin haku: {when(data.lastRun?.startedAt)}
          </p>
        </div>
        <Link className="rv-link" to="/admin/data">
          Kaikki salit →
        </Link>
      </header>

      <div className="rv-counts">
        <div>
          <strong>{waiting.length}</strong>
          <span>muutosta odottaa</span>
        </div>
        <div>
          <strong>{offersWaiting.length}</strong>
          <span>tarjousta odottaa</span>
        </div>
        <div className={(data.brokenPages?.length ?? 0) > 0 ? "is-bad" : ""}>
          <strong>{data.brokenPages?.length ?? 0}</strong>
          <span>sivua ei saatu luettua</span>
        </div>
      </div>

      {/* ---------- Changes ---------- */}
      <section className="rv-section">
        <div className="rv-section-head">
          <h2>Uudet tiedot</h2>
          {shown.length ? (
            <div className="rv-bulk">
              <button type="button" className="rv-btn is-ok" disabled={busy} onClick={() => void decide(shown.map((c) => c.id), "approve")}>
                <Check size={15} strokeWidth={2.8} /> Hyväksy kaikki ({shown.length})
              </button>
              <button type="button" className="rv-btn" disabled={busy} onClick={() => void decide(shown.map((c) => c.id), "reject")}>
                <X size={15} strokeWidth={2.8} /> Hylkää kaikki
              </button>
            </div>
          ) : null}
        </div>

        {chainsInQueue.length > 1 ? (
          <div className="rv-chips">
            <button type="button" className={chainFilter ? "chip" : "chip is-on"} onClick={() => setChainFilter("")}>
              Kaikki
            </button>
            {chainsInQueue.map((c) => (
              <button key={c} type="button" className={chainFilter === c ? "chip is-on" : "chip"} onClick={() => setChainFilter(c)}>
                {c} · {waiting.filter((w) => (w.chain ?? "Muut") === c).length}
              </button>
            ))}
          </div>
        ) : null}

        {groups.length === 0 ? <p className="rv-empty">Ei mitään tarkistettavaa. 👍</p> : null}

        <div className="rv-cards">
          {groups.map((items) => {
            const first = items[0]!;
            return (
              <article key={`${first.entityType}${first.entityId}`} className="rv-card">
                <header className="rv-card-head">
                  <div>
                    <span className="rv-card-chain">{first.entityType === "chain" ? "Koko ketju" : first.chain}</span>
                    <h3>
                      {first.slug ? (
                        <a href={`/fi/sali/${first.slug}`} target="_blank" rel="noreferrer">
                          {first.name}
                        </a>
                      ) : (
                        first.name
                      )}
                      {first.city ? <span className="rv-muted"> · {first.city}</span> : null}
                    </h3>
                  </div>
                  {first.sourceUrl ? (
                    <a className="rv-source" href={first.sourceUrl} target="_blank" rel="noreferrer">
                      Lähde <ExternalLink size={13} strokeWidth={2.4} />
                    </a>
                  ) : null}
                </header>

                <ul className="rv-rows">
                  {items.map((c) => (
                    <li key={c.id}>
                      <div className="rv-row-main">
                        <span className="rv-field">
                          {FIELD[c.field] ?? c.field}
                          {c.reason ? (
                            <span className="rv-warn">
                              <TriangleAlert size={13} strokeWidth={2.4} /> {c.reason}
                            </span>
                          ) : null}
                        </span>
                        {c.field === "membershipsJson" ? (
                          <MembershipDiff oldValue={c.oldValue} newValue={c.newValue} />
                        ) : (
                          <span className="rv-values">
                            <s>{show(c.field, c.oldValue)}</s> → <b>{show(c.field, c.newValue)}</b>
                          </span>
                        )}
                      </div>
                      <div className="rv-row-actions">
                        <button type="button" className="rv-icon is-ok" aria-label="Hyväksy" title="Hyväksy" disabled={busy} onClick={() => void decide([c.id], "approve")}>
                          <Check size={17} strokeWidth={2.8} />
                        </button>
                        <button type="button" className="rv-icon" aria-label="Hylkää" title="Hylkää" disabled={busy} onClick={() => void decide([c.id], "reject")}>
                          <X size={17} strokeWidth={2.8} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
                {items.length > 1 ? (
                  <div className="rv-card-foot">
                    <button type="button" className="rv-btn is-ok" disabled={busy} onClick={() => void decide(items.map((c) => c.id), "approve")}>
                      <Check size={15} strokeWidth={2.8} /> Hyväksy tämän kaikki ({items.length})
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      {/* ---------- Offers ---------- */}
      <section className="rv-section">
        <div className="rv-section-head">
          <h2>Uudet tarjoukset</h2>
        </div>
        {offersWaiting.length === 0 ? <p className="rv-empty">Ei uusia tarjouksia.</p> : null}
        <div className="rv-cards">
          {offersWaiting.map((o) => (
            <article key={o.id} className="rv-card is-offer">
              <span className="rv-card-chain">{o.gym ? `${o.chain} · ${o.gym}` : `${o.chain} · koko ketju`}</span>
              <h3>{o.title}</h3>
              {o.text !== o.title ? <p>{o.text}</p> : null}
              <p className="rv-muted">
                {o.validUntil ? `Voimassa ${o.validUntil} asti · ` : ""}
                <a href={o.sourceUrl} target="_blank" rel="noreferrer">
                  Lähde <ExternalLink size={12} strokeWidth={2.4} />
                </a>
              </p>
              <div className="rv-card-foot">
                <button type="button" className="rv-btn is-ok" disabled={busy} onClick={() => void post(`/api/admin/offers/${o.id}/approve`)}>
                  <Check size={15} strokeWidth={2.8} /> Näytä sivulla
                </button>
                <button type="button" className="rv-btn" disabled={busy} onClick={() => void post(`/api/admin/offers/${o.id}/reject`)}>
                  <X size={15} strokeWidth={2.8} /> Hylkää
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- Live offers ---------- */}
      {(data.offersLive ?? []).length ? (
        <section className="rv-section">
          <h2>Tarjoukset sivulla nyt</h2>
          <ul className="rv-plain">
            {(data.offersLive ?? []).map((o) => (
              <li key={o.id} className={o.active ? "" : "rv-muted"}>
                <strong>{o.gym ?? `${o.chain} (koko ketju)`}</strong> · {o.title}
                {o.active ? "" : " · ei näy (vanhentunut tai poistui sivulta)"}{" "}
                <button type="button" className="rv-text-btn" disabled={busy} onClick={() => void post(`/api/admin/offers/${o.id}/hide`)}>
                  Piilota
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---------- Broken pages ---------- */}
      {(data.brokenPages ?? []).length ? (
        <section className="rv-section">
          <h2>Sivuja, joita ei saatu luettua</h2>
          <p className="rv-muted">Jos koko ketjun sivut puuttuvat, ketju on uudistanut sivunsa: pyydä Claudea korjaamaan sen lukija.</p>
          <ul className="rv-plain">
            {(data.brokenPages ?? []).map((p) => (
              <li key={p.url}>
                <strong>{p.gym ?? p.chain}</strong> ·{" "}
                <a href={p.url} target="_blank" rel="noreferrer">
                  {p.url}
                </a>{" "}
                · {p.detail ?? "ei luettu"}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ---------- History ---------- */}
      {(data.recent ?? []).length ? (
        <section className="rv-section">
          <h2>Tehdyt päätökset (7 pv)</h2>
          <ul className="rv-plain">
            {(data.recent ?? []).map((c) => (
              <li key={c.id}>
                <span className={`rv-badge is-${c.status}`}>{c.status === "approved" ? "hyväksytty" : c.status === "rejected" ? "hylätty" : "peruttu"}</span>{" "}
                <strong>{c.name}</strong> · {FIELD[c.field] ?? c.field}
                {c.field !== "membershipsJson" ? `: ${show(c.field, c.oldValue)} → ${show(c.field, c.newValue)}` : ""} · {when(c.changedAt)}{" "}
                {c.status === "approved" ? (
                  <button type="button" className="rv-text-btn" disabled={busy} onClick={() => void post(`/api/admin/changes/${c.id}/undo`)}>
                    <RotateCcw size={12} strokeWidth={2.6} /> Peru
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
