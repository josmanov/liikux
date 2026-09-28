import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

function scrollTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    scrollTop();
    const id = window.requestAnimationFrame(() => {
      scrollTop();
    });
    return () => window.cancelAnimationFrame(id);
  }, [pathname]);

  return null;
}

export default ScrollToTop;
