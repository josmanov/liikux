import { useEffect, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

/**
 * "Back" that goes where you really came from.
 *
 * <NavTracker /> remembers, for every step in this tab's history, the
 * address (with its ?filters) and the page title. <BackLink> then points to
 * the previous step and uses the browser's own back, so the browse page comes
 * back with the same filters, area and page. Without an earlier step (link
 * opened directly), it goes to the fallback.
 */

const KEY = "liikux-nav-steps";

type Step = { path: string; label: string };

function readSteps(): Record<string, Step> {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "{}") as Record<string, Step>;
  } catch {
    return {};
  }
}

function writeSteps(steps: Record<string, Step>) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(steps));
  } catch {
    /* private mode: back falls back to the default target */
  }
}

/** react-router keeps the position in history.state.idx. */
function historyIndex(): number {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  return typeof idx === "number" ? idx : 0;
}

/** "Fressi Kamppi, Helsinki – hinnat ja aukiolo | Liikux" → "Fressi Kamppi, Helsinki" */
function shortTitle(title: string) {
  const first = title.split(/\s[–|-]\s|\s\|\s/)[0]?.trim() ?? "";
  return first.length > 48 ? `${first.slice(0, 46)}…` : first;
}

export function NavTracker() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    const idx = String(historyIndex());
    const path = pathname + search;
    const steps = readSteps();
    steps[idx] = { path, label: steps[idx]?.path === path ? steps[idx].label : "" };
    writeSteps(steps);
    // Pages set their title after loading their data: read it a moment later.
    const timer = window.setTimeout(() => {
      const now = readSteps();
      if (now[idx]?.path === path) {
        now[idx] = { path, label: shortTitle(document.title) };
        writeSteps(now);
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [pathname, search]);

  return null;
}

type BackLinkProps = {
  /** Where to go when this page was opened directly. */
  fallbackTo: string;
  fallbackLabel: ReactNode;
  className?: string;
  children?: (label: ReactNode) => ReactNode;
};

export function BackLink({ fallbackTo, fallbackLabel, className, children }: BackLinkProps) {
  const navigate = useNavigate();
  const idx = historyIndex();
  const prev = idx > 0 ? readSteps()[String(idx - 1)] : undefined;
  const label: ReactNode = prev ? prev.label || fallbackLabel : fallbackLabel;

  return (
    <Link
      className={className}
      to={prev?.path ?? fallbackTo}
      onClick={(e) => {
        if (!prev || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(-1);
      }}
    >
      {children ? children(label) : label}
    </Link>
  );
}
