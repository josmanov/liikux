import { useEffect } from "react";

type PageMeta = {
  title: string;
  description: string;
  path?: string;
};

function ensureMeta(name: string, attr: "name" | "property" = "name") {
  let el = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  return el;
}

function ensureLink(rel: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  return el as HTMLLinkElement;
}

export function usePageMeta({ title, description, path }: PageMeta) {
  useEffect(() => {
    document.title = title;
    ensureMeta("description").setAttribute("content", description);
    ensureMeta("og:title", "property").setAttribute("content", title);
    ensureMeta("og:description", "property").setAttribute(
      "content",
      description,
    );
    const canonical = ensureLink("canonical");
    const href = path
      ? `https://liikux.fi${path}`
      : `https://liikux.fi${window.location.pathname}`;
    canonical.href = href;
  }, [title, description, path]);
}
