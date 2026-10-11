import { useEffect } from "react";

type PageMeta = {
  title: string;
  description: string;
  path?: string;
  image?: string;
};

const DEFAULT_OG = "https://liikux.fi/og-liikux.png?v=2";

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

export function usePageMeta({ title, description, path, image }: PageMeta) {
  useEffect(() => {
    document.title = title;
    ensureMeta("description").setAttribute("content", description);
    ensureMeta("og:title", "property").setAttribute("content", title);
    ensureMeta("og:description", "property").setAttribute(
      "content",
      description,
    );
    ensureMeta("og:type", "property").setAttribute("content", "website");
    ensureMeta("og:site_name", "property").setAttribute("content", "Liikux");
    const href = path
      ? `https://liikux.fi${path}`
      : `https://liikux.fi${window.location.pathname}`;
    ensureMeta("og:url", "property").setAttribute("content", href);
    const ogImage = image || DEFAULT_OG;
    ensureMeta("og:image", "property").setAttribute("content", ogImage);
    ensureMeta("twitter:card").setAttribute("content", "summary_large_image");
    ensureMeta("twitter:title").setAttribute("content", title);
    ensureMeta("twitter:description").setAttribute("content", description);
    ensureMeta("twitter:image").setAttribute("content", ogImage);
    const canonical = ensureLink("canonical");
    canonical.href = href;
  }, [title, description, path, image]);
}
