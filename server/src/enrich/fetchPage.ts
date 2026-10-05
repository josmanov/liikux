export type FetchedPage = {
  url: string;
  finalUrl: string;
  status: number;
  html: string;
};

export async function fetchPage(
  url: string,
  timeoutMs = 15000,
): Promise<FetchedPage | null> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Liikux-enrich",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "fi,en;q=0.8",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const type = res.headers.get("content-type") || "";
    if (!res.ok) {
      return { url, finalUrl: res.url || url, status: res.status, html: "" };
    }
    if (type && !/html|xml|text/i.test(type)) {
      return { url, finalUrl: res.url || url, status: res.status, html: "" };
    }
    const html = await res.text();
    return { url, finalUrl: res.url || url, status: res.status, html };
  } catch {
    return null;
  }
}

export function htmlToText(html: string) {
  return html
    .replace(/&#128;|&#x80;/gi, "€")
    .replace(/&euro;/gi, "€")
    .replace(
      /<span[^>]*uael-price-table-integer-part[^>]*>\s*(\d+)\s*<\/span>[\s\S]{0,200}?<span[^>]*uael-price-table-fractional-part[^>]*>\s*(\d+)/gi,
      " $1,$2 € ",
    )
    .replace(
      /<span[^>]*uael-price-table-integer-part[^>]*>\s*(\d+)\s*<\/span>/gi,
      " $1 € ",
    )
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h\d|tr|td|th|section|article)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}
