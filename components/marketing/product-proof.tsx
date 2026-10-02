"use client";
import Image from "next/image";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MotionTabs, ActiveIndicator } from "@/components/motion/motion-tabs";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import { uiTransition } from "@/lib/motion/motion-tokens";
import "./product-proof.css";
const views = [
  {
    id: "teach",
    title: "Teach",
    copy: "Start with information your business already has.",
    alt: "Teach Opryn: explain, upload, choose Google files, or learn from calls.",
  },
  {
    id: "knowledge",
    title: "Knowledge",
    copy: "Know what’s approved, where it came from, and what needs attention.",
    alt: "Knowledge library with categories, sources and review status.",
  },
  {
    id: "needs-you",
    title: "Needs You",
    copy: "The decisions that need a person, ready for review.",
    alt: "Needs You: a proposed policy ready to accept or edit.",
  },
  {
    id: "connections",
    title: "Connections",
    copy: "Bring knowledge in. Make approved guidance available elsewhere.",
    alt: "Connections manager with searchable integrations.",
  },
];
export function ProductProof() {
  const [active, setActive] = useState(0);
  const reduced = useProductReducedMotion();
  const view = views[active];
  return (
    <section
      className="product-proof"
      id="inside-opryn"
      aria-labelledby="product-proof-title"
      data-animation-owner="motion"
    >
      <div className="story-shell">
        <header className="proof-heading">
          <div>
            <p className="editorial-label">The product, not a promise</p>
            <h2 id="product-proof-title">Inside Opryn.</h2>
          </div>
          <p>
            Actual interface. Example workspace.
            <br />
            No customer data or results shown.
          </p>
        </header>
        <div className="proof-stage">
          <MotionTabs>
            <div
              role="tablist"
              className="proof-steps"
              aria-label="Inside Opryn views"
            >
              {views.map((item, i) => (
                <button
                  role="tab"
                  type="button"
                  key={item.id}
                  id={`proof-tab-${item.id}`}
                  aria-selected={active === i}
                  aria-controls="proof-panel"
                  tabIndex={active === i ? 0 : -1}
                  onClick={() => setActive(i)}
                  onKeyDown={(e) => {
                    let next = i;
                    if (e.key === "ArrowRight") next = (i + 1) % 4;
                    else if (e.key === "ArrowLeft") next = (i + 3) % 4;
                    else if (e.key === "Home") next = 0;
                    else if (e.key === "End") next = 3;
                    else return;
                    e.preventDefault();
                    setActive(next);
                    document
                      .getElementById(`proof-tab-${views[next].id}`)
                      ?.focus();
                  }}
                >
                  {item.title}
                  {active === i && <ActiveIndicator />}
                </button>
              ))}
            </div>
          </MotionTabs>
          <div
            id="proof-panel"
            role="tabpanel"
            aria-labelledby={`proof-tab-${view.id}`}
            tabIndex={0}
            className="proof-window"
          >
            <div className="proof-window-bar" aria-hidden="true">
              <span>OPRYN / {view.title.toUpperCase()}</span>
              <span>EXAMPLE WORKSPACE</span>
            </div>
            <div className="proof-slides">
              <AnimatePresence initial={false}>
                <motion.figure
                  className="proof-slide"
                  key={view.id}
                  initial={{ opacity: 0, scale: reduced ? 1 : 0.99 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={uiTransition(reduced, 0.24)}
                >
                  <figcaption className="proof-caption">
                    <span className="proof-view-label">
                      0{active + 1} / {view.title}
                    </span>
                    {view.copy}
                  </figcaption>
                  <picture className="proof-image">
                    <source
                      media="(max-width:600px)"
                      srcSet={`/product-proof/${view.id}-390-retina.webp`}
                      width={390}
                      height={800}
                    />
                    <Image
                      src={`/product-proof/${view.id}-1180-retina.webp`}
                      alt={view.alt}
                      width={1180}
                      height={800}
                      unoptimized
                    />
                  </picture>
                </motion.figure>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
