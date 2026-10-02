"use client";
import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { prefersReducedMotion } from "@/lib/motion/reduced-motion";
import "./knowledge-centerpiece.css";
import { KnowledgeScene } from "./knowledge-scene";

gsap.registerPlugin(useGSAP);
export function KnowledgeCenterpiece() {
  const rootRef = useRef<HTMLElement>(null);
  const [staticView, setStaticView] = useState(false);
  useGSAP(
    () => {
      const root = rootRef.current;
      if (!root || staticView || !("IntersectionObserver" in window)) return;
      let disposed = false;
      let cleanup: (() => void) | undefined;
      let nearby = false;
      let generation = 0;
      let resizeTimer: ReturnType<typeof setTimeout> | undefined;
      let resumeProgress: number | null = null;
      const desktop = matchMedia("(min-width: 1024px) and (min-height: 620px)");
      const reduced = matchMedia("(prefers-reduced-motion: reduce)");
      const initialize = () => {
        const current = ++generation;
        cleanup?.();
        cleanup = undefined;
        if (!nearby || disposed || prefersReducedMotion(root)) return;
        delete root.dataset.fallback;
        const motionModule = desktop.matches
          ? import("./knowledge-centerpiece-motion")
          : import("./knowledge-centerpiece-mobile");
        void motionModule
          .then(async ({ mountKnowledgeStory }) => {
            await document.fonts.ready;
            // The story uses reserved-size logos. Start their requests near the
            // viewport; do not block pin initialization on lazy images/offline IO.
            root.querySelectorAll("img").forEach((image) => {
              image.loading = "eager";
            });
            if (!disposed && current === generation) {
              cleanup = mountKnowledgeStory(root);
              if (resumeProgress !== null && root.dataset.enhanced) {
                const track = root.querySelector<HTMLElement>(".kc-track")!;
                const top = track.getBoundingClientRect().top + scrollY - 88;
                window.scrollTo({
                  top:
                    top + Number(root.dataset.scrollDistance) * resumeProgress,
                  behavior: "instant",
                });
              }
              resumeProgress = null;
            }
          })
          .catch((error) => {
            if (process.env.NODE_ENV === "development")
              console.warn("Opryn story: using readable fallback", error);
            if (!disposed && current === generation)
              root.dataset.fallback = "true";
          });
      };
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (!entry.isIntersecting) return;
          observer.disconnect();
          nearby = true;
          initialize();
        },
        { rootMargin: "600px 0px" },
      );
      observer.observe(root);
      // Pin dimensions and Flip snapshots must be recaptured together. A simple
      // path refresh can otherwise measure the previous pin width during resize.
      const resize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
          if (!desktop.matches || !nearby || disposed) return;
          resumeProgress =
            root.dataset.storyActive === "true"
              ? Number(root.dataset.storyProgress || 0)
              : null;
          initialize();
        }, 180);
      };
      window.addEventListener("resize", resize, { passive: true });
      desktop.addEventListener("change", initialize);
      reduced.addEventListener("change", initialize);
      return () => {
        disposed = true;
        observer.disconnect();
        clearTimeout(resizeTimer);
        window.removeEventListener("resize", resize);
        desktop.removeEventListener("change", initialize);
        reduced.removeEventListener("change", initialize);
        cleanup?.();
      };
    },
    { dependencies: [staticView], scope: rootRef, revertOnUpdate: true },
  );
  return (
    <>
      <section
        data-motion-owner="gsap"
        data-animation-owner="gsap"
        id="how-it-works"
        className="knowledge-centerpiece"
        ref={rootRef}
        data-static={staticView || undefined}
        aria-labelledby="kc-heading"
      >
        <div className="story-shell">
          <div className="kc-controls">
            <p className="editorial-label">How Opryn works</p>
            <button
              type="button"
              onClick={() => setStaticView((v) => !v)}
              aria-pressed={staticView}
            >
              {staticView ? "Enable storytelling" : "Read without animation"}
            </button>
            <a href="#after-knowledge-story">Skip story ↓</a>
          </div>
          <div className="kc-track">
            <KnowledgeScene />
          </div>
          <div className="kc-story-note">
            <p className="kc-caveat">
              Illustrative guidance, not automatic refunds. New approvals are
              available on the next authorized lookup—not rewritten into old
              conversations or third-party caches.
            </p>
          </div>
        </div>
        <noscript>
          <style>
            {".knowledge-centerpiece .kc-track{min-height:0!important}"}
          </style>
        </noscript>
      </section>
    </>
  );
}

export function WhyOpryn() {
  const stages = [
    [
      "Bring in what you know",
      "Keep your sources. Start with selected files, calls or an answer.",
    ],
    [
      "Decide what’s official",
      "A person reviews the proposed guidance before it becomes official.",
    ],
    [
      "Use it — and keep learning",
      "Give people and authorized AI guidance. Let unanswered questions show what’s missing.",
    ],
  ];
  return (
    <section
      id="why-opryn"
      className="kc-difference"
      aria-labelledby="kc-difference-title"
    >
      <div className="story-shell">
        <header className="kc-why-heading">
          <p className="editorial-label">Why Opryn</p>
          <h2 id="kc-difference-title">Your information already exists.</h2>
          <p className="kc-difference-intro">
            What’s missing is the layer that decides what the business can rely
            on.
          </p>
        </header>
        <div className="kc-why-stages">
          {stages.map(([title, copy], i) => (
            <article key={title}>
              <span className="kc-why-number">0{i + 1}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
        <div className="kc-operation" aria-labelledby="kc-operation-title">
          <header>
            <p className="editorial-label">Finding it is only the beginning</p>
            <h3 id="kc-operation-title">From information to operation.</h3>
          </header>
          <div className="kc-operation-steps">
            <div>
              <h4>Information system</h4>
              <p>Store · Organize · Search · Read</p>
            </div>
            <span className="kc-operation-arrow" aria-hidden="true">
              →
            </span>
            <div>
              <h4>Operational knowledge</h4>
              <p>Capture · Review · Approve · Use · Learn</p>
            </div>
          </div>
          <p className="kc-operation-note">
            Opryn’s emphasis: continue beyond finding information to reviewing
            and using it.
          </p>
        </div>
      </div>
    </section>
  );
}
