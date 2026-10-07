import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { langFromPath, type Lang } from "./lang";
import { t, type MessageKey } from "./messages";

export function useLang() {
  const { pathname } = useLocation();
  const lang: Lang = langFromPath(pathname);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function tr(key: MessageKey, vars?: Record<string, string | number>) {
    return t(lang, key, vars);
  }

  return { lang, t: tr };
}
