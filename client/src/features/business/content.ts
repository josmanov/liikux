import type { Lang } from "../../i18n/lang";

/**
 * Texts of the page for gym owners (/fi/yrityksille and /en/for-gyms).
 * BusinessPage.tsx renders them. Keep both languages in sync.
 *
 * Only promise what the site really does today. Paid visibility is described
 * as something we are planning, because it is not built yet.
 */
export type BusinessContent = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  lead: string;
  stats: { gyms: string; cities: string; chains: string };
  cards: { tag: string; h: string; p: string }[];
  howTitle: string;
  how: string[];
  contactTitle: string;
  contactLead: string;
  contact: string;
  fix: string;
};

const fi: BusinessContent = {
  metaTitle: "Kuntosaleille ja ketjuille | Liikux",
  metaDescription:
    "Onko salisi Liikuxissa? Tarkista tiedot ilmaiseksi, pyydä raportti kävijöistä, jotka siirtyivät sivuillenne, ja kysy lisänäkyvyydestä.",
  eyebrow: "Kuntosaleille ja ketjuille",
  title: "Salisi on jo kartalla. Varmistetaan, että tiedot ovat oikein.",
  lead: "Liikuxista etsitään salia osoitteen, hinnan ja aukioloaikojen perusteella. Näkyminen on ilmaista, eikä salin tarvitse tehdä mitään.",
  stats: { gyms: "kuntosalia", cities: "kaupunkia ja kuntaa", chains: "ketjua" },
  cards: [
    {
      tag: "Ilmainen",
      h: "Korjaa salisi tiedot",
      p: "Kerro oikea hinta, aukiolo, jäsenyydet ja palvelut. Päivitämme ne salin sivulle. Lähteeksi merkitään oma verkkosivunne.",
    },
    {
      tag: "Ilmainen",
      h: "Katso, montako kävijää lähetämme",
      p: "Laskemme, kuinka monta kertaa salin sivulta siirrytään teidän verkkosivuillenne. Lähetämme luvut pyynnöstä. Linkeissä on tunniste utm_source=liikux, joten näette kävijät myös omasta analytiikastanne.",
    },
    {
      tag: "Suunnitteilla",
      h: "Lisänäkyvyys",
      p: "Suunnittelemme maksullista näkyvyyttä, esimerkiksi nostoa oman kaupungin listan kärkeen. Maksettu näkyvyys merkitään aina selvästi mainokseksi. Kerro, jos tämä kiinnostaa.",
    },
  ],
  howTitle: "Mitä emme tee",
  how: [
    "Emme myy sijoituksia hakutuloksissa salaa. Maksettu näkyvyys on aina merkitty.",
    "Emme muuta hintoja pyynnöstä toisiksi kuin mitä omalla sivullanne lukee.",
    "Emme kerää kävijöistä henkilötietoja klikkausten laskemiseen.",
  ],
  contactTitle: "Ota yhteyttä",
  contactLead: "Kerro salin nimi ja mitä asia koskee. Vastaamme sähköpostiin, jonka jätät lomakkeelle.",
  contact: "Lähetä viesti",
  fix: "Korjaa salin tietoja",
};

const en: BusinessContent = {
  metaTitle: "For gyms and chains | Liikux",
  metaDescription:
    "Is your gym on Liikux? Check its details for free, ask for a report of visitors who went on to your site, and ask about extra visibility.",
  eyebrow: "For gyms and chains",
  title: "Your gym is already on the map. Let's make sure the details are right.",
  lead: "People use Liikux to find a gym by address, price and opening hours. Being listed is free and the gym does not need to do anything.",
  stats: { gyms: "gyms", cities: "towns and cities", chains: "chains" },
  cards: [
    {
      tag: "Free",
      h: "Correct your gym's details",
      p: "Tell us the right price, opening hours, memberships and services. We update the gym page and mark your own website as the source.",
    },
    {
      tag: "Free",
      h: "See how many visitors we send",
      p: "We count how many times people go from the gym page to your website. We send the numbers on request. The links carry utm_source=liikux, so you can also see the visitors in your own analytics.",
    },
    {
      tag: "Planned",
      h: "Extra visibility",
      p: "We are planning paid visibility, for example a place at the top of the list for your town. Paid visibility is always clearly marked as an ad. Tell us if this interests you.",
    },
  ],
  howTitle: "What we do not do",
  how: [
    "We do not sell positions in the results in secret. Paid visibility is always marked.",
    "We do not change prices on request to something other than what your own page says.",
    "We do not collect personal data about visitors to count clicks.",
  ],
  contactTitle: "Get in touch",
  contactLead: "Tell us the gym's name and what it is about. We reply to the email address you leave on the form.",
  contact: "Send a message",
  fix: "Correct gym details",
};

export const BUSINESS: Record<Lang, BusinessContent> = { fi, en };
