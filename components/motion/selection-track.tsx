"use client";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { motionTokens } from "@/lib/motion/motion-tokens";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
/** Existing selection semantics remain authoritative, including wrapped and scrollable filters. */
export function SelectionTrack({
  children,
  value,
}: {
  children: ReactNode;
  value: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useProductReducedMotion();
  const [box, setBox] = useState({ x: 0, y: 0, width: 0 });
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const selected = root.querySelector<HTMLElement>(
      '[aria-pressed="true"], [aria-selected="true"], [aria-current="page"]',
    );
    if (!selected) return;
    const measure = () => {
      const a = selected.getBoundingClientRect(),
        b = root.getBoundingClientRect();
      setBox({ x: a.left - b.left, y: a.bottom - b.top - 2, width: a.width });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    observer.observe(selected);
    root.addEventListener("scroll", measure, true);
    return () => {
      observer.disconnect();
      root.removeEventListener("scroll", measure, true);
    };
  }, [value]);
  return (
    <div ref={ref} className="selection-track">
      {children}
      <motion.span
        aria-hidden="true"
        className="selection-indicator"
        data-motion-owner="motion"
        initial={false}
        animate={{ x: box.x, y: box.y, width: box.width }}
        style={{ top: 0, bottom: "auto" }}
        transition={reduced ? { duration: 0 } : motionTokens.spring}
      />
    </div>
  );
}
