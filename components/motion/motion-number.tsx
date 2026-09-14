"use client";
import { useLayoutEffect, useRef } from "react";
import { gsap, motionScope } from "@/lib/motion/gsap";
import { motion } from "@/lib/motion/presets";

/** First render is the real value, never a fictitious zero. AT receives only state. */
export function MotionNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const previous = useRef(value);
  useLayoutEffect(() => {
    const element = ref.current;
    const from = previous.current;
    previous.current = value;
    if (!element || from === value) return;
    const scope = motionScope(element);
    const counter = { value: from };
    scope.run(() =>
      gsap.to(counter, {
        value,
        duration: motion.duration.emphasis,
        ease: motion.ease.state,
        onUpdate: () => {
          element.textContent = String(Math.round(counter.value));
        },
        onInterrupt: () => {
          element.textContent = String(value);
        },
      }),
    );
    return () => {
      scope.dispose();
      element.textContent = String(value);
    };
  }, [value]);
  return (
    <>
      <span className="sr-only">{value}</span>
      <span
        ref={ref}
        aria-hidden="true"
        className="motion-number-value tabular-nums"
      >
        {value}
      </span>
    </>
  );
}
