"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import Image from "next/image";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import {
  ArrowDown,
  ArrowRight,
  Check,
  ChevronDown,
  FileText,
  Layers,
  X,
} from "lucide-react";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";

const chapters = [
  ["top", "Meet Opryn"],
  ["how-it-works", "Teach"],
  ["review", "Review"],
  ["answer-everywhere", "Ask"],
  ["knowledge-loop", "Sources"],
  ["company-memory", "Remember"],
  ["integrations", "Connections"],
  ["pricing", "Plans"],
] as const;

/** Original chapter navigator. Its state reflects the page, never fabricated activity. */
export function ExploreIsland() {
  const [open, setOpen] = useState(false);
  const [chapter, setChapter] = useState<string>("top");
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const reduced = useProductReducedMotion();
  const id = useId();
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) setChapter(entry.target.id);
      },
      { rootMargin: "-15% 0px -60% 0px" },
    );
    chapters.forEach(([anchor]) => {
      const element = document.getElementById(
        anchor === "top" ? "cinematic-intro" : anchor,
      );
      if (element) observer.observe(element);
    });
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => {
      observer.disconnect();
      document.removeEventListener("pointerdown", outside);
    };
  }, []);
  const goToChapter = (
    event: MouseEvent<HTMLAnchorElement>,
    anchor: (typeof chapters)[number][0],
  ) => {
    event.preventDefault();
    setOpen(false);

    if (anchor === "top") {
      window.scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" });
    } else {
      document
        .getElementById(anchor)
        ?.scrollIntoView({
          behavior: reduced ? "auto" : "smooth",
          block: "start",
        });
    }
    window.history.replaceState(null, "", `#${anchor}`);
  };
  return (
    <div
      className="explore-island-position"
      ref={root}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <motion.div
        layout={!reduced}
        className="explore-island"
        transition={{ duration: reduced ? 0 : 0.25 }}
      >
        <button
          ref={trigger}
          className="island-trigger"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          <Image src="/opryn-mark.png" width={25} height={25} alt="" />
          <span>Explore Opryn</span>
          <span className="island-chapter">
            {chapters.find(([key]) => key === chapter)?.[1] ?? "Meet Opryn"}
          </span>
          {open ? <X size={16} /> : <ChevronDown size={16} />}
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.nav
              id={id}
              aria-label="Explore page chapters"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: reduced ? 0 : 0.22 }}
            >
              <div className="island-chapters">
                {chapters.map(([anchor, label], index) => (
                  <a
                    key={anchor}
                    href={`#${anchor}`}
                    aria-current={chapter === anchor ? "location" : undefined}
                    onClick={(event) => goToChapter(event, anchor)}
                  >
                    <small>{String(index + 1).padStart(2, "0")}</small>
                    <span>{label}</span>
                    <ArrowRight size={14} />
                  </a>
                ))}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

const panels = [
  {
    name: "Teach",
    eyebrow: "START WITH WHAT YOU HAVE",
    title: "Your knowledge.\nA useful starting point.",
    copy: "Bring in documents, answers, and selected connected sources.",
    icon: FileText,
    tags: ["Documents", "Processes", "Answers"],
    href: "#how-it-works",
  },
  {
    name: "Review",
    eyebrow: "HUMAN AUTHORITY",
    title: "You make\nit official.",
    copy: "Review proposed guidance before it becomes company knowledge.",
    icon: Check,
    tags: ["Proposed", "Reviewed", "Approved"],
    href: "#review",
  },
  {
    name: "Reuse",
    eyebrow: "KNOWLEDGE THAT WORKS",
    title: "One answer.\nMore places to use it.",
    copy: "Your team and permitted connected AI can use approved guidance.",
    icon: Layers,
    tags: ["Team", "Connected AI", "Source attached"],
    href: "#answer-everywhere",
  },
];

export function ExpandingStoryPanels() {
  const [active, setActive] = useState(0);
  const reduced = useProductReducedMotion();
  const id = useId();
  return (
    <LayoutGroup id={id}>
      <div className="story-panels" aria-label="Explore the Opryn workflow">
        {panels.map((panel, index) => {
          const Icon = panel.icon;
          return (
            <motion.article
              layout={!reduced}
              className={`story-panel ${active === index ? "is-active" : ""}`}
              key={panel.name}
              transition={{ duration: reduced ? 0 : 0.3 }}
            >
              <button
                className="story-panel-selector"
                aria-expanded={active === index}
                aria-controls={`${id}-${index}`}
                onClick={() => setActive(index)}
              >
                <span className="story-panel-number">0{index + 1}</span>
                <span>{panel.name}</span>
                <Icon size={20} />
              </button>
              {active === index ? (
                <motion.div
                  id={`${id}-${index}`}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="story-panel-body"
                >
                  <span className="story-panel-eyebrow">{panel.eyebrow}</span>
                  <h2>{panel.title}</h2>
                  <p>{panel.copy}</p>
                  <div className="story-panel-tags">
                    {panel.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <a href={panel.href}>
                    Explore {panel.name.toLowerCase()} <ArrowRight size={16} />
                  </a>
                </motion.div>
              ) : (
                <div className="story-panel-rest" aria-hidden="true">
                  <Icon size={64} strokeWidth={1} />
                  <span>{panel.eyebrow}</span>
                </div>
              )}
            </motion.article>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

export function EvidenceExample() {
  const [open, setOpen] = useState(false);
  const reduced = useProductReducedMotion();
  const id = useId();
  return (
    <div className="cinematic-source-answer evidence-example">
      <span>ILLUSTRATIVE APPROVED ANSWER</span>
      <strong>Manager approval is required for refunds over $500.</strong>
      <button
        className="evidence-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <FileText size={21} />
        <span>
          <b>Customer Service Handbook</b>
          <small>Inspect the example source</small>
        </span>
        <ChevronDown
          size={18}
          style={{ transform: open ? "rotate(180deg)" : undefined }}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={id}
            className="evidence-excerpt"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
          >
            <div>
              <span>EXAMPLE EXCERPT · REFUND POLICY</span>
              <blockquote>Refunds over $500 need manager approval.</blockquote>
              <p>
                <Check size={14} /> Human review decides what becomes official.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const moments = [
  {
    label: "Question",
    status: "NO APPROVED ANSWER YET",
    question: "Can I refund a $750 order?",
    answer: "Ask the right person.",
    detail:
      "An unknown question reveals the guidance your business still needs.",
  },
  {
    label: "Human answer",
    status: "PROPOSED GUIDANCE",
    question: "The business supplies the missing truth.",
    answer: "Refunds over $500 need manager approval.",
    detail:
      "A useful answer can become a proposal. It is not policy until reviewed.",
  },
  {
    label: "Review",
    status: "APPROVED KNOWLEDGE",
    question: "A person reviews the proposal.",
    answer: "Refund policy · Approved",
    detail:
      "The source stays attached. Human review makes the guidance official.",
  },
  {
    label: "Reuse",
    status: "ANSWER FROM APPROVED KNOWLEDGE",
    question: "Can I refund a $900 order?",
    answer: "Manager approval is required.",
    detail:
      "The next similar question can use the reviewed answer with its source.",
  },
];

export function MemoryPlayback() {
  const [step, setStep] = useState(0);
  const reduced = useProductReducedMotion();
  const id = useId();
  const moment = moments[step];
  return (
    <LayoutGroup id={id}>
      <div className="memory-playback">
        <div className="memory-controls" aria-label="Example knowledge journey">
          {moments.map((item, index) => (
            <button
              key={item.label}
              aria-pressed={index === step}
              onClick={() => setStep(index)}
            >
              {step === index && (
                <motion.span
                  className="memory-selection"
                  layoutId={reduced ? undefined : "memory-selection"}
                  transition={{ duration: 0.2 }}
                />
              )}
              <span>
                <small>0{index + 1}</small>
                {item.label}
              </span>
            </button>
          ))}
        </div>
        <div className="memory-stage" aria-live="polite" aria-atomic="true">
          <motion.div
            key={step}
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <span className="story-panel-eyebrow">
              ILLUSTRATIVE WORKFLOW / {moment.status}
            </span>
            <p className="memory-question">{moment.question}</p>
            <ArrowDown size={22} className="memory-arrow" />
            <h3>{moment.answer}</h3>
            <p className="memory-detail">{moment.detail}</p>
          </motion.div>
        </div>
        <div className="memory-bottom">
          <span>Human judgment → company memory</span>
          <button onClick={() => setStep((step + 1) % moments.length)}>
            {step === 3 ? "Replay example" : "Next step"}
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </LayoutGroup>
  );
}
