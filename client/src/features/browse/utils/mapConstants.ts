export const HANGO: [number, number] = [22.968, 59.824];
export const NUORGAM: [number, number] = [27.879, 70.086];
export const FINLAND_VIEW: [[number, number], [number, number]] = [
  [18.8, HANGO[1] - 0.35],
  [31.8, NUORGAM[1] + 0.25],
];
export const FINLAND_CENTER: [number, number] = [
  (HANGO[0] + NUORGAM[0]) / 2,
  (HANGO[1] + NUORGAM[1]) / 2,
];
export const ORIGIN_ZOOM = 12;
export const ADDRESS_ZOOM = 10.9;
export const FRAME_ZOOM = 12.6;
export const MAAKUNTA_MAP_ACTIVE = false;
export const MAP_MAX_BOUNDS: [[number, number], [number, number]] = [
  [4.0, 53.5],
  [44.0, 73.0],
];
export const PIN_ZOOM_OUT_PAD_KM = 10;

export const REGION_COLORS: Record<string, string> = {
  Uusimaa: "#e53935",
  "Varsinais-Suomi": "#1e88e5",
  Satakunta: "#43a047",
  "Kanta-Häme": "#fb8c00",
  Pirkanmaa: "#8e24aa",
  "Päijät-Häme": "#00acc1",
  Kymenlaakso: "#c0ca33",
  "Etelä-Karjala": "#d81b60",
  "Etelä-Savo": "#5e35b1",
  "Pohjois-Savo": "#00897b",
  "Pohjois-Karjala": "#6d4c41",
  "Keski-Suomi": "#3949ab",
  "Etelä-Pohjanmaa": "#f4511e",
  Pohjanmaa: "#039be5",
  "Keski-Pohjanmaa": "#7cb342",
  "Pohjois-Pohjanmaa": "#fdd835",
  Kainuu: "#ad1457",
  Lappi: "#1565c0",
  Ahvenanmaa: "#00838f",
};

export const REGION_FILL_MATCH: unknown[] = [
  "match",
  ["get", "nimi"],
  ...Object.entries(REGION_COLORS).flatMap(([name, color]) => [name, color]),
  "#64748b",
];

export function regionColor(name: string | null | undefined) {
  if (!name) return "#64748b";
  return REGION_COLORS[name] ?? "#64748b";
}

export const distancePresetMeta = [
  { id: "1", km: 1 },
  { id: "3", km: 3 },
  { id: "5", km: 5 },
  { id: "10", km: 10 },
  { id: "20", km: 20 },
  { id: "30", km: 30 },
  { id: "all", km: null as number | null },
];

export const PAGE_SIZE_START = 8;
export const PAGE_SIZE_MOBILE = 18;
export const BROWSE_MOBILE_MQ = "(max-width: 900px)";
export const BROWSE_SEARCH_QUICK = [
  { id: "fressi", q: "Fressi" },
  { id: "elixia", q: "Elixia" },
  { id: "easyfit", q: "EasyFit" },
  { id: "f24", q: "Fitness24Seven" },
  { id: "gofitness", q: "GoFitness" },
  { id: "liikku", q: "Liikku" },
  { id: "forever", q: "Forever" },
  { id: "trial", filter: "freeTrial" as const },
  { id: "247", filter: "only247" as const },
  { id: "day", filter: "dayPass" as const },
] as const;

export type FilterKey = "sort" | "price" | "distance";
