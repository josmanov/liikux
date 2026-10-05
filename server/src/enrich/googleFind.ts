import { fetchPage } from "./fetchPage.js";

const SKIP =
  /facebook|instagram|youtube|tiktok|twitter|linkedin|google\.|maps\.|apple\.com|yelp|tripadvisor/i;

export async function googleCandidateUrls(query: string, max = 4): Promise<string[]> {
  const q = encodeURIComponent(query);
  const urls: string[] = [];

  const ddg = await fetchPage(`https://html.duckduckgo.com/html/?q=${q}`, 12000);
  if (ddg?.html) {
    const re = /uddg=([^&"]+)/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(ddg.html)) && urls.length < max) {
      try {
        const u = decodeURIComponent(m[1] ?? "");
        if (!/^https?:\/\//i.test(u)) continue;
        if (SKIP.test(u)) continue;
        if (!urls.includes(u)) urls.push(u);
      } catch {
        /* ignore */
      }
    }
  }

  if (urls.length < max) {
    const bing = await fetchPage(`https://www.bing.com/search?q=${q}`, 12000);
    if (bing?.html) {
      const re = /<a[^>]+href="(https?:\/\/[^"]+)"/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(bing.html)) && urls.length < max) {
        const u = m[1] ?? "";
        if (SKIP.test(u)) continue;
        if (/bing\.com|microsoft\.com|msn\.com/i.test(u)) continue;
        if (!urls.includes(u)) urls.push(u);
      }
    }
  }

  return urls;
}

export function buildSearchQuery(gymName: string, city: string, need: "both" | "price" | "hours") {
  const focus =
    need === "price"
      ? "hinnasto OR jäsenyys OR hinta"
      : need === "hours"
        ? "aukioloajat OR avoinna OR 24/7"
        : "hinnasto OR aukioloajat OR jäsenyys";
  return `${gymName} ${city} (${focus})`;
}
