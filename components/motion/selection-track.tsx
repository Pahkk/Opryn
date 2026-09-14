"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { gsap, motionScope } from "@/lib/motion/gsap";
import { motion } from "@/lib/motion/presets";

/** Follows existing pressed-button semantics; never owns selection or focus. */
export function SelectionTrack({
  children,
  value,
}: {
  children: ReactNode;
  value: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef<{ x: number; width: number } | null>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const indicator = root.querySelector<HTMLElement>(".selection-indicator")!;
    const scope = motionScope(root);
    const place = (animate: boolean) => {
      const selected = root.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (!selected) return;
      const box = selected.getBoundingClientRect(),
        parent = root.getBoundingClientRect();
      const next = { x: box.left - parent.left, width: box.width };
      indicator.style.width = `${next.width}px`;
      indicator.style.transform = `translateX(${next.x}px)`;
      if (animate && previous.current)
        scope.run(() =>
          gsap.fromTo(
            indicator,
            {
              x: previous.current!.x,
              scaleX: previous.current!.width / next.width,
            },
            {
              x: next.x,
              scaleX: 1,
              duration: motion.duration.fast,
              ease: motion.ease.enter,
            },
          ),
        );
      previous.current = next;
    };
    place(true);
    const resize = new ResizeObserver(() => place(false));
    resize.observe(root);
    const scroll = () => place(false);
    root.addEventListener("scroll", scroll, true);
    return () => {
      resize.disconnect();
      root.removeEventListener("scroll", scroll, true);
      scope.dispose();
    };
  }, [value]);
  return (
    <div ref={ref} className="selection-track">
      {children}
      <span aria-hidden="true" className="selection-indicator" />
    </div>
  );
}
