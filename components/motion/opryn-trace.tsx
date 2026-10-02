"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import { motionTokens } from "@/lib/motion/motion-tokens";

/** Decorative only. Insert into a positioned panel; never adds a focus target.
 * Measures its real perimeter so rounded corners are not stretched. */
export function OprynTrace() {
  const ref = useRef<SVGSVGElement>(null);
  const reduced = useProductReducedMotion();
  const [active, setActive] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0, radius: 20 });
  useEffect(() => {
    const panel = ref.current?.parentElement;
    if (!panel) return;
    let hovering = false;
    const update = () =>
      setActive(hovering || panel.contains(document.activeElement));
    const enter = (event: PointerEvent) => {
      if (event.pointerType !== "touch") hovering = true;
      update();
    };
    const leave = () => {
      hovering = false;
      update();
    };
    const blur = (event: FocusEvent) =>
      setActive(
        hovering ||
          (event.relatedTarget instanceof Node &&
            panel.contains(event.relatedTarget)),
      );
    const measure = () =>
      setSize({
        width: panel.clientWidth,
        height: panel.clientHeight,
        radius: parseFloat(getComputedStyle(panel).borderTopLeftRadius) || 0,
      });
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    measure();
    panel.addEventListener("pointerenter", enter);
    panel.addEventListener("pointerleave", leave);
    panel.addEventListener("focusin", update);
    panel.addEventListener("focusout", blur);
    return () => {
      observer.disconnect();
      panel.removeEventListener("pointerenter", enter);
      panel.removeEventListener("pointerleave", leave);
      panel.removeEventListener("focusin", update);
      panel.removeEventListener("focusout", blur);
    };
  }, []);
  return (
    <svg
      ref={ref}
      className="opryn-trace"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
      aria-hidden="true"
      focusable="false"
      data-animation-owner="motion"
      viewBox={`0 0 ${size.width || 1} ${size.height || 1}`}
    >
      <motion.rect
        x="1"
        y="1"
        width={Math.max(0, size.width - 2)}
        height={Math.max(0, size.height - 2)}
        rx={Math.max(0, size.radius - 1)}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        initial={false}
        animate={{ pathLength: active ? 1 : 0, opacity: active ? 1 : 0 }}
        transition={{
          duration: reduced || !active ? 0 : 0.26,
          ease: motionTokens.ease,
        }}
      />
    </svg>
  );
}
