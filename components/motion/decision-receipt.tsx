"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { gsap, motionScope } from "@/lib/motion/gsap";
import { motion } from "@/lib/motion/presets";

/** Mounted only after confirmed server success. A compact receipt retains context. */
export function DecisionReceipt({
  children,
  previousHeight,
}: {
  children: ReactNode;
  previousHeight: number;
}) {
  const ref = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const scope = motionScope(root);
    const height = root.getBoundingClientRect().height;
    scope.run(() => {
      gsap
        .timeline({ defaults: { ease: motion.ease.drawer } })
        .fromTo(
          root,
          { height: previousHeight, overflow: "hidden" },
          {
            height,
            duration: motion.duration.standard,
            clearProps: "height,overflow",
          },
          0,
        )
        .fromTo(
          root.firstElementChild,
          { opacity: 0, scale: 0.97 },
          {
            opacity: 1,
            scale: 1,
            duration: motion.duration.fast,
            clearProps: "opacity,transform",
          },
          0,
        );
    });
    return () => scope.dispose();
  }, [previousHeight]);
  return (
    <article ref={ref} className="review-result decision-receipt" role="status">
      {children}
    </article>
  );
}
