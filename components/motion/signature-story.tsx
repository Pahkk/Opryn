"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { gsap, motionScope } from "@/lib/motion/gsap";
import { motion } from "@/lib/motion/presets";

/** Illustrative marketing sequences only. No timeline changes product state. */
export function SignatureStory({
  children,
  kind,
}: {
  children: ReactNode;
  kind: "teach" | "distribute";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const scope = motionScope(root);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        scope.run(() => {
          const timeline = gsap.timeline({
            defaults: { ease: motion.ease.enter },
          });
          const nodes = root.querySelectorAll(
            kind === "teach"
              ? ".editorial-flow > li"
              : ".distribution-destination",
          );
          const paths = root.querySelectorAll("path[pathLength]");
          if (kind === "teach") {
            nodes.forEach((node, index) => {
              timeline.fromTo(
                node,
                { x: index === 0 ? -20 : 0, y: index ? 8 : 0, opacity: 0.35 },
                {
                  x: 0,
                  y: 0,
                  opacity: 1,
                  duration: 0.24,
                  clearProps: "transform,opacity",
                },
                index * 0.18,
              );
              if (paths[index])
                timeline.fromTo(
                  paths[index],
                  { strokeDasharray: 1, strokeDashoffset: 1 },
                  {
                    strokeDashoffset: 0,
                    duration: 0.22,
                    clearProps: "strokeDasharray,strokeDashoffset",
                  },
                  index * 0.18 + 0.12,
                );
            });
          } else {
            timeline.fromTo(
              root.querySelector(".editorial-update-source"),
              { scale: 0.975, opacity: 0.5 },
              {
                scale: 1,
                opacity: 1,
                duration: 0.26,
                clearProps: "transform,opacity",
              },
            );
            nodes.forEach((node, index) => {
              timeline
                .fromTo(
                  paths[index],
                  { strokeDasharray: 1, strokeDashoffset: 1 },
                  {
                    strokeDashoffset: 0,
                    duration: 0.26,
                    clearProps: "strokeDasharray,strokeDashoffset",
                  },
                  0.15 + index * 0.12,
                )
                .fromTo(
                  node,
                  { opacity: 0.35, y: 6 },
                  {
                    opacity: 1,
                    y: 0,
                    duration: 0.2,
                    clearProps: "opacity,transform",
                  },
                  0.35 + index * 0.12,
                );
            });
          }
        });
      },
      { threshold: 0.25 },
    );
    observer.observe(root);
    return () => {
      observer.disconnect();
      scope.dispose();
    };
  }, [kind]);
  return (
    <div ref={ref} className={`signature-story signature-${kind}`}>
      {children}
    </div>
  );
}

/** One semantic heading; masks don't duplicate screen-reader text. */
export function MaskedHeadline({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const scope = motionScope(ref.current);
    scope.run(() =>
      gsap.fromTo(
        ref.current,
        { yPercent: 105 },
        {
          yPercent: 0,
          duration: 0.65,
          ease: motion.ease.drawer,
          clearProps: "transform",
        },
      ),
    );
    return () => scope.dispose();
  }, []);
  return (
    <span className="headline-mask">
      <span ref={ref}>{children}</span>
    </span>
  );
}

export function PointerSurface({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const scope = motionScope(root);
    const move = (event: PointerEvent) => {
      if (
        !matchMedia(
          "(hover: hover) and (pointer: fine) and (min-width: 1024px)",
        ).matches
      )
        return;
      const box = root.getBoundingClientRect();
      const x = Math.max(
        -2,
        Math.min(2, ((event.clientX - box.left) / box.width - 0.5) * 4),
      );
      const y = Math.max(
        -2,
        Math.min(2, ((event.clientY - box.top) / box.height - 0.5) * 4),
      );
      scope.run(() =>
        gsap.to(root.firstElementChild, {
          x,
          y,
          duration: motion.duration.fast,
          overwrite: true,
          ease: motion.ease.state,
        }),
      );
    };
    const reset = () =>
      scope.run(() =>
        gsap.to(root.firstElementChild, {
          x: 0,
          y: 0,
          duration: motion.duration.fast,
          clearProps: "transform",
          overwrite: true,
        }),
      );
    root.addEventListener("pointermove", move);
    root.addEventListener("pointerleave", reset);
    return () => {
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerleave", reset);
      scope.dispose();
    };
  }, []);
  return (
    <div ref={ref} className="pointer-surface">
      <div className="pointer-plane">{children}</div>
    </div>
  );
}
