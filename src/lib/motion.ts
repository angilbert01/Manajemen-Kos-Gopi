import { useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent } from 'react';

export function easeOutCubic(t: number) {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

/** Nilai count-up pada waktu `elapsed` ms dari `from` ke `to` selama `ms` ms. */
export function countValue(from: number, to: number, elapsed: number, ms: number) {
  if (ms <= 0 || elapsed >= ms) return to;
  return from + (to - from) * easeOutCubic(elapsed / ms);
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Angka yang beranimasi naik ke `target`; langsung final bila pengguna memilih kurangi gerakan. */
export function useCountUp(target: number, ms = 800) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const fromRef = useRef(value);

  useEffect(() => {
    const from = fromRef.current;
    const duration = prefersReducedMotion() ? 0 : ms;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const v = countValue(from, target, now - start, duration);
      fromRef.current = v;
      setValue(v);
      if (v !== target) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);

  // Kurangi gerakan: tampilkan nilai final di render yang sama, tanpa menunggu frame animasi.
  return prefersReducedMotion() ? target : value;
}

/** Tilt 3D halus mengikuti kursor (mouse saja). Memakai CSS var --rx, --ry, --gx, --gy pada elemen. */
export function useTilt<T extends HTMLElement>(max = 6) {
  const ref = useRef<T>(null);

  const onPointerMove = useCallback(
    (e: PointerEvent<T>) => {
      const el = ref.current;
      if (!el || e.pointerType !== 'mouse' || prefersReducedMotion()) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--rx', `${((0.5 - py) * 2 * max).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${((px - 0.5) * 2 * max).toFixed(2)}deg`);
      el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
    },
    [max],
  );

  const onPointerLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}

/** Kelas animasi masuk; padukan dengan stagger(i) untuk kartu di grid. */
export const enterClass =
  'fill-mode-both motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300';

/** Delay masuk berurutan 40ms per item, dibatasi 8 item agar grid panjang tidak terasa lambat. */
export function stagger(i: number) {
  return { animationDelay: `${Math.min(i, 8) * 40}ms` };
}
