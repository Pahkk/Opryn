"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TypingHeadline } from "@/components/brand/TypingHeadline";
import { MaskedHeadline } from "@/components/motion/signature-story";
import { MotionTabs, ActiveIndicator } from "@/components/motion/motion-tabs";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import { uiTransition } from "@/lib/motion/motion-tokens";
import {
  activeHeroVariant,
  heroStaticLine,
  heroVariants,
} from "@/lib/marketing/home-content";
export function KnowledgeHeroHeading() {
  const variant = heroVariants[activeHeroVariant];
  const [paused, setPaused] = useState(false);
  return (
    <div className="editorial-heading">
      <h1 className="knowledge-hero-heading">
        <MaskedHeadline>{variant.headline}</MaskedHeadline>
      </h1>
      <p className="editorial-hero-subhead">
        <span className="sr-only">{heroStaticLine}</span>
        <TypingHeadline lines={variant.lines} paused={paused} />
        <span className="knowledge-static" aria-hidden="true">
          {heroStaticLine}
        </span>
      </p>
      <button
        type="button"
        className="knowledge-motion-control"
        onClick={() => setPaused(!paused)}
        aria-pressed={paused}
      >
        {paused ? "Resume headline" : "Pause headline"}
      </button>
    </div>
  );
}
const consumers = [
  {
    name: "Team",
    question: "Can I approve a $300 refund?",
    answer: "Yes — if you’re a manager.",
  },
  {
    name: "Connected AI",
    question: "Who approves a $700 refund?",
    answer: "Owner approval is required.",
  },
];
export function SharedKnowledgeDemo() {
  const [index, setIndex] = useState(0);
  const reduced = useProductReducedMotion();
  const consumer = consumers[index];
  return (
    <motion.div
      className="hero-product"
      data-animation-owner="motion"
      aria-label="Interactive example of approved company knowledge"
      initial={false}
      animate={reduced ? {} : { y: [12, 0], scale: [0.99, 1] }}
      transition={uiTransition(reduced, 0.65)}
    >
      <header>
        <span>Opryn / Approved knowledge</span>
        <span className="source-tab">Example workspace</span>
      </header>
      <div className="hero-policy">
        <span className="hero-status">Approved · Version 3</span>
        <h2>Refund approval limits</h2>
        <dl>
          <div>
            <dt>MANAGER APPROVAL</dt>
            <dd>Up to $500</dd>
          </div>
          <div>
            <dt>ABOVE $500</dt>
            <dd>Owner approval</dd>
          </div>
        </dl>
      </div>
      <MotionTabs>
        <div
          className="hero-demo-controls"
          role="group"
          aria-label="Choose example consumer"
        >
          {consumers.map((c, i) => (
            <button
              key={c.name}
              type="button"
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
            >
              {c.name}
              {index === i && <ActiveIndicator />}
            </button>
          ))}
        </div>
      </MotionTabs>
      <div className="hero-answer" aria-live="polite">
        <AnimatePresence initial={false}>
          <motion.article
            key={index}
            initial={{ opacity: 0, y: reduced ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={uiTransition(reduced, 0.22)}
          >
            <p className="hero-question">“{consumer.question}”</p>
            <h3>{consumer.answer}</h3>
            <small>Source: Refund Policy · Approved company guidance</small>
          </motion.article>
        </AnimatePresence>
      </div>
      <footer>
        <span>ONE APPROVED SOURCE</span>
        <span>PERMISSION-CONTROLLED ACCESS</span>
      </footer>
    </motion.div>
  );
}
