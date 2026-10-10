const fromEnv = import.meta.env.VITE_API_URL;
const fallback =
  import.meta.env.PROD ? "https://liikux.onrender.com" : "";

export const API = (
  typeof fromEnv === "string" && fromEnv.trim()
    ? fromEnv.trim()
    : fallback
).replace(/\/$/, "");
