import type { Lang } from "../../i18n/lang";

/**
 * Texts of the About page (/fi/tietoa and /en/about).
 * AboutPage.tsx renders them. Keep both languages in sync.
 *
 * Everything here must be true about how the site works today:
 * see docs/changes/phase-5.md for how the daily check works.
 */
export type AboutContent = {
  metaTitle: string;
  metaDescription: string;
  title: string;
  lead: string;
  stats: { gyms: string; cities: string; chains: string };
  stepsTitle: string;
  steps: { h: string; p: string }[];
  faqTitle: string;
  faq: { q: string; a: string }[];
  helpTitle: string;
  helpLead: string;
  suggest: string;
  report: string;
  browse: string;
};

const fi: AboutContent = {
  metaTitle: "Tietoa Liikuxista – näin tarkistamme salien hinnat | Liikux",
  metaDescription:
    "Liikux näyttää Suomen kuntosalit kartalla hintoineen. Lue, mistä tiedot tulevat, miten ne tarkistetaan ja mitä tehdä, jos jokin on väärin.",
  title: "Tietoa Liikuxista",
  lead: "Liikux näyttää osoitteesi lähellä olevat kuntosalit kartalla ja kertoo, mitä ne maksavat ja milloin ne ovat auki. Palvelu on ilmainen, eikä sen käyttö vaadi tiliä.",
  stats: { gyms: "kuntosalia", cities: "kaupunkia ja kuntaa", chains: "ketjua" },
  stepsTitle: "Näin tiedot syntyvät",
  steps: [
    {
      h: "Salit",
      p: "Salien nimet, osoitteet ja sijainnit tulevat julkisesta liikuntapaikkarekisteristä ja ketjujen omilta sivuilta. Jokainen sali on sijoitettu kartalle osoitteensa mukaan.",
    },
    {
      h: "Hinnat ja aukiolot",
      p: "Hinta ja aukioloaika on luettu salin tai ketjun omalta sivulta. Salin sivulla näet aina lähteen, josta hinta on peräisin, ja voit avata sen itse.",
    },
    {
      h: "Päivittäinen tarkistus",
      p: "Ohjelma avaa salin sivun kerran päivässä ja katsoo, lukeeko siellä yhä sama hinta ja aukiolo. Jos lukee, salin sivulla näkyy “Vahvistettu tänään”. Jos ei, tieto tarkistetaan käsin.",
    },
  ],
  faqTitle: "Usein kysyttyä",
  faq: [
    {
      q: "Mitä “Vahvistettu tänään” tarkoittaa?",
      a: "Ohjelmamme löysi juuri tämän hinnan tai aukioloajan salin omalta sivulta tänään. Jos vahvistuksesta on yli 30 päivää, merkintää ei näytetä, vaan näet päivän, jolloin tieto on viimeksi tarkistettu.",
    },
    {
      q: "Mikä on “alkaen”-hinta?",
      a: "Se on halvin tavallinen aikuisen kuukausihinta, jonka löysimme. Opiskelija- ja eläkeläishintoja, kampanjoita ja kertakäyntejä ei lasketa mukaan. Hinta voi edellyttää esimerkiksi 12 kuukauden sopimusta, joten tarkista ehdot salin sivulta.",
    },
    {
      q: "Miksi hinta on outo luku, esimerkiksi 31,67 € kuukaudessa?",
      a: "Osa saleista myy vain 3, 6 tai 12 kuukauden kortteja. Silloin olemme jakaneet kortin hinnan kuukausille, jotta saleja voi verrata keskenään. 380 euron vuosikortti on 31,67 € kuukaudessa.",
    },
    {
      q: "Miksi salin kohdalla lukee “Ei tiedossa”?",
      a: "Emme ole löytäneet tietoa salin sivuilta emmekä halua arvata. Jos tiedät hinnan tai aukioloajan, kerro se meille salin sivun “Ilmoita virheestä” -linkistä.",
    },
    {
      q: "Hinta tai aukiolo on väärin. Mitä teen?",
      a: "Avaa salin sivu ja valitse “Ilmoita virheestä”. Kerro, mikä on väärin ja mistä oikea tieto löytyy. Lopullisen hinnan näet aina salin omalta sivulta.",
    },
    {
      q: "Salini puuttuu kartalta.",
      a: "Ehdota sitä alla olevasta linkistä. Riittää, että kerrot salin nimen ja paikkakunnan. Verkkosivun osoite nopeuttaa lisäämistä.",
    },
    {
      q: "Tarvitsenko tilin? Minne suosikit tallentuvat?",
      a: "Et tarvitse tiliä. Suosikit tallentuvat vain tämän laitteen selaimeen, joten ne eivät näy muilla laitteilla. Voit jakaa vertailun linkkinä suosikkisivulta.",
    },
  ],
  helpTitle: "Auta pitämään tiedot oikeina",
  helpLead: "Tunnet oman salisi parhaiten. Jokainen korjaus ja ehdotus luetaan.",
  suggest: "Ehdota salia",
  report: "Ilmoita virheestä",
  browse: "Selaa saleja",
};

const en: AboutContent = {
  metaTitle: "About Liikux – how we check gym prices | Liikux",
  metaDescription:
    "Liikux shows gyms in Finland on a map with their prices. Read where the data comes from, how it is checked and what to do if something is wrong.",
  title: "About Liikux",
  lead: "Liikux shows the gyms near your address on a map and tells you what they cost and when they are open. It is free to use and needs no account.",
  stats: { gyms: "gyms", cities: "towns and cities", chains: "chains" },
  stepsTitle: "Where the data comes from",
  steps: [
    {
      h: "Gyms",
      p: "Gym names, addresses and locations come from Finland's public register of sports facilities and from the chains' own websites. Every gym is placed on the map by its address.",
    },
    {
      h: "Prices and opening hours",
      p: "The price and opening hours were read from the gym's or chain's own website. A gym page always shows the source of the price, and you can open it yourself.",
    },
    {
      h: "A check every day",
      p: "Once a day a program opens the gym's page and looks whether the same price and hours are still written there. If they are, the gym page says “Confirmed today”. If not, the detail is checked by hand.",
    },
  ],
  faqTitle: "Common questions",
  faq: [
    {
      q: "What does “Confirmed today” mean?",
      a: "Our program found exactly this price or these opening hours on the gym's own page today. When the last confirmation is more than 30 days old, the label is not shown and you see the date the detail was last checked.",
    },
    {
      q: "What is a “from” price?",
      a: "It is the lowest regular adult monthly price we found. Student and senior prices, campaigns and single visits are not counted. The price may need, for example, a 12-month contract, so check the terms on the gym's page.",
    },
    {
      q: "Why is a price an odd number, like €31.67 a month?",
      a: "Some gyms only sell 3, 6 or 12 month cards. We then divide the card price by the months, so gyms can be compared with each other. A €380 yearly card is €31.67 a month.",
    },
    {
      q: "Why does a gym say “Not known”?",
      a: "We have not found the detail on the gym's website and we do not want to guess. If you know the price or the hours, tell us with the “Report an error” link on the gym page.",
    },
    {
      q: "A price or opening time is wrong. What do I do?",
      a: "Open the gym page and choose “Report an error”. Tell us what is wrong and where the right detail can be found. The final price is always the one on the gym's own page.",
    },
    {
      q: "My gym is missing from the map.",
      a: "Suggest it with the link below. The gym's name and town are enough. A website address makes adding it faster.",
    },
    {
      q: "Do I need an account? Where are my favorites saved?",
      a: "You do not need an account. Favorites are saved only in this device's browser, so they do not show on your other devices. You can share a comparison as a link from the favorites page.",
    },
  ],
  helpTitle: "Help keep the data right",
  helpLead: "You know your own gym best. Every correction and suggestion is read.",
  suggest: "Suggest a gym",
  report: "Report an error",
  browse: "Browse gyms",
};

export const ABOUT: Record<Lang, AboutContent> = { fi, en };
