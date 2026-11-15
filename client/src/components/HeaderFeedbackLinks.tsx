import { Link } from "react-router-dom";
import { MessageSquarePlus, TriangleAlert } from "lucide-react";
import { pathFeedback } from "../i18n/lang";
import { useLang } from "../i18n/useLang";
import "./HeaderFeedbackLinks.css";

/**
 * Two simple buttons on the right side of the header:
 * "Puuttuuko sali?" and "Ilmoita virheestä". Both open the feedback page.
 * On phones they are hidden here and shown in the menu instead (Header.tsx).
 */
function HeaderFeedbackLinks() {
  const { lang, t } = useLang();
  return (
    <>
      <Link to={pathFeedback(lang, "suggest")} className="header-fb-btn" title={t("headerMissingGym")}>
        <MessageSquarePlus size={16} strokeWidth={2.3} aria-hidden="true" />
        <span>{t("headerMissingGym")}</span>
      </Link>
      <Link to={pathFeedback(lang, "error")} className="header-fb-btn" title={t("reportError")}>
        <TriangleAlert size={16} strokeWidth={2.3} aria-hidden="true" />
        <span>{t("reportError")}</span>
      </Link>
    </>
  );
}

export default HeaderFeedbackLinks;
