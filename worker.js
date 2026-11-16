import { applyMeta, pageMeta } from "./worker/seo.js";
import { buildSitemap } from "./worker/sitemap.js";

/**
 * The Cloudflare Worker in front of liikux.fi. It does four things:
 *
 *   /api/*        → forwards to the API on Render, with an edge cache
 *   /sitemap.xml  → the list of all pages for Google   (worker/sitemap.js)
 *   /robots.txt   → tells crawlers where the sitemap is
 *   pages         → serves the built React app (client/dist) and fills in
 *                   the title, description and structured data for that
 *                   page before sending it               (worker/seo.js)
 */

const ROBOTS = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/

Sitemap: https://liikux.fi/sitemap.xml
`;

const DEFAULT_API_ORIGIN = "https://liikux.onrender.com";

/**
 * API proxy with edge cache.
 *
 * The browser calls https://liikux.fi/api/... (same domain, no CORS).
 * This worker forwards the call to the Render API, but first checks
 * Cloudflare's cache in the data centre closest to the user (Helsinki for most).
 * Public GET answers are kept for as long as the API's `s-maxage` header says,
 * so most visitors never wait for Render or the database.
 * Admin routes are never cached.
 */
async function proxyApi(request, url, env, ctx) {
  // API_ORIGIN can be set for local testing (wrangler dev --var API_ORIGIN:http://localhost:3001).
  const upstreamUrl = (env.API_ORIGIN || DEFAULT_API_ORIGIN) + url.pathname + url.search;
  // Pass the visitor IP on, so the API rate limit stays per visitor
  // instead of treating all of Cloudflare as one user.
  const clientIp = request.headers.get("cf-connecting-ip") ?? "";
  const cacheable =
    request.method === "GET" && !url.pathname.startsWith("/api/admin");

  if (!cacheable) {
    const fwd = new Request(upstreamUrl, request);
    if (clientIp) fwd.headers.set("x-forwarded-for", clientIp);
    return fetch(fwd);
  }

  const cache = caches.default;
  const cacheKey = new Request(url.toString(), { method: "GET" });
  const hit = await cache.match(cacheKey);
  if (hit) {
    const res = new Response(hit.body, hit);
    res.headers.set("x-edge-cache", "HIT");
    return res;
  }

  const upstream = await fetch(upstreamUrl, {
    headers: { accept: "application/json", "x-forwarded-for": clientIp },
  });
  const res = new Response(upstream.body, upstream);
  res.headers.set("x-edge-cache", "MISS");
  if (upstream.ok && /s-maxage=\d+/.test(res.headers.get("cache-control") ?? "")) {
    ctx.waitUntil(cache.put(cacheKey, res.clone()));
  }
  return res;
}

/**
 * Lets the SEO code read API data through the same edge cache as visitors.
 * Returns the parsed JSON, `false` when the API says "not found" (404),
 * or `null` when the API could not be reached.
 */
function makeLoadJson(request, env, ctx) {
  const origin = new URL(request.url).origin;
  return async function loadJson(apiPath) {
    try {
      const url = new URL(origin + apiPath);
      const res = await proxyApi(new Request(url, { headers: request.headers }), url, env, ctx);
      if (res.status === 404) return false;
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  };
}

function text(body, contentType, maxAge) {
  return new Response(body, {
    status: 200,
    headers: {
      "content-type": contentType,
      "cache-control": `public, max-age=${maxAge}`,
      "x-content-type-options": "nosniff",
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path.startsWith("/api/")) {
      return proxyApi(request, url, env, ctx);
    }

    if (path === "/robots.txt") {
      return text(ROBOTS, "text/plain; charset=utf-8", 3600);
    }

    if (path === "/sitemap.xml") {
      const { xml, complete } = await buildSitemap(makeLoadJson(request, env, ctx));
      // A sitemap without the gyms (API was down) is only kept for a minute.
      return text(xml, "application/xml; charset=utf-8", complete ? 3600 : 60);
    }

    const response = await env.ASSETS.fetch(request);

    // Pages (not images, scripts…): fill in the SEO tags for this address.
    const isPage =
      request.method === "GET" && (response.headers.get("content-type") ?? "").includes("text/html");
    if (!isPage) return response;

    try {
      const meta = await pageMeta(path, makeLoadJson(request, env, ctx));
      return applyMeta(response, meta, path);
    } catch {
      return response; // never let an SEO problem break the page
    }
  },
};
