/**
 * Where the API lives.
 *
 * - Development: "" → Vite proxies /api to the local server (vite.config.ts).
 * - Production: "" as well → the request goes to liikux.fi/api/..., where
 *   worker.js answers from the Cloudflare edge cache or forwards it to Render.
 * - VITE_API_URL can still point somewhere else (e.g. straight to Render).
 */
const fromEnv = import.meta.env.VITE_API_URL;

export const API = (
  typeof fromEnv === "string" && fromEnv.trim() ? fromEnv.trim() : ""
).replace(/\/$/, "");
