"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, type HTMLMotionProps } from "motion/react";
import { motionTokens, uiTransition } from "@/lib/motion/motion-tokens";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import { SuccessCheck } from "./success-check";
import { ActionLabel } from "./action-label";
import "./feedback.css";

export type ActionState = "idle" | "pending" | "success" | "error";

/** Synchronous lock prevents rapid/keyboard double submissions before React renders.
 * Only a fulfilled operation may confirm success; callers must reject failed HTTP responses. */
export function useActionFeedback() {
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [state, setState] = useState<ActionState>("idle");
  const [error, setError] = useState("");
  async function run(operation: () => Promise<unknown>) {
    if (lock.current) return false;
    lock.current = true;
    setError("");
    setState("pending");
    try {
      await operation();
      if (mounted.current) setState("success");
      return true;
    } catch (caught) {
      if (!mounted.current) return false;
      setError(
        caught instanceof TypeError
          ? "Check your connection and try again."
          : caught instanceof Error
            ? caught.message
            : "That action wasn't saved. Please try again.",
      );
      setState("error");
      return false;
    } finally {
      lock.current = false;
    }
  }
  return { state, error, run };
}

type Props = Omit<HTMLMotionProps<"button">, "children"> & {
  label: string;
  state?: ActionState;
  pendingLabel?: string;
  successLabel?: string;
  successIcon?: ReactNode;
  variant?: "primary" | "secondary" | "inline" | "icon" | "destructive";
  rolling?: boolean;
  arrow?: boolean;
  icon?: ReactNode;
  errorMessage?: string;
  /** Repeatable saves/tests remain actionable after confirmation. */
  repeatable?: boolean;
  announce?: boolean;
};

/** Controlled presentation, never infers backend success from a click or elapsed time. */
export function OprynAction({
  label,
  state = "idle",
  pendingLabel = "Working…",
  successLabel = "Saved",
  successIcon,
  variant = "primary",
  rolling = false,
  arrow = false,
  icon,
  errorMessage,
  repeatable = false,
  announce = true,
  className = "",
  disabled,
  ...props
}: Props) {
  const reduced = useProductReducedMotion();
  const id = useId();
  const blocked =
    disabled || state === "pending" || (state === "success" && !repeatable);
  const text =
    state === "pending"
      ? pendingLabel
      : state === "success"
        ? successLabel
        : label;
  return (
    <span className="opryn-action-wrap">
      <motion.button
        {...props}
        type={props.type ?? "button"}
        className={`opryn-feedback-action opryn-feedback-${variant} ${className}`}
        disabled={blocked}
        aria-label={props["aria-label"] ?? text}
        aria-busy={state === "pending"}
        aria-describedby={errorMessage ? id : props["aria-describedby"]}
        data-action-state={state}
        data-motion-owner="motion"
        initial="rest"
        animate="rest"
        whileHover={blocked || reduced ? "rest" : "hover"}
        whileFocus={blocked || reduced ? "rest" : "hover"}
        whileTap={
          blocked || reduced || variant === "destructive"
            ? undefined
            : { scale: 0.97 }
        }
        transition={uiTransition(reduced, motionTokens.duration.micro)}
      >
        <span className="opryn-action-content" aria-hidden="true">
          <span className="opryn-action-reserve">
            {label}
            {arrow ? " →" : ""}
          </span>
          <AnimatePresence initial={false}>
            <motion.span
              className="opryn-action-state"
              key={state}
              initial={reduced ? false : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduced ? 0 : -5 }}
              transition={uiTransition(reduced, motionTokens.duration.micro)}
            >
              {state === "success" ? (
                (successIcon ?? <SuccessCheck />)
              ) : state === "pending" ? (
                <span className="opryn-pending-dots">
                  <i />
                  <i />
                  <i />
                </span>
              ) : (
                icon
              )}
              <span className="opryn-roll-mask">
                <ActionLabel
                  emphasis={rolling && state === "idle"}
                  reduced={reduced}
                >
                  {text}
                </ActionLabel>
              </span>
              {arrow && state !== "pending" && state !== "success" ? (
                <motion.span
                  variants={{ rest: { x: 0 }, hover: { x: 3 } }}
                  transition={uiTransition(reduced, motionTokens.duration.fast)}
                >
                  →
                </motion.span>
              ) : null}
            </motion.span>
          </AnimatePresence>
        </span>
      </motion.button>
      {announce ? (
        <span className="sr-only" role="status">
          {state === "success"
            ? successLabel
            : state === "pending"
              ? pendingLabel
              : ""}
        </span>
      ) : null}
      {errorMessage ? (
        <span id={id} className="opryn-action-error" role="alert">
          {errorMessage}
        </span>
      ) : null}
    </span>
  );
}
