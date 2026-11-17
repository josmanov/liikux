import { htmlToText } from "../enrich/fetchPage.js";

/**
 * Downloads pages for the daily data check, politely:
 *
 *   1. says who it is (LiikuxBot + a link to the site)
 *   2. obeys the site's robots.txt
 *   3. waits at least one second between requests to the same site
 *   4. downloads each address only once per run
 */

export const BOT_NAME = "LiikuxBot";
const USER_AGENT = `Mozilla/5.0 (compatible; ${BOT_NAME}/1.0; +https://liikux.fi)`;
const GAP_MS = 1000;
const TIMEOUT_MS = 15000;

export type Page =
  | { ok: true; url: string; text: string; html: string; /** address after redirects */ finalUrl: string }
  | { ok: false; url: string; reason: "blocked" | "unreachable"; detail: string };

/** host → the moment the next request to that host may start. */
const nextSlot = new Map<string, number>();

async function waitForTurn(host: string) {
  const now = Date.now();
  const at = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, at + GAP_MS);
  if (at > now) await new Promise((done) => setTimeout(done, at - now));
}

async function get(url: string) {
  await waitForTurn(new URL(url).host);
  return fetch(url, {
    redirect: "follow",
    headers: {
      "user-agent": USER_AGENT,
      accept: "text/html,application/xhtml+xml,text/plain",
      "accept-language": "fi,en;q=0.8",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}

/**
 * Reads the "Disallow:" lines that apply to us from a robots.txt.
 * Rules written for LiikuxBot win over the rules for everyone (*).
 */
export function parseRobots(body: string): string[] {
  const rules: Record<"us" | "all", string[]> = { us: [], all: [] };
  let groups: ("us" | "all")[] = [];
  let readingAgents = false;

  for (const rawLine of body.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();

    if (key === "user-agent") {
      if (!readingAgents) groups = [];
      readingAgents = true;
      const agent = value.toLowerCase();
      if (agent === "*") groups.push("all");
      else if (agent === BOT_NAME.toLowerCase()) groups.push("us");
    } else {
      readingAgents = false;
      if (key === "disallow" && value) {
        for (const g of groups) rules[g].push(value);
      }
    }
  }
  return rules.us.length ? rules.us : rules.all;
}

/** True when a robots.txt rule ("/admin", "/*.pdf$", "/") covers this path. */
export function pathDisallowed(path: string, rules: string[]) {
  return rules.some((rule) => {
    const pattern = rule
      .replace(/[.+?^{}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\\?\$$/, "$");
    try {
      return new RegExp("^" + pattern).test(path);
    } catch {
      return false;
    }
  });
}

const robotsByOrigin = new Map<string, Promise<string[]>>();

function robotsFor(origin: string) {
  let rules = robotsByOrigin.get(origin);
  if (!rules) {
    rules = get(origin + "/robots.txt")
      .then(async (res) => (res.ok ? parseRobots(await res.text()) : []))
      .catch(() => []); // no robots.txt = nothing is forbidden
    robotsByOrigin.set(origin, rules);
  }
  return rules;
}

async function download(url: string): Promise<Page> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, url, reason: "unreachable", detail: "bad address" };
  }
  if (/\.pdf($|\?)/i.test(parsed.pathname)) {
    return { ok: false, url, reason: "unreachable", detail: "pdf (cannot be read)" };
  }

  const rules = await robotsFor(parsed.origin);
  if (pathDisallowed(parsed.pathname + parsed.search, rules)) {
    return { ok: false, url, reason: "blocked", detail: "robots.txt" };
  }

  try {
    const res = await get(url);
    if (!res.ok) {
      return { ok: false, url, reason: "unreachable", detail: `http ${res.status}` };
    }
    const type = res.headers.get("content-type") ?? "";
    if (type && !/html|xml|text|json/i.test(type)) {
      return { ok: false, url, reason: "unreachable", detail: type.slice(0, 40) };
    }
    const html = await res.text();
    return { ok: true, url, html, text: htmlToText(html), finalUrl: res.url || url };
  } catch (e) {
    const detail = e instanceof Error ? e.name : "error";
    return { ok: false, url, reason: "unreachable", detail };
  }
}

const pages = new Map<string, Promise<Page>>();

/** Download a page (or reuse the one already downloaded in this run). */
export function politeFetch(url: string): Promise<Page> {
  let page = pages.get(url);
  if (!page) {
    page = download(url);
    pages.set(url, page);
  }
  return page;
}
