"use client";

import { useEffect, useRef, useState } from "react";

/** Repeating motion only runs while the visitor can see it and allows motion. */
export function useVisiblePlayback<T extends HTMLElement>(paused: boolean) {
  const ref = useRef<T>(null);
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const sync = () =>
      setAvailable(visible && !document.hidden && !motion.matches);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    observer.observe(element);
    motion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      motion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return { ref, playing: available && !paused };
}
