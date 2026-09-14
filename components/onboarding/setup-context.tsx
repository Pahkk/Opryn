"use client";
import { useLayoutEffect, useRef } from "react";
import { gsap, motionScope } from "@/lib/motion/gsap";
import { motion } from "@/lib/motion/presets";
/** Same DOM object across review, answer and plan. Server state owns the status. */
export function SetupContext({
  company,
  title,
  approved,
  goal,
}: {
  company: string;
  title?: string;
  approved: boolean;
  goal: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef(approved);
  useLayoutEffect(() => {
    if (!ref.current || previous.current === approved) return;
    previous.current = approved;
    const scope = motionScope(ref.current);
    scope.run(() => {
      gsap.fromTo(
        ref.current,
        { scale: 0.985 },
        {
          scale: 1,
          duration: motion.duration.standard,
          ease: motion.ease.enter,
          clearProps: "transform",
        },
      );
      gsap.fromTo(
        ref.current!.querySelector("[data-authority-status]"),
        { y: 5, opacity: 0.5 },
        {
          y: 0,
          opacity: 1,
          duration: motion.duration.fast,
          ease: motion.ease.enter,
          clearProps: "transform,opacity",
        },
      );
    });
    return () => scope.dispose();
  }, [approved]);
  return (
    <div ref={ref} className="setup-context" data-approved={approved}>
      <div>
        <small>{company || "Your company"}</small>
        <strong>{title || goal}</strong>
      </div>
      {title && (
        <span
          data-authority-status
          className={`activation-status${approved ? " approved" : ""}`}
        >
          {approved ? "✓ Approved · ready to use" : "Needs Review"}
        </span>
      )}
    </div>
  );
}
