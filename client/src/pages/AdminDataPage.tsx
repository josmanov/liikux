import { useEffect, useMemo, useState, type FormEvent } from "react";
import "./AdminDataPage.css";
import LoadSpin from "../components/LoadSpin";
import { API } from "../data/apiBase";

type Row = {
  id: string;
  slug: string;
  name: string;
  city: string;
  chainId: string;
  chain: string;
  pricingMode: string;
  price: number | null;
  priceSource: "sali" | "ketju" | null;
  hours: string | null;
  hoursSource: "sali" | "ketju" | null;
  www: string | null;
  checkedAt: string | null;
  status: string | null;
  missReason: string | null;
  sourceUrl: string | null;
  method: string | null;
};

type Run = {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  durationSec: number | null;
  scanned: number;
  okCount: number;
  partialCount: number;
  unknownCount: number;
  failCount: number;
  skippedCount: number;
  pricesNew: number;
  pricesChanged: number;
  hoursNew: number;
  hoursChanged: number;
  changesJson: string | null;
};

type Change = {
  gym: string;
  field: "price" | "hours";
  old: string | number | null;
  new: string | number | null;
};

function fmtDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("fi-FI", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ageDays(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return (Date.now() - d) / 86400000;
}

function freshnessClass(has: boolean, iso: string | null) {
  if (!has) return "cell-miss";
  const age = ageDays(iso);
  if (age == null) return "cell-ok";
  if (age <= 7) return "cell-ok";
  if (age <= 30) return "cell-old";
  return "cell-stale";
}

function fmtPrice(p: number | null) {
  if (p == null) return "EI TIEDOSSA";
  const s = Number.isInteger(p) ? String(p) : String(Number(p.toFixed(2)));
  return `${s.replace(".", ",")} €`;
}

type ViewFilter =
  | ""
  | "ok_both"
  | "price_ok"
  | "hours_ok"
  | "miss_price"
  | "miss_hours"
  | "miss_any"
  | "miss_both";

function rowHasPrice(r: Row) {
  return r.price != null;
}

function rowHasHours(r: Row) {
  return Boolean(r.hours);
}

function matchesView(r: Row, view: ViewFilter) {
  const hasP = rowHasPrice(r);
  const hasH = rowHasHours(r);
  if (view === "ok_both") return hasP && hasH;
  if (view === "price_ok") return hasP;
  if (view === "hours_ok") return hasH;
  if (view === "miss_price") return !hasP;
  if (view === "miss_hours") return !hasH;
  if (view === "miss_any") return !hasP || !hasH;
  if (view === "miss_both") return !hasP && !hasH;
  return true;
}

const ADMIN_KEY_STORAGE = "liikux-admin-key";

function readStoredAdminKey() {
  try {
    return sessionStorage.getItem(ADMIN_KEY_STORAGE) ?? "";
  } catch {
    return "";
  }
}

function AdminDataPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [hideMuut, setHideMuut] = useState(true);
  const [view, setView] = useState<ViewFilter>("");
  const [chainFilter, setChainFilter] = useState("");
  const [showChanges, setShowChanges] = useState(false);
  const [adminKey, setAdminKey] = useState(readStoredAdminKey);
  const [keyDraft, setKeyDraft] = useState("");
  const [needsKey, setNeedsKey] = useState(false);

  async function load(key = adminKey) {
    setLoading(true);
    setError(null);
    const headers: HeadersInit = key ? { "x-admin-key": key } : {};
    try {
      const [r, ru] = await Promise.all([
        fetch(`${API}/api/admin/data-status`, { headers }),
        fetch(`${API}/api/admin/enrich-runs`, { headers }),
      ]);
      if (r.status === 403 || ru.status === 403) {
        setNeedsKey(true);
        setError("Admin-avain puuttuu tai on väärä.");
        setRows([]);
        setRuns([]);
        return;
      }
      const [rowData, runData] = await Promise.all([r.json(), ru.json()]);
      setRows(Array.isArray(rowData) ? rowData : []);
      setRuns(Array.isArray(runData) ? runData : []);
      setNeedsKey(false);
    } catch {
      setError("Tietojen haku epäonnistui.");
    } finally {
      setLoading(false);
    }
  }

  function saveKey(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = keyDraft.trim();
    if (!next) return;
    try {
      sessionStorage.setItem(ADMIN_KEY_STORAGE, next);
    } catch {
      /* ignore */
    }
    setAdminKey(next);
    setKeyDraft("");
    setNeedsKey(false);
    void load(next);
  }

  useEffect(() => {
    if (!adminKey) {
      setLoading(false);
      setNeedsKey(true);
      return;
    }
    void load(adminKey);
  }, [adminKey]);

  const chainsList = useMemo(() => {
    const s = new Map<string, string>();
    for (const r of rows) s.set(r.chainId, r.chain);
    return [...s.entries()].sort((a, b) => a[1].localeCompare(b[1], "fi"));
  }, [rows]);

  const filtered = useMemo(() => {
    const v = q.trim().toLowerCase();
    return rows
      .filter((r) => !(hideMuut && r.chainId === "c-other"))
      .filter((r) => !chainFilter || r.chainId === chainFilter)
      .filter((r) => matchesView(r, view))
      .filter(
        (r) =>
          !v ||
          `${r.name} ${r.city} ${r.chain} ${r.missReason ?? ""}`
            .toLowerCase()
            .includes(v),
      )
      .sort((a, b) => a.chain.localeCompare(b.chain, "fi") || a.name.localeCompare(b.name, "fi"));
  }, [rows, q, hideMuut, chainFilter, view]);

  const stats = useMemo(() => {
    const base = rows.filter((r) => !(hideMuut && r.chainId === "c-other"));
    const total = base.length;
    const withPrice = base.filter(rowHasPrice).length;
    const withHours = base.filter(rowHasHours).length;
    const bothOk = base.filter((r) => rowHasPrice(r) && rowHasHours(r)).length;
    const missPrice = total - withPrice;
    const missHours = total - withHours;
    const missAny = base.filter((r) => !rowHasPrice(r) || !rowHasHours(r)).length;
    const missBoth = base.filter((r) => !rowHasPrice(r) && !rowHasHours(r)).length;
    return {
      total,
      withPrice,
      withHours,
      bothOk,
      missPrice,
      missHours,
      missAny,
      missBoth,
    };
  }, [rows, hideMuut]);

  const perChain = useMemo(() => {
    const m = new Map<
      string,
      { chain: string; total: number; price: number; hours: number; both: number }
    >();
    for (const r of rows) {
      if (hideMuut && r.chainId === "c-other") continue;
      const cur = m.get(r.chainId) ?? {
        chain: r.chain,
        total: 0,
        price: 0,
        hours: 0,
        both: 0,
      };
      cur.total++;
      const hasP = rowHasPrice(r);
      const hasH = rowHasHours(r);
      if (hasP) cur.price++;
      if (hasH) cur.hours++;
      if (hasP && hasH) cur.both++;
      m.set(r.chainId, cur);
    }
    return [...m.values()].sort((a, b) => a.chain.localeCompare(b.chain, "fi"));
  }, [rows, hideMuut]);

  const lastRun = runs[0] ?? null;
  const lastChanges: Change[] = useMemo(() => {
    if (!lastRun?.changesJson) return [];
    try {
      return JSON.parse(lastRun.changesJson) as Change[];
    } catch {
      return [];
    }
  }, [lastRun]);

  const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);

  if (needsKey || !adminKey) {
    return (
      <main className="admin-data load-reveal">
        <form className="admin-key-form" onSubmit={saveKey}>
          <h1>Salidata</h1>
          <p className="admin-data-sub">
            Syötä admin-avain. Avain säilyy vain tämän selainistunnon ajan.
          </p>
          <input
            type="password"
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="Admin key"
            autoComplete="current-password"
            aria-label="Admin key"
          />
          <button type="submit" className="admin-btn" disabled={!keyDraft.trim()}>
            Avaa näkymä
          </button>
          {error ? <p className="admin-error">{error}</p> : null}
        </form>
      </main>
    );
  }

  if (loading && rows.length === 0 && !error) {
    return (
      <div className="load-cover">
        <LoadSpin />
      </div>
    );
  }

  return (
    <main className="admin-data load-reveal">
      <div className="admin-data-head">
        <div>
          <h1>Salidata — tilanne</h1>
          <p className="admin-data-sub">
            Lähde: Postgres (live). Vihreä = tiedossa &amp; tarkistettu ≤ 7 pv,
            keltainen = 8–30 pv, oranssi = yli 30 pv, punainen = ei tiedossa.
          </p>
        </div>
        <button
          type="button"
          className="admin-btn"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "Ladataan…" : "Päivitä näkymä"}
        </button>
      </div>

      {error ? <p className="admin-error">{error}</p> : null}

      <section className="admin-stats">
        <button
          type="button"
          className={`admin-stat ${view === "" ? "active" : ""}`}
          onClick={() => setView("")}
        >
          <span className="admin-stat-label">Saleja yhteensä</span>
          <strong>{stats.total}</strong>
        </button>
        <button
          type="button"
          className={`admin-stat ${view === "price_ok" ? "active" : ""}`}
          onClick={() => setView("price_ok")}
        >
          <span className="admin-stat-label">Hinta OK</span>
          <strong className="ok">
            {stats.withPrice}
            <small>
              / {stats.total} ({pct(stats.withPrice, stats.total)} %)
            </small>
          </strong>
        </button>
        <button
          type="button"
          className={`admin-stat ${view === "hours_ok" ? "active" : ""}`}
          onClick={() => setView("hours_ok")}
        >
          <span className="admin-stat-label">Aukiolo OK</span>
          <strong className="ok">
            {stats.withHours}
            <small>
              / {stats.total} ({pct(stats.withHours, stats.total)} %)
            </small>
          </strong>
        </button>
        <button
          type="button"
          className={`admin-stat ${view === "ok_both" ? "active" : ""}`}
          onClick={() => setView("ok_both")}
        >
          <span className="admin-stat-label">Molemmat OK</span>
          <strong className="ok">
            {stats.bothOk}
            <small>
              / {stats.total} ({pct(stats.bothOk, stats.total)} %)
            </small>
          </strong>
        </button>
        <button
          type="button"
          className={`admin-stat miss ${view === "miss_price" ? "active" : ""}`}
          onClick={() => setView("miss_price")}
        >
          <span className="admin-stat-label">Hinta puuttuu</span>
          <strong className="bad">
            {stats.missPrice}
            <small>
              / {stats.total} ({pct(stats.missPrice, stats.total)} %)
            </small>
          </strong>
        </button>
        <button
          type="button"
          className={`admin-stat miss ${view === "miss_hours" ? "active" : ""}`}
          onClick={() => setView("miss_hours")}
        >
          <span className="admin-stat-label">Aukiolo puuttuu</span>
          <strong className="bad">
            {stats.missHours}
            <small>
              / {stats.total} ({pct(stats.missHours, stats.total)} %)
            </small>
          </strong>
        </button>
        <button
          type="button"
          className={`admin-stat miss ${view === "miss_any" ? "active" : ""}`}
          onClick={() => setView("miss_any")}
        >
          <span className="admin-stat-label">Jompikumpi puuttuu</span>
          <strong className="bad">
            {stats.missAny}
            <small>
              / {stats.total} ({pct(stats.missAny, stats.total)} %)
            </small>
          </strong>
        </button>
        <button
          type="button"
          className={`admin-stat miss ${view === "miss_both" ? "active" : ""}`}
          onClick={() => setView("miss_both")}
        >
          <span className="admin-stat-label">Molemmat puuttuu</span>
          <strong className="bad">
            {stats.missBoth}
            <small>
              / {stats.total} ({pct(stats.missBoth, stats.total)} %)
            </small>
          </strong>
        </button>
      </section>
      <p className="admin-hint">Klikkaa lukua → taulukko näyttää vain ne salit.</p>

      <section className="admin-run">
        <h2>Viimeisin päivitysajo</h2>
        {lastRun ? (
          <>
            <div className="admin-run-grid">
              <div>
                <span>Aloitettu</span>
                <strong>{fmtDate(lastRun.startedAt)}</strong>
              </div>
              <div>
                <span>Kesto</span>
                <strong>{lastRun.durationSec != null ? `${lastRun.durationSec} s` : "–"}</strong>
              </div>
              <div>
                <span>Käyty läpi</span>
                <strong>{lastRun.scanned}</strong>
              </div>
              <div>
                <span>OK / osittain</span>
                <strong>
                  {lastRun.okCount} / {lastRun.partialCount}
                </strong>
              </div>
              <div>
                <span>Ei löytynyt / virhe</span>
                <strong>
                  {lastRun.unknownCount} / {lastRun.failCount}
                </strong>
              </div>
              <div>
                <span>Ketjun hinnalla</span>
                <strong>{lastRun.skippedCount}</strong>
              </div>
              <div>
                <span>Hinnat uusia / muuttui</span>
                <strong>
                  {lastRun.pricesNew} / {lastRun.pricesChanged}
                </strong>
              </div>
              <div>
                <span>Aukiolot uusia / muuttui</span>
                <strong>
                  {lastRun.hoursNew} / {lastRun.hoursChanged}
                </strong>
              </div>
            </div>
            {lastChanges.length ? (
              <button
                type="button"
                className="admin-link-btn"
                onClick={() => setShowChanges((s) => !s)}
              >
                {showChanges ? "Piilota muutokset" : `Näytä muutokset (${lastChanges.length})`}
              </button>
            ) : null}
            {showChanges ? (
              <ul className="admin-changes">
                {lastChanges.map((c, i) => (
                  <li key={i}>
                    <strong>{c.gym}</strong> · {c.field === "price" ? "hinta" : "aukiolo"}:{" "}
                    <span className="old">{c.old ?? "–"}</span> → <span className="new">{c.new ?? "–"}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : (
          <p className="admin-muted">Ei vielä yhtään ajoa.</p>
        )}
      </section>

      <section className="admin-perchain">
        <h2>Ketjuittain</h2>
        <div className="admin-chain-grid">
          {perChain.map((c) => (
            <div key={c.chain} className="admin-chain-card">
              <strong>{c.chain}</strong>
              <span className={pct(c.price, c.total) >= 90 ? "ok" : pct(c.price, c.total) >= 60 ? "warn" : "bad"}>
                hinta {c.price}/{c.total} ({pct(c.price, c.total)} %)
              </span>
              <span className={pct(c.hours, c.total) >= 90 ? "ok" : pct(c.hours, c.total) >= 60 ? "warn" : "bad"}>
                aukiolo {c.hours}/{c.total} ({pct(c.hours, c.total)} %)
              </span>
              <span className={pct(c.both, c.total) >= 90 ? "ok" : pct(c.both, c.total) >= 60 ? "warn" : "bad"}>
                molemmat {c.both}/{c.total} ({pct(c.both, c.total)} %)
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-toolbar">
        <input
          type="search"
          placeholder="Hae nimellä, kaupungilla, ketjulla tai syyllä…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select value={chainFilter} onChange={(e) => setChainFilter(e.target.value)}>
          <option value="">Kaikki ketjut</option>
          {chainsList.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select
          value={view}
          onChange={(e) => setView(e.target.value as ViewFilter)}
        >
          <option value="">Kaikki rivit</option>
          <option value="ok_both">OK: hinta + aukiolo</option>
          <option value="price_ok">OK: hinta</option>
          <option value="hours_ok">OK: aukiolo</option>
          <option value="miss_price">Puuttuu: hinta</option>
          <option value="miss_hours">Puuttuu: aukiolo</option>
          <option value="miss_any">Puuttuu: jompikumpi</option>
          <option value="miss_both">Puuttuu: molemmat</option>
        </select>
        <label>
          <input
            type="checkbox"
            checked={hideMuut}
            onChange={(e) => setHideMuut(e.target.checked)}
          />
          Piilota Muut
        </label>
        <span className="admin-muted">{filtered.length} riviä</span>
      </section>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Ketju</th>
              <th>Sali</th>
              <th>Kaupunki</th>
              <th>Hinta</th>
              <th>Aukiolo</th>
              <th>Tarkistettu</th>
              <th>Tila</th>
              <th>Syy jos puuttuu</th>
              <th>Miten poimittu</th>
              <th>Lähde</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.chain}
                  <small className="admin-mode">{r.pricingMode}</small>
                </td>
                <td>
                  <a href={`/fi/sali/${r.slug}`} target="_blank" rel="noreferrer">
                    {r.name}
                  </a>
                </td>
                <td>{r.city}</td>
                <td className={freshnessClass(r.price != null, r.checkedAt)}>
                  {fmtPrice(r.price)}
                  {r.priceSource ? <small>{r.priceSource}</small> : null}
                </td>
                <td className={freshnessClass(Boolean(r.hours), r.checkedAt)}>
                  {r.hours ?? "EI TIEDOSSA"}
                  {r.hoursSource ? <small>{r.hoursSource}</small> : null}
                </td>
                <td className="admin-date">{fmtDate(r.checkedAt) ?? "–"}</td>
                <td>
                  <span className={`admin-status status-${r.status ?? "none"}`}>
                    {r.status ?? "ei ajettu"}
                  </span>
                </td>
                <td className="admin-reason">{r.missReason ?? ""}</td>
                <td>
                  <span className={`admin-status status-${r.method ?? "none"}`}>
                    {r.method ?? "–"}
                  </span>
                </td>
                <td className="admin-links">
                  {r.sourceUrl ? (
                    <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                      lähde
                    </a>
                  ) : null}
                  {r.www ? (
                    <a href={r.www} target="_blank" rel="noreferrer">
                      www
                    </a>
                  ) : (
                    <span className="admin-muted">ei www</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

export default AdminDataPage;
