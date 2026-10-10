import { Link } from "react-router-dom";
import { pathHome } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import { usePageMeta } from "../seo/usePageMeta";
import "./PagePlaceholder.css";

function NotFoundPage() {
  const { lang, t } = useLang();
  usePageMeta({
    title: lang === "fi" ? "Sivua ei löytynyt | Liikux" : "Page not found | Liikux",
    description:
      lang === "fi"
        ? "Hakemaasi sivua ei löytynyt."
        : "The page you were looking for was not found.",
  });
  return (
    <main className="page">
      <h1>{t("notFoundTitle")}</h1>
      <p>{t("notFoundText")}</p>
      <Link className="page-back" to={pathHome(lang)}>
        {t("backHome")}
      </Link>
    </main>
  );
}

export default NotFoundPage;
