import type { Lang } from "../i18n/lang";

const enPhrase: Record<string, string> = {
  "Kuukausijäsenyys (sitoutumaton)": "Monthly membership (no commitment)",
  "Kuukausijäsenyys (sitoutunut)": "Monthly membership (committed)",
  "Kuukausijasenyys": "Monthly membership",
  Kertamaksu: "Single visit",
  Sarjakortti: "Multi-visit card",
  Aloitusmaksu: "Start fee",
  "Alennus kk": "Monthly discount",
  "opiskelija, nuori 15–18 v, seniori (-20 % listahinnasta)":
    "student, youth 15–18, senior (-20% off the list price)",
  "Basic (yksi keskus)": "Basic (one club)",
  "Plus (kaikki keskukset)": "Plus (all clubs)",
  Online: "Online",
  Kertakaynti: "Single visit",
  "+ aloitusmaksu 29,90 EUR": "+ start fee 29.90 EUR",
  Virtuaalitunnit: "Virtual classes",
  "Online-treenikirjasto": "Online workout library",
  Sauna: "Sauna",
  "Ryhmatreenit (Plus)": "Group workouts (Plus)",
  "Hinta usein sama, aukiolo vaihtelee salittain":
    "Price is often the same, hours vary by gym",
  Ryhmaliikunta: "Group exercise",
  "Personal trainer": "Personal trainer",
  "Personal training": "Personal training",
  "Hinta ja aukiolo salikohtaisia": "Price and hours vary by gym",
  "Kuntosali (osa 24h)": "Gym (some 24h)",
  "Relax by Fressi": "Relax by Fressi",
  "Nuorisojasenyys 15-17 v": "Youth membership, ages 15–17",
  Treeniohjelmat: "Training programs",
  Jasenyys: "Membership",
  "EUR/kk, normaalihinta": "EUR/mo, regular price",
  "Kuntosali klo 5-23": "Gym 5:00–23:00",
  "Ilmainen testitreeni ma-ke 16-19": "Free trial workout Mon–Wed 16–19",
  Biocircuit: "Biocircuit",
  "Hinta/aukiolo salikohtaisia": "Price and hours vary by gym",
  "Naisten kuntosali": "Women's gym",
  "Franchise: hinta ja aukiolo salikohtaisia":
    "Franchise: price and hours vary by gym",
  "Maksuton testikaynti (usein)": "Free trial visit (often)",
  "Jasenyys alkaen": "Membership from",
  "EUR/kk, vaihtelee keskuksittain (Center kalliimpi)":
    "EUR/mo, varies by club (Center costs more)",
  Kuntosali: "Gym",
  "Ilmainen tutustumisviikko": "Free intro week",
  "Jasenyys (yliopisto-opiskelijat)": "Membership (university students)",
  "Jasenyys (henkilosto)": "Membership (staff)",
  "Kertakaynti (opiskelijat)": "Single visit (students)",
  "EUR/kk": "EUR/mo",
  "Kuntosali alkaen": "Gym from",
  "EUR/kk, vaihtelee salittain": "EUR/mo, varies by gym",
  "24/7 kuntosali (jasenille)": "24/7 gym (members)",
  "Hinta vaihtelee salittain": "Price varies by gym",
};

export function offerPhrase(lang: Lang, text: string) {
  const raw = text.trim();
  if (!raw || lang !== "en") return text;
  const hit = enPhrase[raw];
  if (hit) return hit;
  return raw
    .replace(/(\d+)\s*kk\b/gi, "$1 mo")
    .replace(/opiskelijat/gi, "students")
    .replace(/opiskelija/gi, "student")
    .replace(/eläkeläiset/gi, "pensioners")
    .replace(/eläkeläinen/gi, "pensioner")
    .replace(/seniorit/gi, "seniors")
    .replace(/seniori/gi, "senior")
    .replace(/nuoret/gi, "youth")
    .replace(/nuori/gi, "youth")
    .replace(/työttömät/gi, "unemployed")
    .replace(/työtön/gi, "unemployed")
    .replace(/varusmiehet/gi, "conscripts")
    .replace(/varusmies/gi, "conscript")
    .replace(/listahinnasta/gi, "the list price");
}
