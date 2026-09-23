export type GymHoursMock = {
  is247: boolean;
  weekday: string;
  weekend: string;
};

export type GymMembershipMock = {
  name: string;
  priceEur: number;
  note?: string;
};

export type GymDetailMock = {
  heroImage: string;
  monthlyPrice: number;
  dayPassPrice: number | null;
  hours: GymHoursMock | null;
  services: string[];
  memberships: GymMembershipMock[];
};

const bySlug: Record<string, GymDetailMock> = {
  "fressi-tapiola": {
    heroImage: "/hero-gym.jpg",
    monthlyPrice: 59,
    dayPassPrice: 25,
    hours: {
      is247: false,
      weekday: "ma–pe 5:30–22:00",
      weekend: "la–su 8:00–20:00",
    },
    services: [
      "Sauna",
      "GroupX",
      "Personal trainer",
      "Pysäköinti",
      "Ilmainen kokeilu",
    ],
    memberships: [
      { name: "Kuukausijäsenyys", priceEur: 59, note: "Ei sitoutumista" },
      { name: "12 kk sopimus", priceEur: 49, note: "Alk. /kk" },
      { name: "Kertakäynti", priceEur: 25 },
    ],
  },
  "elixia-redi": {
    heroImage: "/hero-gym.jpg",
    monthlyPrice: 49,
    dayPassPrice: 20,
    hours: {
      is247: false,
      weekday: "ma–pe 6:00–22:00",
      weekend: "la–su 8:00–20:00",
    },
    services: ["Sauna", "GroupX", "Uima-allas", "Personal trainer"],
    memberships: [
      { name: "Kuukausijäsenyys", priceEur: 49 },
      { name: "12 kk sopimus", priceEur: 39, note: "Alk. /kk" },
      { name: "Kertakäynti", priceEur: 20 },
    ],
  },
  "easyfit-kamppi": {
    heroImage: "/bg-gym.png",
    monthlyPrice: 29,
    dayPassPrice: 15,
    hours: {
      is247: true,
      weekday: "24/7",
      weekend: "24/7",
    },
    services: ["24/7", "Sauna", "Ilmainen kokeilu"],
    memberships: [
      { name: "Kuukausijäsenyys", priceEur: 29 },
      { name: "Kertakäynti", priceEur: 15 },
    ],
  },
  "liikku-pasila": {
    heroImage: "/hero-gym.jpg",
    monthlyPrice: 39,
    dayPassPrice: null,
    hours: {
      is247: false,
      weekday: "ma–pe 6:00–21:00",
      weekend: "la 9:00–18:00 · su suljettu",
    },
    services: ["Personal trainer", "Pysäköinti"],
    memberships: [
      { name: "Kuukausijäsenyys", priceEur: 39 },
      { name: "12 kk sopimus", priceEur: 32, note: "Alk. /kk" },
    ],
  },
  "fressi-kamppi": {
    heroImage: "/hero-gym.jpg",
    monthlyPrice: 39,
    dayPassPrice: null,
    hours: null,
    services: ["Sauna", "GroupX"],
    memberships: [
      { name: "Kuukausijäsenyys", priceEur: 39 },
      { name: "12 kk sopimus", priceEur: 34, note: "Alk. /kk" },
    ],
  },
};

function detailFromSlug(slug: string): GymDetailMock {
  let h = 0;
  for (let i = 0; i < slug.length; i++) {
    h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  }
  const monthly = [29, 35, 39, 49, 59][h % 5];
  const is247 = h % 3 === 0;
  return {
    heroImage: h % 2 === 0 ? "/hero-gym.jpg" : "/bg-gym.png",
    monthlyPrice: monthly,
    dayPassPrice: h % 4 === 0 ? Math.round(monthly / 2) : null,
    hours: is247
      ? { is247: true, weekday: "24/7", weekend: "24/7" }
      : {
          is247: false,
          weekday: "ma–pe 6:00–22:00",
          weekend: "la–su 9:00–18:00",
        },
    services: [
      "Sauna",
      "Personal trainer",
      is247 ? "24/7" : null,
      h % 2 === 0 ? "GroupX" : null,
      h % 5 === 0 ? "Pysäköinti" : null,
    ].filter(Boolean) as string[],
    memberships: [
      { name: "Kuukausijäsenyys", priceEur: monthly },
      {
        name: "12 kk sopimus",
        priceEur: Math.max(25, monthly - 10),
        note: "Alk. /kk",
      },
      ...(h % 4 === 0
        ? [{ name: "Kertakäynti", priceEur: Math.round(monthly / 2) }]
        : []),
    ],
  };
}

export function getGymDetailMock(slug: string): GymDetailMock {
  return bySlug[slug] ?? detailFromSlug(slug);
}

const chainWebsites: Record<string, string> = {
  easyfit: "https://www.easyfit.fi",
  elixia: "https://www.elixia.fi",
  fressi: "https://www.fressi.fi",
  fitness24seven: "https://www.fitness24seven.com/fi",
  "go-fitness": "https://www.gofitness.fi",
  liikku: "https://www.liikku.com",
  olefit: "https://www.ole.fi",
};

export function getChainWebsite(chainSlug: string | undefined | null) {
  if (!chainSlug) return null;
  return chainWebsites[chainSlug] ?? null;
}
