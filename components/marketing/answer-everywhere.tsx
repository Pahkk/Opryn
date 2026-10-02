"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MotionTabs, ActiveIndicator } from "@/components/motion/motion-tabs";
import { DialogSurface } from "@/components/app/dialog-surface";
import { OprynTrace } from "@/components/motion/opryn-trace";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import { uiTransition } from "@/lib/motion/motion-tokens";

const audiences = [
  { label: "A teammate", context: "Team question", question: "How many revision rounds are included?", answer: "Two standard revision rounds are included in website projects." },
  { label: "A website bot", context: "Authorized agent lookup", question: "Can I offer a third revision round?", answer: "Additional rounds need project-lead approval before you commit." },
  { label: "A call agent", context: "Authorized voice-agent lookup", question: "A client wants more revisions. What should I do?", answer: "Ask the project lead to approve additional rounds." },
] as const;

/** A deterministic illustration. Never calls AI, sends messages or approves policy. */
export function AnswerEverywhere({ interfacePreview }: { interfacePreview: ReactNode }) {
  const [active, setActive] = useState(0);
  const [replay, setReplay] = useState(0);
  const [open, setOpen] = useState(false);
  const reduced = useProductReducedMotion();
  const audience = audiences[active];
  return (
    <section className="answer-everywhere" id="answer-everywhere" aria-labelledby="everywhere-title" data-animation-owner="motion">
      <div className="story-shell">
        <header className="everywhere-heading">
          <p className="editorial-label">One source. Useful answers.</p>
          <h2 id="everywhere-title">See one answer<br />work everywhere.</h2>
          <p>Different questions. The same <span className="opryn-marker">approved company guidance.</span></p>
        </header>
        <div className="everywhere-demo">
          <OprynTrace />
          <article className="everywhere-source">
            <span className="source-tab">Example workspace</span>
            <p className="editorial-label">Company knowledge / Version 1</p>
            <h3>Website revision policy</h3>
            <p>Website projects include two revision rounds. Additional rounds require project-lead approval.</p>
            <span className="hero-status">✓ Approved</span>
            <footer>Source: Project delivery policy</footer>
          </article>
          <div className="everywhere-output">
            <MotionTabs>
              <div className="everywhere-selector" role="group" aria-label="Choose an example audience">
                {audiences.map((item, index) => <button key={item.label} type="button" aria-pressed={index === active} onClick={() => setActive(index)}>{index === active && <ActiveIndicator />}{item.label}</button>)}
              </div>
            </MotionTabs>
            <div className="everywhere-answer" aria-live="polite" aria-atomic="true">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.article key={`${active}:${replay}`} initial={{ opacity: 0, y: reduced ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={uiTransition(reduced, 0.24)}>
                  <p className="editorial-label">{audience.context}</p>
                  <p className="everywhere-question">“{audience.question}”</p>
                  <h3>{audience.answer}</h3>
                  <small>Approved · Source: Project delivery policy · Version 1</small>
                </motion.article>
              </AnimatePresence>
            </div>
            <button type="button" className="everywhere-replay" onClick={() => setReplay(replay + 1)}>Replay example ↻</button>
          </div>
        </div>
        <div className="everywhere-footnote">
          <p>Illustrative lookups—not live messages or calls. Connected agents retrieve only the knowledge they’re authorized to use.</p>
          <button type="button" onClick={(event) => { event.currentTarget.focus({ preventScroll: true }); setOpen(true); }}>View the actual interface ↗</button>
        </div>
      </div>
      {open && <DialogSurface onClose={() => setOpen(false)} labelledBy="product-proof-title" className="interface-dialog">
        <div className="dialog-content">
        <button type="button" className="interface-close" onClick={() => setOpen(false)} aria-label="Close interface preview">Close ×</button>
        {interfacePreview}
        </div>
      </DialogSurface>}
    </section>
  );
}
