import { LEGAL_EMAIL, LEGAL_OWNER, LEGAL_UPDATED_FI, type LegalDoc, type LegalSlug } from "./types";

const updated = `Päivitetty ${LEGAL_UPDATED_FI}`;

export const LEGAL_FI: Record<LegalSlug, LegalDoc> = {
  terms: {
    title: "Käyttöehdot",
    updated,
    intro:
      "Näitä ehtoja sovelletaan liikux.fi-palvelun käyttöön. Käyttämällä palvelua hyväksyt nämä ehdot.",
    sections: [
      {
        h: "1. Palvelu",
        p: [
          `Liikux (liikux.fi) on maksuton ja riippumaton palvelu, jolla voi etsiä ja vertailla kuntosaleja Suomessa. Palvelun ylläpitäjä on ${LEGAL_OWNER} (yhteys: ${LEGAL_EMAIL}).`,
          "Palvelun käyttö ei vaadi rekisteröitymistä. Liikux ei myy jäsenyyksiä eikä ole osapuolena sinun ja kuntosalin välisessä sopimuksessa. Jäsenyydet, kokeilut ja maksut sovitaan aina suoraan kuntosalin kanssa.",
        ],
      },
      {
        h: "2. Tietojen lähteet ja oikeellisuus",
        p: [
          "Kuntosalien perustiedot (nimi, osoite, sijainti) perustuvat Lipas-liikuntapaikkatietokannan avoimeen dataan (Jyväskylän yliopisto, lisenssi CC BY 4.0) sekä OpenStreetMapin tietoihin (© OpenStreetMap-tekijät, ODbL).",
          "Hinnat, aukioloajat, kokeilut, tarjoukset ja palvelut kootaan kuntosalien ja ketjujen omilta verkkosivuilta. Tiedot voivat muuttua nopeasti, ja niissä voi olla virheitä tai puutteita.",
          "Tiedot ovat suuntaa-antavia. Tarkista hinta, sopimusehdot ja aukioloajat aina kuntosalilta ennen kuin teet sopimuksen. Liikux ei vastaa tietojen virheettömyydestä tai ajantasaisuudesta.",
          "Jos huomaat virheen, voit ilmoittaa siitä palautelomakkeella (Ilmoita virheestä).",
        ],
      },
      {
        h: "3. Linkit muille sivustoille",
        p: [
          "Palvelussa on linkkejä kuntosalien verkkosivuille ja muihin palveluihin (esim. Google Maps). Liikux ei vastaa ulkopuolisten sivustojen sisällöstä, saatavuudesta tai tietosuojakäytännöistä.",
        ],
      },
      {
        h: "4. Sallittu käyttö",
        p: ["Palvelua saa käyttää henkilökohtaiseen kuntosalin etsimiseen ja vertailuun. Et saa:"],
        list: [
          "kerätä palvelun sisältöä automaattisesti tai suuria määriä (esim. scraping) ilman kirjallista lupaa",
          "kuormittaa, häiritä tai yrittää murtautua palveluun",
          "lähettää palautelomakkeella tahallaan vääriä, loukkaavia tai lainvastaisia tietoja",
          "esittää palvelua tai sen sisältöä omanasi",
        ],
      },
      {
        h: "5. Palaute ja ehdotukset",
        p: [
          "Voit ehdottaa uutta kuntosalia tai ilmoittaa virheestä palautelomakkeella. Lähettämiäsi tietoja voidaan käyttää palvelun tietojen lisäämiseen ja korjaamiseen. Emme ole velvollisia julkaisemaan ehdotuksia.",
          "Älä lähetä lomakkeella arkaluonteisia henkilötietoja. Henkilötietojen käsittelystä kerrotaan tietosuojaselosteessa.",
        ],
      },
      {
        h: "6. Immateriaalioikeudet",
        p: [
          "Palvelun ulkoasu, koodi ja Liikuxin itse tuottama sisältö kuuluvat palvelun ylläpitäjälle. Kuntosaliketjujen nimet ja logot kuuluvat omistajilleen, ja niitä käytetään palvelussa vain ketjujen tunnistamiseen. Avoimen datan lähteet mainitaan kohdassa 2.",
        ],
      },
      {
        h: "7. Vastuunrajoitus",
        p: [
          "Palvelu tarjotaan sellaisenaan ja maksutta. Emme takaa, että palvelu on aina saatavilla tai virheetön. Liikux ei vastaa vahingoista, jotka aiheutuvat palvelun tietojen käytöstä, kuten valitun kuntosalin hinnasta tai sopimusehdoista, ellei pakottava lainsäädäntö muuta edellytä.",
        ],
      },
      {
        h: "8. Muutokset",
        p: [
          "Voimme muuttaa palvelua tai lopettaa sen. Voimme päivittää näitä ehtoja; voimassa oleva versio ja päivityspäivä näkyvät tällä sivulla. Jatkamalla käyttöä muutoksen jälkeen hyväksyt päivitetyt ehdot.",
        ],
      },
      {
        h: "9. Sovellettava laki ja yhteystiedot",
        p: [
          "Näihin ehtoihin sovelletaan Suomen lakia.",
          `Kysymykset ehdoista: ${LEGAL_EMAIL}.`,
        ],
      },
    ],
  },

  privacy: {
    title: "Tietosuojaseloste",
    updated,
    intro:
      "Tässä selosteessa kerrotaan, mitä henkilötietoja liikux.fi käsittelee, miksi, kenelle tietoja välittyy ja mitä oikeuksia sinulla on (EU:n tietosuoja-asetus 2016/679, artiklat 13–14).",
    sections: [
      {
        h: "1. Rekisterinpitäjä",
        p: [`${LEGAL_OWNER}, sähköposti ${LEGAL_EMAIL}. Ota yhteyttä tähän osoitteeseen kaikissa tietosuojaan liittyvissä asioissa.`],
      },
      {
        h: "2. Mitä tietoja käsittelemme ja miksi",
        table: {
          head: ["Tieto", "Tarkoitus", "Peruste", "Säilytys"],
          rows: [
            [
              "Hakemasi osoite tai kaupunki",
              "Osoitehaku ja etäisyyksien laskeminen. Hakuteksti välitetään palvelimeltamme osoitehakupalvelulle (ks. kohta 3).",
              "Oikeutettu etu: pyytämäsi toiminnon toteuttaminen",
              "Palvelimen muistissa enintään 24 h nopeuttamaan samoja hakuja. Ei tallenneta tietokantaan.",
            ],
            [
              "Sijaintisi (vain jos painat ”Käytä sijaintiani” ja selain sallii)",
              "Lähimpien salien näyttäminen ja osoitteen hakeminen koordinaateista",
              "Suostumus (selaimen lupa)",
              "Koordinaatit pyöristetään ja pidetään palvelimen muistissa enintään 24 h. Valittu sijainti tallentuu vain laitteellesi.",
            ],
            [
              "Suosikit ja valittu sijainti",
              "Suosikkien ja sijainnin muistaminen",
              "Oikeutettu etu: pyytämäsi toiminto",
              "Vain omalla laitteellasi (selaimen localStorage), kunnes poistat ne",
            ],
            [
              "Palautelomake: viesti, salin tiedot, kieli, lähetysaika ja vapaaehtoinen sähköposti",
              "Uusien salien lisääminen, virheiden korjaaminen ja tarvittaessa vastaaminen",
              "Oikeutettu etu; sähköpostin osalta suostumus",
              "Enintään 24 kuukautta, tai poistetaan pyynnöstäsi aiemmin",
            ],
            [
              "Tekniset tiedot: IP-osoite, selain, pyydetty sivu ja aika",
              "Palvelun toimittaminen, väärinkäytösten esto (pyyntörajoitus) ja vianetsintä",
              "Oikeutettu etu: palvelun turvallisuus ja toimivuus",
              "Pyyntörajoitus muistissa 1 minuutin. Palveluntarjoajien lokit niiden omien käytäntöjen mukaan.",
            ],
            [
              "Analytiikka (Google Analytics 4): käydyt sivut, laite- ja selaintiedot, karkea sijainti",
              "Palvelun käytön ymmärtäminen ja kehittäminen",
              "Suostumus. Käytössä vain, jos sallit analytiikan evästeasetuksista.",
              "Evästeet enintään 2 vuotta (ks. Evästeet). Googlen säilytysaika Google Analyticsin asetusten mukaan.",
            ],
          ],
        },
        p: [
          "Emme pyydä nimeä emmekä luo käyttäjätilejä. Emme myy tietoja emmekä käytä niitä mainonnan kohdentamiseen. Palvelussa ei tehdä automaattisia päätöksiä tai profilointia, jolla olisi oikeusvaikutuksia sinuun.",
        ],
      },
      {
        h: "3. Kenelle tietoja välittyy",
        p: ["Käytämme seuraavia palveluntarjoajia. Ne käsittelevät tietoja vain palvelun toimittamiseksi."],
        list: [
          "Cloudflare, Inc.: sivuston jakelu, välimuisti ja tietoturva (IP-osoite ja pyynnöt)",
          "Render Services, Inc.: palvelimen (API) ylläpito",
          "Neon, Inc.: tietokanta, johon palautteet tallennetaan",
          "Osoitehaku: Digitransit (HSL / Fintraffic), Photon (komoot GmbH) ja Nominatim (OpenStreetMap Foundation). Ne saavat hakutekstin tai pyöristetyt koordinaatit palvelimeltamme, eivät IP-osoitettasi.",
          "CARTO (CartoDB, Inc.): karttapohja. Selaimesi lataa kartan suoraan CARTOn palvelimelta, jolloin CARTO näkee IP-osoitteesi.",
          "Google Fonts (Google Ireland Ltd): fontti ladataan Googlen palvelimelta, jolloin Google näkee IP-osoitteesi.",
          "Google Analytics (Google Ireland Ltd): vain suostumuksella. Google Analytics 4 ei tallenna IP-osoitteita.",
        ],
      },
      {
        h: "4. Siirrot EU:n ulkopuolelle",
        p: [
          "Osa palveluntarjoajista (esim. Cloudflare, Render, Neon, CARTO ja Google) voi käsitellä tietoja Yhdysvalloissa tai muualla EU:n ja ETA-alueen ulkopuolella. Siirrot perustuvat EU:n ja Yhdysvaltojen väliseen tietosuojakehykseen (EU–US Data Privacy Framework) tai Euroopan komission vakiosopimuslausekkeisiin.",
        ],
      },
      {
        h: "5. Oikeutesi",
        p: ["Sinulla on oikeus:"],
        list: [
          "saada tieto siitä, käsittelemmekö sinua koskevia tietoja, ja saada kopio niistä",
          "pyytää virheellisten tietojen korjaamista",
          "pyytää tietojen poistamista tai käsittelyn rajoittamista",
          "vastustaa oikeutettuun etuun perustuvaa käsittelyä",
          "peruuttaa suostumuksesi milloin tahansa, esim. analytiikan evästeasetuksista (peruutus ei vaikuta aiempaan käsittelyyn)",
          "tehdä valitus valvontaviranomaiselle: Tietosuojavaltuutetun toimisto, tietosuoja.fi",
        ],
      },
      {
        h: "6. Laitteellesi tallennetut tiedot",
        p: [
          "Suosikit, valittu sijainti ja evästevalintasi tallentuvat vain selaimesi muistiin (localStorage). Voit poistaa ne tyhjentämällä sivuston tiedot selaimen asetuksista. Tarkempi luettelo on Evästeet-sivulla.",
        ],
      },
      {
        h: "7. Muutokset",
        p: ["Päivitämme tätä selostetta, kun palvelu tai sen käyttämät palveluntarjoajat muuttuvat. Päivityspäivä näkyy sivun ylälaidassa."],
      },
    ],
  },

  cookies: {
    title: "Evästeet",
    updated,
    intro:
      "Evästeet ovat pieniä tekstitiedostoja, jotka sivusto tallentaa selaimeesi. Liikux käyttää lisäksi selaimen paikallista tallennustilaa (localStorage). Alla on kaikki, mitä sivusto tallentaa laitteellesi.",
    sections: [
      {
        h: "Välttämättömät (aina käytössä)",
        p: ["Nämä tarvitaan, jotta pyytämäsi toiminnot toimivat. Ne tallentuvat vain laitteellesi eivätkä lähde meille tai kolmansille osapuolille."],
        table: {
          head: ["Nimi", "Tyyppi", "Tarkoitus", "Kesto"],
          rows: [
            ["liikux-cookie-consent", "localStorage", "Muistaa evästevalintasi", "Kunnes muutat valintaa tai tyhjennät selaimen tiedot"],
            ["liikux-favorites", "localStorage", "Suosikkisalisi", "Kunnes poistat suosikit"],
            ["liikux-location", "localStorage", "Viimeksi valittu osoite tai kaupunki", "Kunnes vaihdat sijaintia tai tyhjennät tiedot"],
          ],
        },
      },
      {
        h: "Analytiikka (vain suostumuksella)",
        p: [
          "Jos sallit analytiikan, sivu lataa Google Analytics 4:n. Ilman suostumusta näitä evästeitä ei aseteta. Kun peruutat suostumuksen, sivu poistaa evästeet.",
        ],
        table: {
          head: ["Nimi", "Tyyppi", "Tarkoitus", "Kesto"],
          rows: [
            ["_ga", "Eväste (Google)", "Erottaa käyttäjät toisistaan tilastoja varten", "2 vuotta"],
            ["_ga_<tunnus>", "Eväste (Google)", "Säilyttää istunnon tilan", "2 vuotta"],
          ],
        },
      },
      {
        h: "Toiminnalliset",
        p: ["Evästeasetuksissa on valinta toiminnallisille evästeille. Tällä hetkellä Liikux ei käytä yhtään toiminnallista evästettä; valinta on varattu tuleville ominaisuuksille. Jos sellaisia otetaan käyttöön, ne lisätään tähän luetteloon."],
      },
      {
        h: "Kolmansien osapuolten sisältö",
        p: [
          "Kartta (CARTO) ja fontti (Google Fonts) ladataan näiden palveluiden palvelimilta, jolloin ne saavat IP-osoitteesi. Ne eivät aseta evästeitä Liikuxin kautta. Lisää tietoa on tietosuojaselosteessa.",
        ],
      },
      {
        h: "Näin muutat valintojasi",
        p: [
          "Voit muuttaa valintaasi milloin tahansa sivun alaosan Evästeasetukset-linkistä. Voit myös poistaa kaikki sivuston tiedot selaimen asetuksista. Silloin myös suosikit ja valittu sijainti poistuvat.",
        ],
      },
    ],
  },
};
