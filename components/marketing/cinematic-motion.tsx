"use client";

import { useRef, type ReactNode } from "react";
import {
  motion,
  useInView,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";

export function SceneHeading({
  lines,
  hero = false,
  signature = false,
}: {
  lines: string[];
  hero?: boolean;
  signature?: boolean;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const reduced = useProductReducedMotion();
  const Tag = hero ? "h1" : "h2";
  const wordOffsets = lines.map((_, index) =>
    lines
      .slice(0, index)
      .reduce((total, item) => total + item.split(" ").length, 0),
  );
  return (
    <Tag
      ref={ref}
      className={`cinematic-heading ${signature ? "cinematic-heading-signature" : ""}`}
      aria-label={lines.join(" ")}
    >
      {lines.map((line, lineIndex) => (
        <span className="cinematic-heading-line" aria-hidden="true" key={line}>
          {signature ? (
            line.split(" ").map((word, wordIndex, words) => {
              return (
                <span
                  className="cinematic-roll-word"
                  key={`${word}-${wordIndex}`}
                >
                  <motion.span
                    initial={
                      reduced ? false : { opacity: 0, y: "88%", rotateX: -7 }
                    }
                    animate={
                      seen || reduced
                        ? { opacity: 1, y: "0%", rotateX: 0 }
                        : { opacity: 0, y: "88%", rotateX: -7 }
                    }
                    transition={{
                      duration: reduced ? 0 : 0.5,
                      delay: reduced
                        ? 0
                        : (wordOffsets[lineIndex] + wordIndex) * 0.055,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    {word}
                    {wordIndex < words.length - 1 ? "\u00a0" : ""}
                  </motion.span>
                </span>
              );
            })
          ) : (
            <motion.span
              initial={false}
              animate={
                seen || reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }
              }
              transition={{
                duration: reduced ? 0 : 0.4,
                delay: reduced ? 0 : lineIndex * 0.07,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {line}
            </motion.span>
          )}
        </span>
      ))}
    </Tag>
  );
}

export function SceneReveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -8% 0px" });
  const reduced = useProductReducedMotion();
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={false}
      animate={seen || reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={{ duration: reduced ? 0 : 0.42, delay: reduced ? 0 : 0.12 }}
    >
      {children}
    </motion.div>
  );
}

export function PointerDepth({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useProductReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 170, damping: 25 });
  const y = useSpring(rawY, { stiffness: 170, damping: 25 });
  const lightX = useMotionValue(50);
  const lightY = useMotionValue(50);
  const light = useMotionTemplate`radial-gradient(circle at ${lightX}% ${lightY}%, rgba(75,115,255,.12), transparent 38%)`;
  const foregroundX = useTransform(x, (value) => value * 1.5);
  const foregroundY = useTransform(y, (value) => value * 1.5);
  return (
    <div
      className={`cinematic-depth ${className}`}
      onPointerMove={(event) => {
        if (
          reduced ||
          event.pointerType !== "mouse" ||
          !window.matchMedia("(hover: hover) and (pointer: fine)").matches
        )
          return;
        const rect = event.currentTarget.getBoundingClientRect();
        const dx = (event.clientX - rect.left) / rect.width - 0.5;
        const dy = (event.clientY - rect.top) / rect.height - 0.5;
        rawX.set(dx * 8);
        rawY.set(dy * 5);
        lightX.set((dx + 0.5) * 100);
        lightY.set((dy + 0.5) * 100);
      }}
      onPointerLeave={() => {
        rawX.set(0);
        rawY.set(0);
      }}
    >
      <motion.div
        className="cinematic-depth-content"
        style={reduced ? undefined : { x, y }}
      >
        {children}
      </motion.div>
      <motion.div
        className="cinematic-depth-light"
        aria-hidden="true"
        style={
          reduced
            ? undefined
            : {
                backgroundImage: light,
                x: foregroundX,
                y: foregroundY,
              }
        }
      />
    </div>
  );
}

export function KnowledgeRail() {
  const ref = useRef<SVGSVGElement>(null);
  const seen = useInView(ref, { once: true });
  const reduced = useProductReducedMotion();
  return (
    <svg
      ref={ref}
      className="cinematic-rail"
      viewBox="0 0 920 70"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden="true"
    >
      <motion.path
        d="M2 34 H252 C282 34 282 16 312 16 H608 C638 16 638 52 668 52 H918"
        stroke="#4B73FF"
        strokeWidth="2"
        strokeLinecap="round"
        initial={false}
        animate={{ pathLength: seen || reduced ? 1 : 0 }}
        transition={{ duration: reduced ? 0 : 0.9, ease: "easeOut" }}
      />
      {[252, 608, 918].map((cx) => (
        <circle
          key={cx}
          cx={cx}
          cy={cx === 608 ? 16 : cx === 918 ? 52 : 34}
          r="4"
          fill="#4B73FF"
        />
      ))}
    </svg>
  );
}
