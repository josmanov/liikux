import "dotenv/config";
import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { chains } from "../db/schema.js";

const CHECKED_AT = "2026-10-01";

type ChainInfo = {
  id: string;
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
      "Aukiolo vaihtelee (osa 4-24, osa 24/7)",
    ],
    sourceUrl: "https://www.easyfit.fi/",
  },
  {
    id: "c2",
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
      "SATS Online",
      "Hinta ja aukiolo vaihtelevat keskuksittain",
    ],
    sourceUrl: "https://www.elixia.fi/",
  },
  {
    id: "c3",
    priceFrom: null,
    is247: false,
    freeTrial: null,
    dayPass: null,
    website: "https://www.fressi.fi/",
    hoursWeekday: "05:00–23:00",
    hoursWeekend: "05:00–23:00",
    memberships: null,
    services: [
      "Kuntosali (monissa 24h)",
      "Ryhmaliikunta",
      "Relax by Fressi",
      "FressiTV",
      "Auki 365 paivaa (tyypillisesti klo 5-23, osa 24h)",
      "Hinta vaihtelee paketin mukaan (tarkista salin sivulta)",
    ],
    sourceUrl: "https://www.fressi.fi/toimipisteet/kamppi/",
  },
  {
    id: "c4",
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
    services: [
      "24/7",
      "Ryhmaliikunta",
      "Treeniohjelmat",
      "Naisten salit (valituissa)",
    ],
    sourceUrl: "https://fi.fitness24seven.com/",
  },
  {
    id: "c5",
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
    priceFrom: null,
    is247: false,
    freeTrial: true,
    dayPass: null,
    website: "https://www.liikku.fi/",
    hoursWeekday: "05:00–23:00",
    hoursWeekend: "05:00–23:00",
    memberships: null,
    services: [
      "Kuntosali klo 5-23",
      "Ilmainen testitreeni ma-ke 16-19",
      "Valmennus",
    ],
    sourceUrl: "https://www.liikku.fi/kuntosalit/lahti/lahti-mukkula.html",
  },
  {
    id: "c7",
    priceFrom: 29,
    is247: false,
    freeTrial: true,
    dayPass: null,
    website: "https://www.foreverclub.fi/",
    hoursWeekday: null,
    hoursWeekend: null,
    memberships: [
      { name: "Basic 12 kk", priceEur: 29, note: "EUR / 4 vko" },
      { name: "Basic joustava", priceEur: 35, note: "EUR / 4 vko" },
      { name: "Premium 12 kk", priceEur: 39, note: "EUR / 4 vko" },
      { name: "Premium joustava", priceEur: 45, note: "EUR / 4 vko" },
    ],
    services: [
      "Ryhmaliikunta",
      "Biocircuit",
      "Personal training",
      "Sauna",
      "Avoimet ovet / tutustuminen",
      "Aukiolo vaihtelee toimipisteittain",
    ],
    sourceUrl: "https://www.foreverclub.fi/",
  },
  {
    id: "c8",
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
      "Virtuaalitunnit",
      "Online-treenikirjasto",
      "Hinta ja aukiolo vaihtelevat keskuksittain",
    ],
    sourceUrl: "https://ladyline.fi/",
  },
  {
    id: "c9",
    priceFrom: null,
    is247: null,
    freeTrial: true,
    dayPass: true,
    website: "https://ole.fit/",
    hoursWeekday: null,
    hoursWeekend: null,
    memberships: null,
    services: [
      "Kuntosali",
      "Maksuton testikaynti",
      "Hinta ja aukiolo vaihtelevat keskuksittain (franchise)",
    ],
    sourceUrl: "https://ole.fit/",
  },
  {
    id: "c10",
    priceFrom: null,
    is247: false,
    freeTrial: true,
    dayPass: null,
    website: "https://esport.fi/",
    hoursWeekday: "06:30–23:00",
    hoursWeekend: "07:30–22:00",
    memberships: null,
    services: [
      "Kuntosali",
      "Ryhmaliikunta",
      "Mailapelit",
      "Ilmainen tutustumisviikko",
    ],
    sourceUrl: "https://esport.fi/center/",
  },
  {
    id: "c11",
    priceFrom: 17,
    is247: false,
    freeTrial: true,
    dayPass: true,
    website: "https://www.unisport.fi/",
    hoursWeekday: "06:30–22:30",
    hoursWeekend: "09:00–20:30",
    memberships: [
      {
        name: "Jasenyys (yliopisto-opiskelijat)",
        priceEur: 17,
        note: "EUR/kk",
      },
      { name: "Jasenyys (henkilosto)", priceEur: 24, note: "EUR/kk" },
      { name: "Kertakaynti (opiskelijat)", priceEur: 6 },
    ],
    services: [
      "Kuntosali",
      "Ryhmaliikunta",
      "Online",
      "Ensimmainen kertakaynti ilmainen (koodi freevisit)",
    ],
    sourceUrl:
      "https://www.unisport.fi/fi/liikuntakeskukset-ja-aukioloajat/unisport-kluuvi",
  },
  {
    id: "c12",
    priceFrom: null,
    is247: true,
    freeTrial: true,
    dayPass: null,
    website: "https://mmkuntotalo.fi/",
    hoursWeekday: "24/7",
    hoursWeekend: "24/7",
    memberships: null,
    services: [
      "24/7 kuntosali (jasenille)",
      "Ryhmaliikunta",
      "Personal training",
      "Ilmainen tutustumiskaynti",
    ],
    sourceUrl: "https://mmkuntotalo.fi/",
  },
  {
    id: "c-other",
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
      `Updated ${info.id}: price=${info.priceFrom ?? "NULL"} hours=${info.hoursWeekday ?? "-"}`,
    );
  }
  console.log("Chain info seed OK (from gym/chain www pages)");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
