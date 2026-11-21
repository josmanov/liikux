import { previewOn } from "../data/apiBase";
import "./PreviewBanner.css";

/**
 * Shown on every page while preview mode is on (started from /admin/tarkistus).
 * The site then shows the data that still waits for review, as if it were
 * approved. Nothing is saved and visitors see nothing of it.
 */
export default function PreviewBanner() {
  if (!previewOn()) return null;

  function stop(path: string) {
    try {
      sessionStorage.removeItem("liikux-preview");
    } catch {
      /* ignore */
    }
    window.location.href = path;
  }

  return (
    <div className="preview-banner" role="status">
      <strong>ESIKATSELU</strong>
      <span>Näet koko sivuston sellaisena kuin se olisi, kun hyväksyt kaikki odottavat muutokset. Mikään ei ole julkinen.</span>
      <button type="button" onClick={() => stop("/admin/tarkistus")}>
        Takaisin tarkistukseen
      </button>
      <button type="button" className="is-quiet" onClick={() => stop("/")}>
        Lopeta esikatselu
      </button>
    </div>
  );
}
