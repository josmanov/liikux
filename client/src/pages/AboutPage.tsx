import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, MessageSquarePlus, TriangleAlert } from "lucide-react";
import { fetchHomeStats, type HomeStats } from "../data/api";
import { ABOUT } from "../features/about/content";
import { pathFeedback, pathGyms } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import { usePageMeta } from "../seo/usePageMeta";
import "./AboutPage.css";

/**
 * /fi/tietoa and /en/about
 *
 *   1. Title, lead and three live numbers (from /api/stats)
 *   2. Left: "where the data comes from" in three steps
 *      Right: common questions (click a question to open it)
 *   3. Links: suggest a gym, report an error
 *
 * The texts live in features/about/content.ts.
 */
function AboutPage() {
  const { lang } = useLang();
  const { pathname } = useLocation();
  const text = ABOUT[lang];
  const [stats, setStats] = useState<HomeStats | null>(null);

  usePageMeta({ title: text.metaTitle, description: text.metaDescription, path: pathname });

  useEffect(() => {
    let alive = true;
    void fetchHomeStats().then((s) => {
      if (alive && s.gymCount > 0) setStats(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const number = (n: number) => n.toLocaleString(lang === "fi" ? "fi-FI" : "en-GB");

  return (
    <main className="about">
      <header className="about-head">
        <h1 className="about-title">{text.title}</h1>
        <p className="about-lead">{text.lead}</p>
      </header>

      {stats ? (
        <dl className="about-stats">
          <div>
            <dd>{number(stats.gymCount)}</dd>
            <dt>{text.stats.gyms}</dt>
          </div>
          <div>
            <dd>{number(stats.cityCount)}</dd>
            <dt>{text.stats.cities}</dt>
          </div>
          <div>
            <dd>{number(stats.chainCount)}</dd>
            <dt>{text.stats.chains}</dt>
          </div>
        </dl>
      ) : null}

      <div className="about-grid">
        <section aria-labelledby="about-steps">
          <h2 id="about-steps" className="about-h">
            {text.stepsTitle}
          </h2>
          <ol className="about-steps">
            {text.steps.map((step, i) => (
              <li key={step.h}>
                <span className="about-step-n" aria-hidden="true">
                  {i + 1}
                </span>
                <div>
                  <h3>{step.h}</h3>
                  <p>{step.p}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="about-faq">
          <h2 id="about-faq" className="about-h">
            {text.faqTitle}
          </h2>
          <div className="about-faq">
            {text.faq.map((item, i) => (
              <details key={item.q} open={i === 0}>
                <summary>
                  {item.q}
                  <ChevronDown size={18} strokeWidth={2.4} aria-hidden="true" />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <section className="about-help">
        <div>
          <h2>{text.helpTitle}</h2>
          <p>{text.helpLead}</p>
        </div>
        <div className="about-help-actions">
          <Link className="btn btn-primary" to={pathFeedback(lang, "suggest")}>
            <MessageSquarePlus size={17} strokeWidth={2.4} aria-hidden="true" />
            {text.suggest}
          </Link>
          <Link className="btn btn-soft" to={pathFeedback(lang, "error")}>
            <TriangleAlert size={17} strokeWidth={2.4} aria-hidden="true" />
            {text.report}
          </Link>
          <Link className="btn btn-ghost" to={pathGyms(lang)}>
            {text.browse}
          </Link>
        </div>
      </section>
    </main>
  );
}

export default AboutPage;
