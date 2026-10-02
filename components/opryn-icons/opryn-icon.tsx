"use client";

import { motion } from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import "./opryn-icon.css";

/** Original, unmodified artwork. Aliases describe actual product uses, not new assets. */
export const oprynIconAssets = {
  home: "1c9a7356-801c-444a-9ce3-50bf07432d1d.png",
  ask: "3b307f97-1d3e-4428-8852-8b0969473f50.png",
  teach: "dea063a3-e18d-45d3-bf89-776317a6abfd.png",
  knowledge: "0ee83465-83bf-4fc2-9cc2-7aa059f274b1.png",
  "needs-you": "d80bafe8-e2da-4e66-8bad-cb6481649edd.png",
  review: "d80bafe8-e2da-4e66-8bad-cb6481649edd.png",
  team: "f196e284-e39e-4e7a-a2b5-f719fe848eb9.png",
  connections: "cd2be86f-155d-4a14-abff-ca92a1275aed.png",
  settings: "e9021800-0bb7-4798-a17a-d0943ddbc791.png",
  approved: "f8848d0b-ceb2-4b24-a589-e0dadbc4156c.png",
  support: "843d8ce8-037b-4563-a6c9-55a01de91389.png",
} as const;

export type OprynIconName = keyof typeof oprynIconAssets;
export type OprynIconState =
  "idle" | "hover" | "tap" | "active" | "attention" | "success" | "disabled";

export function OprynIconHighlight({ visible = false }: { visible?: boolean }) {
  const reduced = useProductReducedMotion();
  return (
    <motion.span
      aria-hidden="true"
      className="opryn-icon-highlight"
      initial={false}
      animate={{
        opacity: visible ? 1 : 0,
        scale: reduced ? 1 : visible ? 1 : 0.75,
      }}
      transition={{ duration: reduced ? 0 : 0.18 }}
    />
  );
}

export function OprynIconShell({
  children,
  size = 44,
}: {
  children: ReactNode;
  size?: number;
}) {
  return (
    <span className="opryn-icon-shell" style={{ width: size, height: size }}>
      {children}
    </span>
  );
}

/** Decorative by default: the containing semantic action supplies its accessible name.
 * Pointer and focus are observed on that action, so icon + label respond together.
 * Raster artwork is never segmented, recolored, cropped, or used as a loader.
 */
export function OprynIcon({
  name,
  size = 28,
  active = false,
  attention = false,
  success = false,
  disabled = false,
  state,
  className,
  style,
}: {
  name: OprynIconName;
  size?: number;
  active?: boolean;
  attention?: boolean;
  success?: boolean;
  disabled?: boolean;
  state?: OprynIconState;
  className?: string;
  style?: CSSProperties;
}) {
  const reduced = useProductReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [pulse, setPulse] = useState(0);
  const interacted = useRef(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  useEffect(() => {
    const element = ref.current;
    const action =
      element?.closest("a,button,summary,[role=button]") ?? element;
    if (!action) return;
    const enter = () => {
      interacted.current = true;
      setHasInteracted(true);
      setHovered(true);
    };
    const leave = () => {
      setHovered(false);
      setPressed(false);
    };
    const down = () => setPressed(true);
    const up = () => setPressed(false);
    const blur = (event: Event) => {
      if (!action.contains((event as FocusEvent).relatedTarget as Node | null))
        leave();
    };
    const listeners: [string, EventListener][] = [
      ["pointerenter", enter],
      ["pointerleave", leave],
      ["focusin", enter],
      ["focusout", blur],
      ["pointerdown", down],
      ["pointerup", up],
      ["pointercancel", up],
    ];
    listeners.forEach(([type, listener]) =>
      action.addEventListener(type, listener),
    );
    return () =>
      listeners.forEach(([type, listener]) =>
        action.removeEventListener(type, listener),
      );
  }, []);
  useEffect(() => {
    if (!attention || reduced || disabled || active) return;
    let count = 0;
    const timer = window.setInterval(() => {
      if (interacted.current || document.hidden || count >= 3) return;
      count += 1;
      setPulse((value) => value + 1);
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [attention, reduced, disabled, active]);
  const current = disabled
    ? "disabled"
    : (state ??
      (success
        ? "success"
        : pressed
          ? "tap"
          : hovered
            ? "hover"
            : active
              ? "active"
              : attention && !hasInteracted
                ? "attention"
                : "idle"));
  const lit =
    current === "hover" ||
    current === "active" ||
    current === "success" ||
    current === "attention";
  const halo =
    !reduced && (current === "hover" || current === "success" || pulse > 0);
  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-opryn-icon={name}
      data-motion-owner="motion"
      data-icon-state={current}
      className={`opryn-asset-icon ${className ?? ""}`}
      style={{ width: size, height: size, ...style }}
    >
      <OprynIconHighlight visible={lit} />
      {halo ? (
        <motion.span
          key={`${current}-${pulse}`}
          className="opryn-icon-halo"
          aria-hidden="true"
          initial={{ scale: 0.8, opacity: 0.25 }}
          animate={{ scale: 1.12, opacity: 0 }}
          transition={{ duration: 0.42 }}
        />
      ) : null}
      <motion.span
        className="opryn-icon-art"
        key={pulse}
        initial={false}
        animate={
          reduced
            ? { scale: 1, y: 0, rotate: 0 }
            : {
                scale:
                  current === "tap"
                    ? 0.96
                    : current === "hover"
                      ? 1.05
                      : current === "success"
                        ? [0.75, 1.08, 1]
                        : current === "attention"
                          ? [1, 1.025, 1]
                          : 1,
                y: current === "hover" ? -2 : 0,
                rotate:
                  current === "hover" && name === "settings"
                    ? 5
                    : current === "hover" && name === "support"
                      ? 2
                      : 0,
              }
        }
        transition={
          reduced
            ? { duration: 0 }
            : current === "success" || current === "attention"
              ? { duration: 0.38 }
              : { type: "spring", stiffness: 410, damping: 28 }
        }
      >
        {/* Originals remain byte-for-byte intact; no optimizer re-export or crop. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/opryn-icons/${oprynIconAssets[name]}`}
          width={1254}
          height={1254}
          alt=""
          draggable={false}
          decoding="async"
        />
      </motion.span>
    </span>
  );
}
