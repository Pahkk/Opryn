"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { gsap, immediateContent, motionScope } from "@/lib/motion/gsap";
import { motion } from "@/lib/motion/presets";

/** Does not key/remount children or defer routing, actions, focus or error feedback. */
export function MotionRegion({
  children,
  changeKey,
  variant = "page",
  className = "",
}: {
  children: ReactNode;
  changeKey?: string | number;
  variant?: "page" | "step" | "status" | "quiet";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (
      !element ||
      element.closest("[data-motion-immediate]") ||
      element.querySelector(immediateContent)
    )
      return;
    const scope = motionScope(element);
    scope.run(() =>
      gsap.fromTo(
        element,
        {
          opacity: 0,
          scale: variant === "page" ? 0.992 : variant === "status" ? 0.96 : 1,
          x: variant === "step" ? 12 : 0,
          y: variant === "page" ? motion.distance.page : 0,
        },
        {
          opacity: 1,
          scale: 1,
          x: 0,
          y: 0,
          duration:
            variant === "status" || variant === "quiet"
              ? motion.duration.micro
              : motion.duration.standard,
          ease: motion.ease.enter,
          clearProps: "opacity,transform",
          onComplete: () => observer.disconnect(),
        },
      ),
    );
    // New errors inserted during entry must be immediately readable.
    const observer = new MutationObserver(() => {
      if (element.querySelector(immediateContent)) scope.dispose();
    });
    observer.observe(element, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["aria-invalid", "role"],
    });
    return () => {
      observer.disconnect();
      scope.dispose();
    };
  }, [changeKey, variant]);
  return (
    <div ref={ref} className={className} data-motion-region={variant}>
      {children}
    </div>
  );
}

/** Only inserted/changed keyed rows enter, not unchanged results or the whole page.
 * Limited stagger: even a large result set completes in under 400ms.
 */
export function StaggerList({
  children,
  changeKey,
  className = "",
}: {
  children: ReactNode;
  changeKey: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const previous = useRef(new Map<string, string>());
  const positions = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const rows = [
      ...element.querySelectorAll<HTMLElement>(":scope > [data-motion-row]"),
    ];
    const changed = rows.filter(
      (row) =>
        (!previous.current.has(row.dataset.motionRow!) ||
          previous.current.get(row.dataset.motionRow!) !==
            (row.dataset.motionVersion ?? "")) &&
        !row.querySelector(immediateContent),
    );
    previous.current = new Map(
      rows.map((row) => [
        row.dataset.motionRow!,
        row.dataset.motionVersion ?? "",
      ]),
    );
    const scope = motionScope(element);
    scope.run(() => {
      rows
        .filter((row) => !changed.includes(row))
        .forEach((row) => {
          const before = positions.current.get(row.dataset.motionRow!);
          const after = row.offsetTop;
          if (before !== undefined && before !== after)
            gsap.fromTo(
              row,
              { y: Math.max(-24, Math.min(24, before - after)) },
              {
                y: 0,
                duration: motion.duration.fast,
                ease: motion.ease.enter,
                clearProps: "transform",
              },
            );
        });
      if (changed.length)
        gsap.fromTo(
          changed,
          { opacity: 0, y: motion.distance.row },
          {
            opacity: 1,
            y: 0,
            duration: motion.duration.fast,
            ease: motion.ease.state,
            stagger: Math.min(
              motion.stagger,
              0.15 / Math.max(1, changed.length - 1),
            ),
            clearProps: "opacity,transform",
          },
        );
    });
    positions.current = new Map(
      rows.map((row) => [row.dataset.motionRow!, row.offsetTop]),
    );
    return () => scope.dispose();
  }, [changeKey]);
  return (
    <div ref={ref} className={className} data-motion-list>
      {children}
    </div>
  );
}
