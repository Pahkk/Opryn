"use client";

import { useRef, useSyncExternalStore } from "react";
import { motion, useInView } from "motion/react";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import { motionTokens, uiTransition } from "@/lib/motion/motion-tokens";

function localGreeting() {
  const hour = new Date().getHours();
  return hour < 12
    ? "Good morning"
    : hour < 18
      ? "Good afternoon"
      : "Good evening";
}

function subscribe(callback: () => void) {
  const immediate = window.setTimeout(callback, 0);
  const interval = window.setInterval(callback, 60_000);
  return () => {
    window.clearTimeout(immediate);
    window.clearInterval(interval);
  };
}

export function LocalGreeting({
  name,
  animated = false,
}: {
  name: string;
  animated?: boolean;
}) {
  const greeting = useSyncExternalStore(
    subscribe,
    localGreeting,
    () => "Hello",
  );

  return (
    <h1 className="mt-2 text-[32px] font-semibold tracking-[-.045em] sm:text-[38px]">
      {animated ? (
        <GreetingReveal text={`${greeting}, ${name}.`} />
      ) : (
        <>
          {greeting}, {name}
        </>
      )}
    </h1>
  );
}

function GreetingReveal({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });
  const reduced = useProductReducedMotion();
  return (
    <span ref={ref}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {text.split(" ").map((word, index) => (
          <motion.span
            key={index}
            style={{ display: "inline-block", transformOrigin: "bottom left" }}
            initial={false}
            animate={
              seen && !reduced
                ? {
                    y: [12, -1, 0],
                    scale: [0.95, 1.025, 1],
                    opacity: [0.65, 1, 1],
                  }
                : { y: 0, scale: 1, opacity: 1 }
            }
            transition={{
              ...uiTransition(reduced, motionTokens.duration.emphasis),
              delay: reduced ? 0 : index * motionTokens.stagger,
            }}
          >
            {word}
            {"\u00a0"}
          </motion.span>
        ))}
      </span>
    </span>
  );
}
