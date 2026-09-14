"use client";
import { useLayoutEffect, useRef } from "react";
import {
  DocumentIcon,
  KnowledgeIcon,
  AskIcon,
} from "@/components/opryn-icons/opryn-icons";
import { gsap, motionScope } from "@/lib/motion/gsap";
export function WelcomeStory() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const scope = motionScope(ref.current);
    scope.run(() => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.fromTo(
        ref.current!.querySelectorAll("[data-setup-object]"),
        { x: -16, scale: 0.97 },
        {
          x: 0,
          scale: 1,
          duration: 0.4,
          stagger: 0.12,
          clearProps: "transform",
        },
      ).fromTo(
        ref.current!.querySelectorAll(":scope > svg path"),
        { strokeDasharray: 100, strokeDashoffset: 100 },
        {
          strokeDashoffset: 0,
          duration: 0.4,
          stagger: 0.14,
          clearProps: "strokeDasharray,strokeDashoffset",
        },
        0.1,
      );
    });
    return () => scope.dispose();
  }, []);
  return (
    <aside
      className="setup-welcome-story"
      ref={ref}
      aria-label="Information becomes reviewed guidance for people and AI"
    >
      <p className="activation-eyebrow">One useful answer starts here</p>
      <div data-setup-object>
        <DocumentIcon />
        <span>
          <small>01 · INFORMATION</small>Your business, as it is.
        </span>
      </div>
      <svg viewBox="0 0 40 46" aria-hidden>
        <path d="M20 1V44" pathLength="100" />
      </svg>
      <div data-setup-object className="setup-story-authority">
        <KnowledgeIcon />
        <span>
          <small>02 · REVIEW</small>You decide what’s official.
          <em>Proposed → Approved</em>
        </span>
      </div>
      <svg viewBox="0 0 40 46" aria-hidden>
        <path d="M20 1V44" pathLength="100" />
      </svg>
      <div data-setup-object>
        <AskIcon />
        <span>
          <small>03 · PEOPLE + AI</small>One source of guidance.
        </span>
      </div>
      <p className="activation-note">
        Start with one real source. Review it. Ask your first question.
      </p>
    </aside>
  );
}
