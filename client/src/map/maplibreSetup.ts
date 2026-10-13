import { setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";

setWorkerUrl(workerUrl);

type ResizableMap = { resize: () => void };

function containerHasSize(el: HTMLElement, minSize: number) {
  return el.clientWidth >= minSize && el.clientHeight >= minSize;
}

export function waitForMapContainerSize(
  container: HTMLElement,
  map: ResizableMap,
  opts?: { timeoutMs?: number; minSize?: number },
): Promise<void> {
  const timeoutMs = opts?.timeoutMs ?? 2500;
  const minSize = opts?.minSize ?? 2;

  return new Promise((resolve) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      ro.disconnect();
      map.resize();
      resolve();
    };

    const trySettle = () => {
      if (!containerHasSize(container, minSize)) return;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          map.resize();
          if (containerHasSize(container, minSize)) finish();
        });
      });
    };

    const ro = new ResizeObserver(() => {
      map.resize();
      trySettle();
    });
    ro.observe(container);

    const timer = window.setTimeout(finish, timeoutMs);
    map.resize();
    trySettle();
  });
}

export function observeMapContainerResize(
  container: HTMLElement,
  map: ResizableMap,
): () => void {
  const onResize = () => {
    map.resize();
  };
  const ro = new ResizeObserver(() => {
    requestAnimationFrame(onResize);
  });
  ro.observe(container);
  window.addEventListener("resize", onResize);
  return () => {
    ro.disconnect();
    window.removeEventListener("resize", onResize);
  };
}

export async function fetchGeoJson(path: string): Promise<unknown | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("text/html")) return null;
    const text = await res.text();
    const trimmed = text.trim();
    if (!trimmed || trimmed.startsWith("<")) return null;
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}
