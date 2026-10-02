"use client";

import Link from "next/link";
import { motion, useInView } from "motion/react";
import { useRef, type ReactNode } from "react";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import { motionTokens, uiTransition } from "@/lib/motion/motion-tokens";
import "./home-motion.css";
import { ActionLabel } from "@/components/motion/action-label";

const MotionLink = motion.create(Link);
/** Marketing actions only. Legacy `rolling` now opts into an underline reveal, never duplicate text. */
export function PublicAction({
  href,
  children,
  variant = "primary",
  rolling = false,
  external = false,
  className = "",
  onClick,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "text" | "icon";
  rolling?: boolean;
  external?: boolean;
  className?: string;
  onClick?: () => void;
}) {
  const reduced = useProductReducedMotion();
  return (
    <MotionLink
      href={href}
      onClick={(event) => {
        if (href.startsWith("#")) {
          const target = document.getElementById(href.slice(1));
          if (target) {
            event.preventDefault();
            target.scrollIntoView({
              behavior: reduced ? "auto" : "smooth",
              block: "start",
            });
            window.history.replaceState(null, "", href);
          }
        }
        onClick?.();
      }}
      className={`public-action public-action-${variant} ${className}`}
      data-animation-owner="motion"
      initial="rest"
      animate="rest"
      whileHover={reduced ? "rest" : "hover"}
      whileFocus={reduced ? "rest" : "hover"}
      whileTap={reduced || variant === "text" ? undefined : { scale: 0.98 }}
      transition={uiTransition(reduced, motionTokens.duration.micro)}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <span className="public-action-label">
        <ActionLabel emphasis={rolling} reduced={reduced}>
          {children}
        </ActionLabel>
      </span>
      <motion.span
        aria-hidden="true"
        className="public-action-arrow"
        variants={{
          rest: { x: 0, y: 0 },
          hover: { x: external ? 2 : 3, y: external ? -2 : 0 },
        }}
        transition={uiTransition(reduced, motionTokens.duration.fast)}
      >
        {external ? "↗" : "→"}
      </motion.span>
    </MotionLink>
  );
}

/** Progressive enhancement: SSR remains visible, including when JS fails. */
export function PublicReveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "0px 0px -30px 0px" });
  const reduced = useProductReducedMotion();
  return (
    <motion.div
      ref={ref}
      className={className}
      data-animation-owner="motion"
      initial={false}
      animate={
        seen && !reduced
          ? { opacity: [0.45, 1], y: [14, 0] }
          : { opacity: 1, y: 0 }
      }
      transition={uiTransition(reduced, motionTokens.duration.emphasis)}
    >
      {children}
    </motion.div>
  );
}
