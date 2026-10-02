"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  motion,
  useInView,
  useMotionValue,
  useMotionTemplate,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import { Children, useRef, type ReactNode } from "react";
import { OprynLogo } from "@/components/opryn-logo";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";

const MotionLink = motion.create(Link);

export function PublicHomeLogo() {
  const pathname = usePathname();
  const reduced = useProductReducedMotion();
  return (
    <MotionLink
      href="/"
      aria-label="Opryn home"
      className="inline-flex rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#2855F9]"
      whileHover={reduced ? undefined : { scale: 1.02 }}
      onClick={(event) => {
        if (
          pathname === "/" &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        ) {
          event.preventDefault();
          window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
        }
      }}
    >
      <OprynLogo priority />
    </MotionLink>
  );
}

export function EditorialHeading({
  children,
  hero = false,
}: {
  children: string;
  hero?: boolean;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const seen = useInView(ref, { once: true });
  const reduced = useProductReducedMotion();
  const Tag = hero ? motion.h1 : motion.h2;
  return (
    <Tag ref={ref} className="editorial-heading" aria-label={children}>
      {children.split(" ").map((word, index) => (
        <motion.span
          aria-hidden="true"
          key={`${word}-${index}`}
          initial={false}
          animate={
            seen && !reduced
              ? { opacity: [0, 1], y: [14, 0], scale: [0.98, 1.015, 1] }
              : { opacity: 1, y: 0, scale: 1 }
          }
          transition={{ duration: 0.38, delay: index * 0.035 }}
          style={{ display: "inline-block" }}
        >
          {word}
          {"\u00a0"}
        </motion.span>
      ))}
    </Tag>
  );
}

/** Separate wrappers own entrance, scroll and pointer transforms. No render per pointer frame. */
export function EditorialGraphic({
  children,
  caption,
  signature = false,
}: {
  children: ReactNode;
  caption: string;
  signature?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const reduced = useProductReducedMotion();
  const seen = useInView(ref, { once: true, margin: "0px 0px -20px 0px" });
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const lightX = useMotionValue(50);
  const lightY = useMotionValue(50);
  const lightOpacity = useMotionValue(0);
  const light = useMotionTemplate`radial-gradient(circle at ${lightX}% ${lightY}%, rgba(40,85,249,.10), transparent 65%)`;
  const x = useSpring(px, { stiffness: 180, damping: 26 });
  const y = useSpring(py, { stiffness: 180, damping: 26 });
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const scrollX = useTransform(
    scrollYProgress,
    [0, 1],
    [signature ? 24 : 0, signature ? -12 : 0],
  );
  const scrollScale = useTransform(scrollYProgress, [0, 0.45, 1], [0.98, 1, 1]);
  return (
    <motion.figure
      ref={ref}
      className={`editorial-graphic ${signature ? "is-signature" : ""}`}
      initial={false}
      animate={
        seen && !reduced
          ? { opacity: [0.6, 1], y: [18, 0] }
          : { opacity: 1, y: 0 }
      }
      transition={{ duration: 0.45 }}
      onPointerMove={(event) => {
        if (
          reduced ||
          event.pointerType !== "mouse" ||
          !window.matchMedia("(hover: hover) and (pointer: fine)").matches
        )
          return;
        const box = event.currentTarget.getBoundingClientRect();
        px.set(((event.clientX / 1 - box.left) / box.width) * 32 - 16);
        py.set(((event.clientY - box.top) / box.height) * 16 - 8);
        lightX.set(((event.clientX - box.left) / box.width) * 100);
        lightY.set(((event.clientY - box.top) / box.height) * 100);
        lightOpacity.set(1);
      }}
      onPointerLeave={() => {
        px.set(0);
        py.set(0);
        lightOpacity.set(0);
      }}
    >
      <motion.div
        style={reduced ? undefined : { x: scrollX, scale: scrollScale }}
      >
        <motion.div
          className="editorial-art"
          style={reduced ? undefined : { x, y }}
          whileHover={reduced ? undefined : { scale: 1.015 }}
          transition={{ duration: 0.24 }}
        >
          {children}
          {!reduced && (
            <motion.div
              aria-hidden="true"
              className="editorial-light"
              style={{ background: light, opacity: lightOpacity }}
            />
          )}
          {signature && (
            <svg
              className="editorial-trace"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <rect
                x=".5"
                y=".5"
                width="99"
                height="99"
                rx="3"
                fill="none"
                stroke="#2855F9"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
                pathLength="1"
              />
            </svg>
          )}
        </motion.div>
      </motion.div>
      <figcaption>
        <span>Example workflow</span>
        {caption}
      </figcaption>
    </motion.figure>
  );
}

export function EditorialRail({ children }: { children: ReactNode }) {
  const reduced = useProductReducedMotion();
  const raw = useMotionValue(0);
  const x = useSpring(raw, { stiffness: 160, damping: 28 });
  return (
    <div
      className="editorial-rail"
      aria-hidden="true"
      onPointerMove={(event) => {
        if (
          reduced ||
          event.pointerType !== "mouse" ||
          !window.matchMedia("(pointer: fine)").matches
        )
          return;
        const box = event.currentTarget.getBoundingClientRect();
        raw.set(((event.clientX - box.left) / box.width - 0.5) * 20);
      }}
      onPointerLeave={() => raw.set(0)}
    >
      <div>
        {Children.map(children, (child, index) => (
          <RailTile
            x={x}
            factor={[0.35, 0.6, 1, 0.5][index % 4]}
            reduced={reduced}
          >
            {child}
          </RailTile>
        ))}
      </div>
    </div>
  );
}

function RailTile({
  x,
  factor,
  reduced,
  children,
}: {
  x: MotionValue<number>;
  factor: number;
  reduced: boolean;
  children: ReactNode;
}) {
  const tileX = useTransform(x, (value) => value * factor);
  return (
    <motion.div style={reduced ? undefined : { x: tileX }}>
      {children}
    </motion.div>
  );
}

/** Opt-in marketing CTA only; reduced motion gets a single, stationary label. */
export function EditorialAction({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  const reduced = useProductReducedMotion();
  return (
    <MotionLink
      href={href}
      className="public-action public-action-primary editorial-action"
      aria-label={children}
      initial="rest"
      animate="rest"
      whileHover={reduced ? "rest" : "hover"}
      whileFocus={reduced ? "rest" : "hover"}
      whileTap={reduced ? undefined : { scale: 0.97 }}
    >
      <span className="editorial-roll" aria-hidden="true">
        <motion.span
          variants={{ rest: { y: 0 }, hover: { y: "-100%" } }}
          transition={{ duration: 0.24 }}
        >
          {children}
        </motion.span>
        {!reduced && (
          <motion.span
            className="editorial-roll-copy"
            variants={{ rest: { y: "100%" }, hover: { y: 0 } }}
            transition={{ duration: 0.24 }}
          >
            {children}
          </motion.span>
        )}
      </span>
      <motion.span
        aria-hidden="true"
        variants={{ rest: { x: 0 }, hover: { x: 3 } }}
      >
        →
      </motion.span>
    </MotionLink>
  );
}
