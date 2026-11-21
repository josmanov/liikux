/**
 * Where the API lives.
 *
 * - Development: "" → Vite proxies /api to the local server (vite.config.ts).
 * - Production: "" as well → the request goes to liikux.fi/api/..., where
 *   worker.js answers from the Cloudflare edge cache or forwards it to Render.
 * - VITE_API_URL can still point somewhere else (e.g. straight to Render).
 */
const fromEnv = import.meta.env.VITE_API_URL;

/**
 * Preview mode (started from /admin/tarkistus): the site shows the data that
 * still waits for review, as if it were approved. Needs the admin key, which
 * the review page keeps in sessionStorage. Nothing is saved.
 */
export function previewHeaders(): Record<string, string> {
  try {
    if (sessionStorage.getItem("liikux-preview") !== "1") return {};
    const key = sessionStorage.getItem("liikux-admin-key") ?? "";
    return key ? { "x-admin-key": key, "x-preview": "1" } : {};
  } catch {
    return {};
  }
}

export function previewOn() {
  return Object.keys(previewHeaders()).length > 0;
}

export const API = (
  typeof fromEnv === "string" && fromEnv.trim() ? fromEnv.trim() : ""
).replace(/\/$/, "");
