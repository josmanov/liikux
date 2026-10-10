const fromEnv = import.meta.env.VITE_API_URL;

export const API =
  typeof fromEnv === "string" && fromEnv.trim()
    ? fromEnv.trim().replace(/\/$/, "")
    : "";
