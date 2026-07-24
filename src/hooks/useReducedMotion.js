import { useState, useEffect } from 'react';

/**
 * useReducedMotion - Returns whether the user prefers reduced motion.
 *
 * Reads the `prefers-reduced-motion: reduce` media query and subscribes
 * to runtime changes (e.g. the user toggles the OS accessibility setting
 * while the page is open).
 *
 * Use this to gate JS-driven animations (e.g. Recharts `isAnimationActive`).
 * CSS animations are handled separately via the `@media (prefers-reduced-motion)`
 * block in index.css.
 *
 * @returns {boolean} true when the user prefers reduced motion
 */
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return prefersReducedMotion;
}

export default useReducedMotion;
