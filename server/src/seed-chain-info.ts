import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { chains } from "../db/schema.js";

const CHECKED_AT = "2026-10-01";

type PricingMode = "location" | "shared" | "hybrid";

type ChainInfo = {
  id: string;
  pricingMode: PricingMode;
  priceFrom: number | null;
  is247: boolean | null;
  freeTrial: boolean | null;
  dayPass: boolean | null;
  website: string | null;
  hoursWeekday: string | null;
  hoursWeekend: string | null;
  memberships: { name: string; priceEur: number; note?: string }[] | null;
  services: string[] | null;
  sourceUrl: string | null;
};

const infos: ChainInfo[] = [
  {
    id: "c1",
    pricingMode: "hybrid",
    priceFrom: 36.9,
    is247: null,
    freeTrial: false,
    dayPass: true,
    website: "https://www.easyfit.fi/",
    hoursWeekday: null,
    hoursWeekend: null,
    memberships: [
      { name: "Basic (yksi keskus)", priceEur: 36.9, note: "+ aloitusmaksu 29,90 EUR" },
      { name: "Plus (kaikki keskukset)", priceEur: 46.9, note: "+ aloitusmaksu 29,90 EUR" },
      { name: "Online", priceEur: 15.9 },
      { name: "Kertakaynti", priceEur: 15.9 },
    ],
    services: [
      "Virtuaalitunnit",
      "Online-treenikirjasto",
      "Sauna",
      "Ryhmatreenit (Plus)",
      "Hinta usein sama, aukiolo vaihtelee salittain",
    ],
    sourceUrl: "https://www.easyfit.fi/",
  },
  {
    id: "c2",
    pricingMode: "location",
    priceFrom: null,
    is247: null,
    freeTrial: null,
    dayPass: true,
    website: "https://www.elixia.fi/",
    hoursWeekday: null,
    hoursWeekend: null,
    memberships: null,
    services: [
      "Ryhmaliikunta",
      "Personal trainer",
      "Hinta ja aukiolo salikohtaisia",
    ],
    sourceUrl: "https://www.elixia.fi/",
  },
  {
    id: "c3",
    pricingMode: "location",
    priceFrom: null,
    is247: false,
    freeTrial: null,
    dayPass: null,
    website: "https://www.fressi.fi/",
    hoursWeekday: null,
    hoursWeekend: null,
    memberships: null,
    services: [
      "Kuntosali (osa 24h)",
      "Ryhmaliikunta",
      "Relax by Fressi",
      "Hinta ja aukiolo salikohtaisia",
    ],
    sourceUrl: "https://www.fressi.fi/",
  },
  {
    id: "c4",
    pricingMode: "shared",
    priceFrom: 32.9,
    is247: true,
    freeTrial: true,
    dayPass: null,
    website: "https://fi.fitness24seven.com/",
    hoursWeekday: "24/7",
    hoursWeekend: "24/7",
    memberships: [
      { name: "Kuukausijasenyys", priceEur: 32.9 },
      { name: "Nuorisojasenyys 15-17 v", priceEur: 28.9 },
    ],
    services: ["24/7", "Ryhmaliikunta", "Treeniohjelmat"],
    sourceUrl: "https://fi.fitness24seven.com/",
  },
  {
    id: "c5",
    pricingMode: "location",
    priceFrom: null,
    is247: null,
    freeTrial: null,
    dayPass: null,
    website: null,
    hoursWeekday: null,
    hoursWeekend: null,
    memberships: null,
    services: null,
    sourceUrl: null,
  },
  {
    id: "c6",
    pricingMode: "shared",
    priceFrom: 36.9,
    is247: false,
    freeTrial: true,
    dayPass: null,
    website: "https://www.liikku.fi/",
    hoursWeekday: "05:00–23:00",
    hoursWeekend: "05:00–23:00",
    memberships: [
      { name: "Jasenyys", priceEur: 36.9, note: "EUR/kk, normaalihinta" },
    ],
    services: [
      "Kuntosali klo 5-23",
      "Ilmainen testitreeni ma-ke 16-19",
    ],
    sourceUrl: "https://www.liikku.fi/",
  },
  {
    id: "c7",
    pricingMode: "location",
    priceFrom: null,
    is247: false,
    freeTrial: true,
    dayPass: null,
    website: "https://www.foreverclub.fi/",
    hoursWeekday: null,
    hoursWeekend: null,
    memberships: null,
    services: [
      "Ryhmaliikunta",
      "Biocircuit",
      "Personal training",
      "Hinta/aukiolo salikohtaisia",
    ],
    sourceUrl: "https://www.foreverclub.fi/",
  },
  {
    id: "c8",
    pricingMode: "location",
    priceFrom: null,
    is247: null,
    freeTrial: false,
    dayPass: null,
    website: "https://ladyline.fi/",
    hoursWeekday: null,
    hoursWeekend: null,
    memberships: null,
    services: [
      "Naisten kuntosali",
      "Ryhmaliikunta",
      "Hinta ja aukiolo salikohtaisia",
    ],
    sourceUrl: "https://ladyline.fi/",
  },
  {
    id: "c9",
    pricingMode: "location",
    priceFrom: null,
    is247: null,
    freeTrial: true,
    dayPass: true,
    website: "https://ole.fit/",
    hoursWeekday: null,
    hoursWeekend: null,
    memberships: null,
    services: [
      "Franchise: hinta ja aukiolo salikohtaisia",
      "Maksuton testikaynti (usein)",
    ],
    sourceUrl: "https://ole.fit/",
  },
  {
    id: "c10",
    pricingMode: "shared",
    priceFrom: 55.9,
    is247: false,
    freeTrial: true,
    dayPass: null,
    website: "https://esport.fi/",
    hoursWeekday: "06:30–23:00",
    hoursWeekend: "07:30–22:00",
    memberships: [
      {
        name: "Jasenyys alkaen",
        priceEur: 55.9,
        note: "EUR/kk, vaihtelee keskuksittain (Center kalliimpi)",
      },
    ],
    services: [
      "Kuntosali",
      "Ryhmaliikunta",
      "Ilmainen tutustumisviikko",
    ],
    sourceUrl: "https://esport.fi/",
  },
  {
    id: "c11",
    pricingMode: "shared",
    priceFrom: 17,
    is247: false,
    freeTrial: true,
    dayPass: true,
    website: "https://www.unisport.fi/",
    hoursWeekday: "06:30–22:30",
    hoursWeekend: "09:00–20:30",
    memberships: [
      { name: "Jasenyys (yliopisto-opiskelijat)", priceEur: 17, note: "EUR/kk" },
      { name: "Jasenyys (henkilosto)", priceEur: 24, note: "EUR/kk" },
      { name: "Kertakaynti (opiskelijat)", priceEur: 6 },
    ],
    services: ["Kuntosali", "Ryhmaliikunta", "Online"],
    sourceUrl:
      "https://www.unisport.fi/fi/liikuntakeskukset-ja-aukioloajat/unisport-kluuvi",
  },
  {
    id: "c12",
    pricingMode: "hybrid",
    priceFrom: 64,
    is247: true,
    freeTrial: true,
    dayPass: null,
    website: "https://mmkuntotalo.fi/",
    hoursWeekday: "24/7",
    hoursWeekend: "24/7",
    memberships: [
      { name: "Kuntosali alkaen", priceEur: 64, note: "EUR/kk, vaihtelee salittain" },
    ],
    services: [
      "24/7 kuntosali (jasenille)",
      "Hinta vaihtelee salittain",
    ],
    sourceUrl: "https://mmkuntotalo.fi/",
  },
  {
    id: "c-other",
    pricingMode: "location",
    priceFrom: null,
    is247: null,
    freeTrial: null,
    dayPass: null,
    website: null,
    hoursWeekday: null,
    hoursWeekend: null,
    memberships: null,
    services: null,
    sourceUrl: null,
  },
];

async function main() {
  for (const info of infos) {
    await db
      .update(chains)
      .set({
        pricingMode: info.pricingMode,
        priceFrom: info.priceFrom,
        is247: info.is247,
        freeTrial: info.freeTrial,
        dayPass: info.dayPass,
        website: info.website,
        hoursWeekday: info.hoursWeekday,
        hoursWeekend: info.hoursWeekend,
        membershipsJson: info.memberships
          ? JSON.stringify(info.memberships)
          : null,
        servicesJson: info.services ? JSON.stringify(info.services) : null,
        sourceUrl: info.sourceUrl,
        checkedAt: info.sourceUrl ? CHECKED_AT : null,
      })
      .where(eq(chains.id, info.id));
    console.log(
      `Updated ${info.id} mode=${info.pricingMode} price=${info.priceFrom ?? "NULL"}`,
    );
  }
  console.log("Chain info seed OK");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
