"use client";

import { useEffect, useId, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import { motionTokens } from "@/lib/motion/motion-tokens";

/** Original silent illustration. Never represents a real import or connection. */
export function SourcePreview({
  name,
  conversation,
  manual,
}: {
  name: string;
  conversation: boolean;
  manual: boolean;
}) {
  const reduced = useProductReducedMotion();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!open || !playing || reduced || step === 3) return;
    const timer = setTimeout(() => setStep((value) => value + 1), 2200);
    return () => clearTimeout(timer);
  }, [open, playing, reduced, step]);
  const stages = [
    manual ? "Choose what to teach" : "Connect your account",
    conversation
      ? "Send this conversation"
      : manual
        ? "Share one real process"
        : "Choose one source",
    "Opryn prepares findings",
    "You review and approve",
  ];
  const descriptions = [
    manual
      ? "Start with information you already know."
      : `Authorize ${name}. You stay in control of what you share.`,
    conversation
      ? "Open your chosen conversation and send the Opryn instruction. No history scanning."
      : "Example source: Website revision policy. Only selected information is submitted.",
    "Information becomes proposed knowledge, not official policy.",
    "Approve, edit or reject. Nothing is published automatically.",
  ];
  return (
    <div className="source-preview">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setOpen(!open);
          setStep(0);
          setPlaying(!open && !reduced);
        }}
      >
        {open ? "Close preview" : "See how it works"}{" "}
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            initial={{ opacity: 0, y: reduced ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}
            className="source-preview-stage"
          >
            <small>Example workflow · Silent preview</small>
            <ol aria-label={`${name} example workflow`}>
              {stages.map((label, index) => (
                <li key={label}>
                  <button
                    type="button"
                    aria-label={`Preview step ${index + 1}: ${label}`}
                    aria-pressed={step === index}
                    onClick={() => {
                      setStep(index);
                      setPlaying(false);
                    }}
                  >
                    {index + 1}
                  </button>
                </li>
              ))}
            </ol>
            <motion.div
              key={step}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{
                duration: reduced ? 0 : motionTokens.duration.fast,
              }}
            >
              <strong>{stages[step]}</strong>
              <p>{descriptions[step]}</p>
              <div className="source-preview-document" aria-hidden="true">
                <span>Website revision policy</span>
                <p>Two revision rounds included.</p>
                <small>
                  {step === 3
                    ? "Human approval required"
                    : "Example information"}
                </small>
              </div>
            </motion.div>
            {!reduced && (
              <button
                type="button"
                onClick={() => {
                  if (step === 3) setStep(0);
                  setPlaying(step === 3 || !playing);
                }}
              >
                {step === 3
                  ? "Replay preview"
                  : playing
                    ? "Pause preview"
                    : "Play preview"}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
