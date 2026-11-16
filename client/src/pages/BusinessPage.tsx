import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Mail, Minus, PencilLine } from "lucide-react";
import { fetchHomeStats, type HomeStats } from "../data/api";
import { BUSINESS } from "../features/business/content";
import { pathFeedback } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import { usePageMeta } from "../seo/usePageMeta";
import "./BusinessPage.css";

/**
 * /fi/yrityksille and /en/for-gyms: the page for gym owners and chains.
 *
 *   1. Head + three live numbers (from /api/stats)
 *   2. Three cards: correct details, visitor numbers, extra visibility
 *   3. "What we do not do" + a contact band (opens the feedback form)
 *
 * The texts live in features/business/content.ts.
 */
function BusinessPage() {
  const { lang } = useLang();
  const { pathname } = useLocation();
  const text = BUSINESS[lang];
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
    <main className="biz load-reveal">
      <header className="biz-head">
        <div>
          <p className="biz-eyebrow">{text.eyebrow}</p>
          <h1 className="biz-title">{text.title}</h1>
          <p className="biz-lead">{text.lead}</p>
        </div>
        {stats ? (
          <dl className="biz-stats">
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
      </header>

      <ul className="biz-cards">
        {text.cards.map((card, i) => (
          <li key={card.h} className={i === 2 ? "is-planned" : ""}>
            <span className="biz-tag">{card.tag}</span>
            <h2>{card.h}</h2>
            <p>{card.p}</p>
          </li>
        ))}
      </ul>

      <div className="biz-bottom">
        <section className="biz-not">
          <h2>{text.howTitle}</h2>
          <ul>
            {text.how.map((line) => (
              <li key={line}>
                <Minus size={16} strokeWidth={2.6} aria-hidden="true" />
                {line}
              </li>
            ))}
          </ul>
        </section>

        <section className="biz-contact">
          <h2>{text.contactTitle}</h2>
          <p>{text.contactLead}</p>
          <div className="biz-actions">
            <Link className="btn btn-primary" to={pathFeedback(lang, "business")}>
              <Mail size={17} strokeWidth={2.4} aria-hidden="true" />
              {text.contact}
            </Link>
            <Link className="btn btn-soft" to={pathFeedback(lang, "error")}>
              <PencilLine size={17} strokeWidth={2.4} aria-hidden="true" />
              {text.fix}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

export default BusinessPage;
