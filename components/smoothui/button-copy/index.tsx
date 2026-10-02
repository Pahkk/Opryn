"use client";

import { Check, Copy, LoaderCircle } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export interface ButtonCopyProps {
  className?: string;
  disabled?: boolean;
  duration?: number;
  idleLabel?: string;
  idleIcon?: ReactNode;
  loadingLabel?: string;
  loadingDuration?: number;
  loadingIcon?: ReactNode;
  onCopy?: () => Promise<void> | void;
  successLabel?: string;
  successIcon?: ReactNode;
}

const defaultIcons = {
  idle: <Copy size={16} />,
  loading: (
    <LoaderCircle
      className="animate-spin motion-reduce:animate-none"
      size={16}
    />
  ),
  success: <Check size={16} />,
};

export default function ButtonCopy({
  onCopy,
  idleLabel = "Copy",
  idleIcon = defaultIcons.idle,
  loadingLabel = "Copying…",
  loadingIcon = defaultIcons.loading,
  successLabel = "Copied",
  successIcon = defaultIcons.success,
  className = "",
  duration = 2000,
  loadingDuration = 0,
  disabled = false,
}: ButtonCopyProps) {
  const [buttonState, setButtonState] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const shouldReduceMotion = useReducedMotion();

  const requestId = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(
    () => () => {
      requestId.current += 1;
      for (const timer of timers.current) {
        clearTimeout(timer);
      }
    },
    []
  );

  const handleClick = useCallback(async () => {
    const request = ++requestId.current;
    setButtonState("loading");
    try {
      await onCopy?.();
    } catch {
      if (request === requestId.current) {
        setButtonState("error");
      }
      return;
    }
    if (request !== requestId.current) {
      return;
    }
    timers.current = [
      setTimeout(() => setButtonState("success"), loadingDuration),
      setTimeout(() => setButtonState("idle"), loadingDuration + duration),
    ];
  }, [onCopy, loadingDuration, duration]);

  const icons = {
    error: idleIcon,
    idle: idleIcon,
    loading: loadingIcon,
    success: successIcon,
  };

  const ariaLabels = {
    error: "Copy failed. Try again",
    idle: "Copy",
    loading: "Copying...",
    success: "Copied",
  };

  return (
    <div className="inline-flex">
      <button
        aria-label={buttonState === "error" ? ariaLabels.error : buttonState === "loading" ? loadingLabel : buttonState === "success" ? successLabel : idleLabel}
        aria-live="polite"
        className={`relative min-h-[40px] w-auto cursor-pointer overflow-hidden rounded-xl border bg-background px-3 py-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 ${className}`}
        disabled={
          buttonState === "loading" || buttonState === "success" || disabled
        }
        onClick={handleClick}
        type="button"
      >
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : { filter: "blur(0px)", opacity: 1, y: 0 }
            }
            className="flex w-full items-center justify-center gap-1.5"
            exit={
              shouldReduceMotion
                ? { opacity: 0, transition: { duration: 0 } }
                : { filter: "blur(10px)", opacity: 0, y: 25 }
            }
            initial={
              shouldReduceMotion
                ? { opacity: 1 }
                : { filter: "blur(10px)", opacity: 0, y: -25 }
            }
            key={buttonState}
            transition={
              shouldReduceMotion
                ? { duration: 0 }
                : { bounce: 0, duration: 0.25, type: "spring" as const }
            }
          >
            {icons[buttonState]}
            <span>{buttonState === "loading" ? loadingLabel : buttonState === "success" ? successLabel : buttonState === "error" ? "Try copying again" : idleLabel}</span>
          </motion.span>
        </AnimatePresence>
      </button>
    </div>
  );
}
