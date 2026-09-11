import { useState, useEffect, useRef } from 'react';

/**
 * Animated counter hook — smoothly counts up from 0 to target value.
 * @param {number} end - Target number
 * @param {number} duration - Animation duration in ms (default 1500)
 * @param {number} delay - Delay before starting in ms (default 0)
 * @returns {number} Current animated value
 */
export function useAnimatedCounter(end, duration = 1500, delay = 0) {
  const [count, setCount] = useState(0);
  const frameRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (typeof end !== 'number' || isNaN(end)) return;

    const timeout = setTimeout(() => {
      const animate = (timestamp) => {
        if (!startTimeRef.current) startTimeRef.current = timestamp;
        const elapsed = timestamp - startTimeRef.current;
        const progress = Math.min(elapsed / duration, 1);

        // Ease-out cubic for a satisfying deceleration
        const eased = 1 - Math.pow(1 - progress, 3);
        setCount(Math.round(eased * end));

        if (progress < 1) {
          frameRef.current = requestAnimationFrame(animate);
        }
      };

      frameRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(timeout);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      startTimeRef.current = null;
    };
  }, [end, duration, delay]);

  return count;
}

/**
 * Hook to detect when an element enters the viewport.
 * @param {object} options - IntersectionObserver options
 * @returns {[ref, boolean]} - Ref to attach + isVisible boolean
 */
export function useInView(options = { threshold: 0.1, triggerOnce: true }) {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
        if (options.triggerOnce) {
          observer.unobserve(element);
        }
      } else if (!options.triggerOnce) {
        setIsVisible(false);
      }
    }, { threshold: options.threshold });

    observer.observe(element);
    return () => observer.disconnect();
  }, [options.threshold, options.triggerOnce]);

  return [ref, isVisible];
}

/**
 * Hook for staggered entrance animations.
 * Returns an array of style objects with increasing delays.
 */
export function useStaggeredAnimation(count, baseDelay = 0, staggerMs = 80) {
  return Array.from({ length: count }, (_, i) => ({
    animationDelay: `${baseDelay + i * staggerMs}ms`,
    animationFillMode: 'both',
  }));
}
