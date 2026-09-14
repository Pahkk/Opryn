"use client";

import { useId, useLayoutEffect, useRef } from "react";
import { gsap, motionScope } from "@/lib/motion/gsap";
import { motion } from "@/lib/motion/presets";

/** Decorative connector: the adjacent HTML labels carry all meaning. */
export function FlowLine({ vertical = false }: { vertical?: boolean }) {
  const id = useId().replaceAll(":", "");
  const ref = useRef<SVGSVGElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const scope = motionScope(element);
    const reveal = () =>
      scope.run(() => {
        const path = element.querySelector("path[data-flow-path]");
        gsap.fromTo(
          path,
          { strokeDasharray: 100, strokeDashoffset: 100 },
          {
            strokeDashoffset: 0,
            duration: motion.duration.emphasis,
            ease: motion.ease.enter,
            clearProps: "strokeDasharray,strokeDashoffset",
          },
        );
      });
    if (!("IntersectionObserver" in window)) {
      reveal();
      return () => scope.dispose();
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        observer.disconnect();
        reveal();
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      scope.dispose();
    };
  }, []);
  return (
    <svg
      ref={ref}
      className="opryn-flow-line"
      width={vertical ? 20 : 48}
      height={vertical ? 40 : 20}
      viewBox={vertical ? "0 0 20 40" : "0 0 48 20"}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <marker
          id={id}
          viewBox="0 0 6 6"
          refX="5"
          refY="3"
          markerWidth="5"
          markerHeight="5"
          orient="auto"
        >
          <path d="M1 1 5 3 1 5" fill="none" stroke="currentColor" />
        </marker>
      </defs>
      <path
        data-flow-path
        pathLength="100"
        d={vertical ? "M10 2 V36" : "M2 10 H44"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        markerEnd={`url(#${id})`}
      />
    </svg>
  );
}
