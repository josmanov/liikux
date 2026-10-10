import { Link, Navigate, useLocation } from "react-router-dom";
import { pathHome, type Lang } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import "./LegalPage.css";

type LegalSlug = "terms" | "privacy" | "cookies";

const FI_TO_SLUG: Record<string, LegalSlug> = {
  kayttoehdot: "terms",
  tietosuoja: "privacy",
  evasteet: "cookies",
};

const EN_TO_SLUG: Record<string, LegalSlug> = {
  terms: "terms",
  privacy: "privacy",
  cookies: "cookies",
};

const COPY: Record<
  Lang,
  Record<LegalSlug, { title: string; updated: string; paragraphs: string[] }>
> = {
  fi: {
    terms: {
      title: "Käyttöehdot",
      updated: "Päivitetty 10.10.2026",
      paragraphs: [
        "Liikux on kuntosalihakemisto. Palvelun avulla voit selata ja etsiä kuntosaleja Suomessa.",
        "Sivuston tiedot ovat suuntaa-antavia. Hinnat, aukioloajat ja palvelut voivat muuttua. Varmista tärkeät tiedot aina salin omilta sivuilta.",
        "Et voi käyttää palvelua tavalla, joka häiritsee sen toimintaa tai loukkaa lakeja.",
        "Voimme päivittää näitä ehtoja tarvittaessa. Jatkamalla käyttöä hyväksyt päivitetyt ehdot.",
      ],
    },
    privacy: {
      title: "Tietosuoja",
      updated: "Päivitetty 10.10.2026",
      paragraphs: [
        "Kunnioitamme yksityisyyttäsi. Keräämme vain sen verran tietoa, että palvelu toimii hyvin.",
        "Voimme käsitellä esimerkiksi sijaintia tai osoitetta, jonka annat etäisyyksiä varten, sekä teknisiä lokitietoja palvelun ylläpitoon.",
        "Suosikit ja kielivalinta tallentuvat laitteellesi. Analytiikkaa käytetään vain, jos annat siihen evästesuostumuksen.",
        "Jos sinulla on kysyttävää tietosuojasta, ota yhteyttä: hello@liikux.fi.",
      ],
    },
    cookies: {
      title: "Evästeet",
      updated: "Päivitetty 10.10.2026",
      paragraphs: [
        "Käytämme evästeitä ja vastaavia tekniikoita, jotta sivusto toimii ja käyttökokemus paranee.",
        "Pakolliset evästeet pitävät perustoiminnot kunnossa, kuten kielivalinnan ja suosikit.",
        "Toiminnalliset ja analytiikkaevästeet ovat valinnaisia. Voit muuttaa valintojasi milloin tahansa evästeasetuksista.",
        "Lisää tietoja löydät tietosuojasta. Evästeasetukset aukeavat footerin Evästeasetukset-linkistä.",
      ],
    },
  },
  en: {
    terms: {
      title: "Terms of use",
      updated: "Updated 10 Oct 2026",
      paragraphs: [
        "Liikux is a gym directory. You can browse and find gyms in Finland.",
        "Information on the site is indicative. Prices, hours and services may change. Always confirm important details on the gym’s own website.",
        "Do not use the service in a way that disrupts it or breaks the law.",
        "We may update these terms when needed. By continuing to use the service, you accept the updated terms.",
      ],
    },
    privacy: {
      title: "Privacy",
      updated: "Updated 10 Oct 2026",
      paragraphs: [
        "We respect your privacy. We only collect what we need for the service to work well.",
        "We may process things like a location or address you enter for distances, and technical logs needed to run the site.",
        "Favorites and language preference are stored on your device. Analytics run only if you allow them in cookie settings.",
        "Questions about privacy? Contact us at hello@liikux.fi.",
      ],
    },
    cookies: {
      title: "Cookies",
      updated: "Updated 10 Oct 2026",
      paragraphs: [
        "We use cookies and similar tech so the site works and stays useful.",
        "Necessary cookies keep basic features working, like language and favorites.",
        "Functional and analytics cookies are optional. You can change your choices anytime in cookie settings.",
        "See also our privacy page. Open cookie settings from the Cookie settings link in the footer.",
      ],
    },
  },
};

function resolveSlug(lang: Lang, pathname: string): LegalSlug | null {
  const part = pathname.split("/").filter(Boolean)[1] || "";
  const map = lang === "en" ? EN_TO_SLUG : FI_TO_SLUG;
  return map[part] ?? null;
}

function LegalPage() {
  const { lang, t } = useLang();
  const { pathname } = useLocation();
  const key = resolveSlug(lang, pathname);

  if (!key) {
    return <Navigate to={pathHome(lang)} replace />;
  }

  const page = COPY[lang][key];

  return (
    <main className="legal-page load-reveal">
      <div className="legal-page-inner">
        <p className="legal-page-updated">{page.updated}</p>
        <h1 className="legal-page-title">{page.title}</h1>
        <div className="legal-page-body">
          {page.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
        <Link className="legal-page-back" to={pathHome(lang)}>
          {t("backHome")}
        </Link>
      </div>
    </main>
  );
}

export default LegalPage;
