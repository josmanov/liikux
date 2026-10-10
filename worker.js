const SITEMAP = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://liikux.fi/</loc>
  </url>
  <url>
    <loc>https://liikux.fi/en</loc>
  </url>
  <url>
    <loc>https://liikux.fi/fi/kuntosalit</loc>
  </url>
  <url>
    <loc>https://liikux.fi/en/gyms</loc>
  </url>
  <url>
    <loc>https://liikux.fi/fi/kayttoehdot</loc>
  </url>
  <url>
    <loc>https://liikux.fi/fi/tietosuoja</loc>
  </url>
  <url>
    <loc>https://liikux.fi/fi/evasteet</loc>
  </url>
  <url>
    <loc>https://liikux.fi/en/terms</loc>
  </url>
  <url>
    <loc>https://liikux.fi/en/privacy</loc>
  </url>
  <url>
    <loc>https://liikux.fi/en/cookies</loc>
  </url>
</urlset>
`;

const ROBOTS = `User-agent: *
Allow: /

Sitemap: https://liikux.fi/sitemap.xml
`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/sitemap.xml") {
      return new Response(SITEMAP, {
        status: 200,
        headers: {
          "content-type": "application/xml; charset=utf-8",
          "cache-control": "public, max-age=3600",
          "x-content-type-options": "nosniff",
        },
      });
    }

    if (path === "/robots.txt") {
      return new Response(ROBOTS, {
        status: 200,
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "public, max-age=3600",
          "x-content-type-options": "nosniff",
        },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
