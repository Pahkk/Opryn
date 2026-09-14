"use client";

import { useEffect, useState } from "react";
import { TypingHeadline } from "@/components/brand/TypingHeadline";
import { MaskedHeadline } from "@/components/motion/signature-story";
import { useVisiblePlayback } from "@/components/brand/use-visible-playback";
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
    name: "Team member",
    question: "How many revisions are included?",
    answer: "Two revision rounds.",
    detail: "Additional rounds require project lead approval.",
  },
  {
    name: "Website bot",
    question: "A customer is asking for a third revision.",
    answer: "Additional rounds require project lead approval.",
    detail:
      "Retrieved company context. The connected bot decides how to present it.",
  },
];

export function SharedKnowledgeDemo() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const { ref, playing } = useVisiblePlayback<HTMLDivElement>(paused);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(
      () => setIndex((value) => (value + 1) % consumers.length),
      5200,
    );
    return () => window.clearInterval(timer);
  }, [playing]);
  return (
    <div
      className="shared-knowledge-demo editorial-demo"
      ref={ref}
      aria-label="Example: one approved source helps a person and a connected agent"
    >
      <header>
        <span>Example workflow</span>
        <button
          type="button"
          onClick={() => setPaused(!paused)}
          aria-pressed={paused}
        >
          {paused ? "Play demo" : "Pause demo"}
        </button>
      </header>
      <div className="shared-policy">
        <div className="editorial-source-heading">
          <span>Source · Website projects</span>
          <span className="editorial-approved">✓ Approved</span>
        </div>
        <h2>Revision rounds</h2>
        <p>
          Website projects include two revision rounds. Additional rounds
          require project lead approval.
        </p>
      </div>
      <div className="editorial-demo-path" aria-hidden="true">
        <span />↓<span />
      </div>
      <div
        className="shared-consumers"
        role="group"
        aria-label="Choose example consumer"
      >
        {consumers.map((consumer, i) => (
          <button
            type="button"
            key={consumer.name}
            aria-pressed={i === index}
            onClick={() => {
              setIndex(i);
              setPaused(true);
            }}
          >
            {consumer.name}
          </button>
        ))}
      </div>
      <div className="shared-answer-stack">
        {consumers.map((consumer, i) => (
          <article
            key={consumer.name}
            className={i === index ? "is-current" : ""}
            aria-hidden={i !== index}
          >
            <p className="shared-question">{consumer.question}</p>
            <h3>{consumer.answer}</h3>
            <p>{consumer.detail}</p>
            <span>Website projects → Revision rounds</span>
          </article>
        ))}
      </div>
      <footer>One source. Consistent guidance.</footer>
    </div>
  );
}
