import { Link } from "react-router-dom";
import { pathHome } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import "./PagePlaceholder.css";

function NotFoundPage() {
  const { lang, t } = useLang();
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
