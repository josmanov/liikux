export function cleanHoursValue(raw: string, is247: boolean) {
  if (is247) return "24/7";
  return raw
    .replace(/^ma[–-]pe\s+/i, "")
    .replace(/^la[–-]su\s+/i, "")
    .replace(/^la\s+/i, "")
    .replace(/^su\s+/i, "");
}
