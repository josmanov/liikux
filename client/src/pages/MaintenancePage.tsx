import { useState } from "react";
import "flag-icons/css/flag-icons.min.css";
import "./MaintenancePage.css";

type Lang = "fi" | "en";

const copy = {
  fi: {
    eyebrow: "Huoltotauko",
    title: "Palaamme pian",
    text: "Päivitämme sivua juuri nyt. Yritämme tuoda Liikuxin takaisin mahdollisimman pian.",
    switchLang: "Vaihda englantiin",
  },
  en: {
    eyebrow: "Under maintenance",
    title: "We'll be back soon",
    text: "We're updating the site right now. We're working to bring Liikux back as soon as possible.",
    switchLang: "Switch to Finnish",
  },
} as const;

function MaintenancePage() {
  const [lang, setLang] = useState<Lang>(() => {
    const path = window.location.pathname;
    if (path === "/en" || path.startsWith("/en/")) return "en";
    return "fi";
  });
  const t = copy[lang];
  const nextLang: Lang = lang === "fi" ? "en" : "fi";

  return (
    <main className="maintenance">
      <div className="maintenance-bg" aria-hidden="true" />
      <div className="maintenance-inner">
        <img
          className="maintenance-logo"
          src="/liikux-logo-light.png?v=3"
          alt="Liikux"
        />
        <p className="maintenance-eyebrow">{t.eyebrow}</p>
        <h1 className="maintenance-title">{t.title}</h1>
        <p className="maintenance-text">{t.text}</p>
        <button
          type="button"
          className="maintenance-lang"
          aria-label={t.switchLang}
          title={t.switchLang}
          onClick={() => setLang(nextLang)}
        >
          <span className={nextLang === "en" ? "fi fi-gb" : "fi fi-fi"} />
        </button>
      </div>
    </main>
  );
}

export default MaintenancePage;
