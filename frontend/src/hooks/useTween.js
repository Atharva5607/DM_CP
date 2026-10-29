import { useEffect, useRef, useState } from 'react';
import { easeOut } from '../utils/geometry';

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animates a number toward `target` (count-ups, gauge sweeps). Respects reduced motion. */
export function useTween(target, ms = 800, from = 0) {
  const [value, setValue] = useState(prefersReducedMotion() ? target : from);
  const current = useRef(value);
  useEffect(() => {
    if (prefersReducedMotion()) {
      current.current = target;
      setValue(target);
      return undefined;
    }
    const start = performance.now();
    const origin = current.current;
    let raf;
    const tick = (now) => {
      const t = Math.min(Math.max((now - start) / ms, 0), 1); // rAF timestamps can precede performance.now()
      current.current = origin + (target - origin) * easeOut(t);
      setValue(current.current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}
