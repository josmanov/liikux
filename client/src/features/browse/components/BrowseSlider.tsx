import { useEffect, useRef, useState } from "react";

/**
 * A slider with one or two thumbs, driven by pointer events (so it works the
 * same with a finger, a mouse and a pen; the native <input type="range"> with
 * overlapping thumbs does not take touch on phones).
 *
 * - Drag anywhere on the track: the nearest thumb follows the finger.
 * - The thumbs move instantly (local state); the page is told once per frame.
 * - Arrow keys / Home / End work when a thumb has focus.
 */
type Props = {
  min: number;
  max: number;
  step: number;
  /** One value = a single thumb; two values = a range (low, high). */
  values: number[];
  onChange: (index: number, value: number) => void;
  labels: string[];
};

const EDGE = 14; // half a thumb: the thumb centre stays this far from the ends

export function BrowseSlider({ min, max, step, values, onChange, labels }: Props) {
  const [local, setLocal] = useState(values);
  const dragging = useRef<number | null>(null);
  const frame = useRef<number | null>(null);
  const pending = useRef<{ i: number; v: number } | null>(null);
  const box = useRef<HTMLDivElement | null>(null);

  // follow the page when it changes the values (not while a finger is down)
  useEffect(() => {
    if (dragging.current == null) setLocal(values);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.join("|")]);

  function snap(v: number) {
    const stepped = Math.round((v - min) / step) * step + min;
    return Math.min(max, Math.max(min, stepped));
  }

  function valueAt(clientX: number) {
    const r = box.current!.getBoundingClientRect();
    const usable = Math.max(1, r.width - EDGE * 2);
    const f = Math.min(1, Math.max(0, (clientX - r.left - EDGE) / usable));
    return snap(min + f * (max - min));
  }

  function commit(i: number, v: number) {
    pending.current = { i, v };
    if (frame.current != null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const p = pending.current;
      pending.current = null;
      if (p) onChange(p.i, p.v);
    });
  }

  function move(i: number, raw: number) {
    // a range thumb cannot pass the other one
    let v = raw;
    if (local.length === 2) v = i === 0 ? Math.min(raw, local[1]) : Math.max(raw, local[0]);
    if (local[i] === v) return;
    setLocal((cur) => cur.map((x, k) => (k === i ? v : x)));
    commit(i, v);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const target = valueAt(e.clientX);
    let i = 0;
    if (local.length === 2) {
      const d0 = Math.abs(local[0] - target);
      const d1 = Math.abs(local[1] - target);
      // equal distance (both at the same end): pick the thumb that can move that way
      i = d0 < d1 ? 0 : d1 < d0 ? 1 : target < local[0] ? 0 : 1;
    }
    dragging.current = i;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    move(i, target);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (dragging.current == null) return;
    move(dragging.current, valueAt(e.clientX));
  }

  function end(e: React.PointerEvent) {
    if (dragging.current == null) return;
    dragging.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  }

  function onKey(i: number, e: React.KeyboardEvent) {
    const cur = local[i];
    let v: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") v = cur + step;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") v = cur - step;
    else if (e.key === "Home") v = min;
    else if (e.key === "End") v = max;
    if (v == null) return;
    e.preventDefault();
    move(i, snap(v));
  }

  const span = max - min || 1;
  const frac = (v: number) => (v - min) / span;
  const from = local.length === 2 ? frac(local[0]) : 0;
  const to = frac(local[local.length - 1]);
  const pos = (f: number) => `calc(${EDGE}px + (100% - ${EDGE * 2}px) * ${f})`;

  return (
    <div
      className="browse-dual browse-slider"
      ref={box}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <div className="browse-dual-rail">
        <div
          className="browse-dual-fill"
          style={{ left: `${from * 100}%`, width: `${Math.max(0, to - from) * 100}%` }}
        />
      </div>
      {local.map((v, i) => (
        <div
          key={i}
          className="browse-slider-thumb"
          role="slider"
          tabIndex={0}
          aria-label={labels[i]}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={v}
          style={{ left: pos(frac(v)), zIndex: dragging.current === i ? 6 : 3 + i }}
          onKeyDown={(e) => onKey(i, e)}
        />
      ))}
    </div>
  );
}
