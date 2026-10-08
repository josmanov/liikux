import { useEffect } from "react";

const SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
]);

let lockCount = 0;
let attached = false;
let lastTouchY = 0;
let lockedY = 0;

function canScroll(el: HTMLElement, dy: number) {
  const max = el.scrollHeight - el.clientHeight;
  if (max <= 1) return false;
  if (dy < 0) return el.scrollTop > 0;
  if (dy > 0) return el.scrollTop < max - 1;
  return true;
}

function allowInsideScroller(target: EventTarget | null, dy: number) {
  let node: HTMLElement | null =
    target instanceof HTMLElement
      ? target
      : target instanceof Element
        ? target.parentElement
        : null;

  while (node && node !== document.body && node !== document.documentElement) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      canScroll(node, dy)
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
}

function onWheel(e: WheelEvent) {
  if (allowInsideScroller(e.target, e.deltaY)) return;
  e.preventDefault();
}

function onTouchStart(e: TouchEvent) {
  lastTouchY = e.touches[0]?.clientY ?? 0;
}

function onTouchMove(e: TouchEvent) {
  const y = e.touches[0]?.clientY ?? 0;
  const dy = lastTouchY - y;
  lastTouchY = y;
  if (allowInsideScroller(e.target, dy)) return;
  e.preventDefault();
}

function onKeyDown(e: KeyboardEvent) {
  if (!SCROLL_KEYS.has(e.key)) return;
  const t = e.target;
  if (
    t instanceof HTMLElement &&
    (t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.tagName === "SELECT" ||
      t.isContentEditable)
  ) {
    return;
  }
  const dy =
    e.key === "ArrowUp" || e.key === "PageUp" || e.key === "Home" ? -1 : 1;
  if (allowInsideScroller(t, dy)) return;
  e.preventDefault();
}

function onScroll() {
  if (window.scrollY !== lockedY) {
    window.scrollTo(0, lockedY);
  }
}

function attach() {
  if (attached) return;
  attached = true;
  lockedY = window.scrollY;
  window.addEventListener("wheel", onWheel, { passive: false });
  window.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("scroll", onScroll);
}

function detach() {
  if (!attached) return;
  attached = false;
  window.removeEventListener("wheel", onWheel);
  window.removeEventListener("touchstart", onTouchStart);
  window.removeEventListener("touchmove", onTouchMove);
  window.removeEventListener("keydown", onKeyDown);
  window.removeEventListener("scroll", onScroll);
}

export function useLockPageScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    lockCount += 1;
    attach();
    return () => {
      lockCount -= 1;
      if (lockCount <= 0) {
        lockCount = 0;
        detach();
      }
    };
  }, [locked]);
}
