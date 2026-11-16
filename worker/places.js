/**
 * Regions and cities that have their own browse page
 * (/fi/kuntosalit/:region/:city and /en/gyms/:region/:city).
 * Used for the sitemap and for page titles. slug → display name.
 */

export const REGIONS = {
  uusimaa: "Uusimaa",
  varsinaissuomi: "Varsinais-Suomi",
  satakunta: "Satakunta",
  "kanta-hame": "Kanta-Häme",
  pirkanmaa: "Pirkanmaa",
  "paijat-hame": "Päijät-Häme",
  kymenlaakso: "Kymenlaakso",
  "etela-karjala": "Etelä-Karjala",
  "etela-savo": "Etelä-Savo",
  "pohjois-savo": "Pohjois-Savo",
  "pohjois-karjala": "Pohjois-Karjala",
  "keski-suomi": "Keski-Suomi",
  "etela-pohjanmaa": "Etelä-Pohjanmaa",
  pohjanmaa: "Pohjanmaa",
  "keski-pohjanmaa": "Keski-Pohjanmaa",
  "pohjois-pohjanmaa": "Pohjois-Pohjanmaa",
  kainuu: "Kainuu",
  lappi: "Lappi",
  ahvenanmaa: "Ahvenanmaa",
};

/** [region slug, city slug, city name] */
export const CITIES = [
  ["uusimaa", "helsinki", "Helsinki"],
  ["uusimaa", "espoo", "Espoo"],
  ["uusimaa", "vantaa", "Vantaa"],
  ["uusimaa", "porvoo", "Porvoo"],
  ["uusimaa", "lohja", "Lohja"],
  ["uusimaa", "hyvinkaa", "Hyvinkää"],
  ["uusimaa", "kerava", "Kerava"],
  ["uusimaa", "jarvenpaa", "Järvenpää"],
  ["uusimaa", "kirkkonummi", "Kirkkonummi"],
  ["pirkanmaa", "tampere", "Tampere"],
  ["varsinaissuomi", "turku", "Turku"],
  ["varsinaissuomi", "salo", "Salo"],
  ["pohjois-pohjanmaa", "oulu", "Oulu"],
  ["keski-suomi", "jyvaskyla", "Jyväskylä"],
  ["pohjois-savo", "kuopio", "Kuopio"],
  ["paijat-hame", "lahti", "Lahti"],
  ["kymenlaakso", "kouvola", "Kouvola"],
  ["kymenlaakso", "kotka", "Kotka"],
  ["satakunta", "pori", "Pori"],
  ["pohjois-karjala", "joensuu", "Joensuu"],
  ["etela-karjala", "lappeenranta", "Lappeenranta"],
  ["kanta-hame", "hameenlinna", "Hämeenlinna"],
  ["kanta-hame", "riihimaki", "Riihimäki"],
  ["pohjanmaa", "vaasa", "Vaasa"],
  ["etela-pohjanmaa", "seinajoki", "Seinäjoki"],
  ["lappi", "rovaniemi", "Rovaniemi"],
  ["etela-savo", "mikkeli", "Mikkeli"],
];

/** Pages that exist in both languages: [Finnish path, English path]. */
export const STATIC_PAGES = [
  ["/", "/en"],
  ["/fi/kuntosalit", "/en/gyms"],
  ["/fi/ketjut", "/en/chains"],
  ["/fi/tietoa", "/en/about"],
  ["/fi/kayttoehdot", "/en/terms"],
  ["/fi/tietosuoja", "/en/privacy"],
  ["/fi/evasteet", "/en/cookies"],
];
