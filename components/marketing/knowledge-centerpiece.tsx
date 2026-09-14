"use client";
import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "gsap";
import { SiGoogledocs, SiGooglesheets } from "react-icons/si";
import { OprynLogo } from "@/components/opryn-logo";
import {
  CallsIcon,
  TeamIcon,
  TrainingIcon,
  ConnectionIcon,
} from "@/components/opryn-icons/opryn-icons";
import { prefersReducedMotion } from "@/lib/motion/reduced-motion";
import "./knowledge-centerpiece.css";

gsap.registerPlugin(useGSAP);
const endpointIcons = [
  TeamIcon,
  TrainingIcon,
  ConnectionIcon,
  ConnectionIcon,
  CallsIcon,
];
const storyStages = [
  "Information",
  "Structure",
  "Review",
  "Approved",
  "Use",
  "Learn",
];

const headlines = [
  "Your business already knows the answer.",
  "Finding it is only the beginning.",
  "Information isn’t the same as company knowledge.",
  "Someone decides what’s official.",
  "Now the business has an answer.",
  "One answer. Wherever it’s needed.",
  "And when the business doesn’t have an answer…",
  "…it learns the right way.",
  "Your tools can stay. Know what’s official.",
];
const destinations = [
  ["Team", "Can I approve $300?", "Yes—if you’re a manager."],
  ["New hire", "Refund approvals", "Managers: up to $500."],
  [
    "Connected AI",
    "What’s our refund approval policy?",
    "Manager approval up to $500…",
  ],
  ["Support", "$700 refund", "Owner approval required."],
  ["Call agent", "$600 refund", "Escalate to the owner."],
];

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
      const desktop = matchMedia("(min-width: 1024px) and (min-height: 760px)");
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
          .then(({ mountKnowledgeStory }) => {
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
          .catch(() => {
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
            <div className="kc-stage">
              <aside className="kc-progress" aria-hidden="true">
                <span className="kc-progress-caption">Scroll story</span>
                <div className="kc-progress-track">
                  <i />
                </div>
                <ol>
                  {storyStages.map((name, i) => (
                    <li key={name} data-stage={i}>
                      <span>0{i + 1}</span>
                      <b>{name}</b>
                    </li>
                  ))}
                </ol>
              </aside>
              <div className="kc-stage-meta">
                <span>Example workflow</span>
                <span>Information → authority → use</span>
              </div>
              <h2 id="kc-heading" className="kc-accessible-heading">
                From information to trusted company knowledge.
              </h2>
              <div className="kc-headlines" aria-hidden="true">
                {headlines.map((headline, i) => (
                  <div
                    className={`kc-headline kc-headline-${i}`}
                    key={headline}
                  >
                    <p>{headline}</p>
                  </div>
                ))}
              </div>
              <p className="kc-scattered-label">
                It’s just scattered everywhere.
              </p>
              <div
                className="kc-sources"
                aria-label="Example company information"
              >
                <article className="kc-fragment kc-doc" data-source="0">
                  <div className="kc-fragment-title">
                    <SiGoogledocs aria-hidden="true" />
                    <span>
                      Google Docs <strong>Refund Policy</strong>
                    </span>
                  </div>
                  <div className="kc-fragment-content">
                    <p>
                      Managers may approve refunds up to $500. Above $500
                      requires owner approval.
                    </p>
                    <div className="kc-document-lines" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                </article>
                <article className="kc-fragment kc-sheet" data-source="1">
                  <div className="kc-fragment-title">
                    <SiGooglesheets aria-hidden="true" />
                    <span>
                      Google Sheets <strong>Pricing</strong>
                    </span>
                  </div>
                  <div className="kc-fragment-content">
                    <table>
                      <caption className="kc-sr">
                        Example service pricing, not refund authority
                      </caption>
                      <tbody>
                        <tr>
                          <td>Consultation</td>
                          <td>$300</td>
                        </tr>
                        <tr>
                          <td>Service package</td>
                          <td>$700</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </article>
                <article className="kc-fragment kc-call" data-source="2">
                  <div className="kc-fragment-title">
                    <span className="kc-transcript-mark" aria-hidden="true">
                      <CallsIcon />
                    </span>
                    <span>
                      Selected call <strong>Customer escalation</strong>
                    </span>
                  </div>
                  <div className="kc-fragment-content">
                    <p>
                      “This refund is above my limit. I’ll ask the owner to
                      review it.”
                    </p>
                    <span className="kc-source-note">Transcript fragment</span>
                  </div>
                </article>
                <article className="kc-fragment kc-owner" data-source="3">
                  <div className="kc-fragment-title">
                    <span className="kc-person-mark" aria-hidden="true">
                      O
                    </span>
                    <span>
                      Owner answer <strong>Refund authority</strong>
                    </span>
                  </div>
                  <div className="kc-fragment-content">
                    <p>“Ask me before approving anything above $500.”</p>
                    <span className="kc-source-note">Shared with Opryn</span>
                  </div>
                </article>
              </div>
              <div className="kc-discovery" aria-hidden="true">
                <p>Pages · Search · Documents</p>
                <div className="kc-search-demo">
                  <span>refund approval</span>
                  <strong>↳ Refund Policy</strong>
                  <strong>↳ Pricing</strong>
                  <strong>↳ Call transcript</strong>
                </div>
                <small>Store it. Search it. Find it.</small>
              </div>
              <svg className="kc-paths" aria-hidden="true">
                <path className="kc-intake-path" />
                {destinations.map(([name], i) => (
                  <path className="kc-out-path" data-path={i} key={name} />
                ))}
                <path className="kc-ecosystem-path" />
                <path className="kc-feedback-path" />
              </svg>
              <div className="kc-hub-slot" aria-hidden="true" />
              <article className="kc-knowledge" data-kc-block>
                <div className="kc-knowledge-top">
                  <OprynLogo size="small" />
                  <div className="kc-status">
                    <span className="kc-pending">Needs Review</span>
                    <span className="kc-confirmed">Approved</span>
                  </div>
                </div>
                <div className="kc-object-label">
                  <span className="kc-proposed-label">Proposed knowledge</span>
                  <span className="kc-approved-label">Approved knowledge</span>
                </div>
                <h3>Refund approval limits</h3>
                <dl className="kc-rule">
                  <div>
                    <dt>Managers may approve</dt>
                    <dd>Up to $500</dd>
                  </div>
                  <div>
                    <dt>Above $500</dt>
                    <dd>Owner approval required</dd>
                  </div>
                </dl>
                <div className="kc-authority">
                  <p>Not official yet.</p>
                  <div
                    className="kc-review-actions"
                    aria-label="Example actions, not interactive controls"
                  >
                    <span className="kc-approve-action">Approve</span>
                    <span>Edit</span>
                    <span>Deny</span>
                    <i className="kc-focus-ring" aria-hidden="true" />
                  </div>
                  <small>An authorized person makes the decision.</small>
                </div>
                <p className="kc-confirmation">
                  Source-backed · Approved · Example version 3
                </p>
                <div className="kc-provenance">
                  <span>Sources retained</span>
                  <p>Refund Policy · Owner answer</p>
                  <small>
                    Pricing and call context stay separate from approval
                    authority.
                  </small>
                </div>
              </article>
              <div
                className="kc-destinations"
                aria-label="Authorized people and connected external AI use the approved rule"
              >
                {destinations.map(([name, question, answer], i) => {
                  const Icon = endpointIcons[i];
                  return (
                    <article
                      className={`kc-destination kc-destination-${i}`}
                      data-kc-block
                      key={name}
                    >
                      <h3>
                        <Icon size={18} />
                        {name}
                      </h3>
                      <p>{question}</p>
                      <strong>{answer}</strong>
                    </article>
                  );
                })}
              </div>
              <section
                className="kc-feedback"
                aria-label="Example unanswered question and review loop"
              >
                <div className="kc-gap-question">
                  <span className="editorial-label">Employee question</span>
                  <h3>What if it’s $850, but the shipment never arrived?</h3>
                  <p className="kc-gap-result">
                    No approved answer for this exception.
                  </p>
                  <small>
                    The general refund limit still applies; this exception needs
                    review.
                  </small>
                </div>
                <div className="kc-gap-route">
                  <span>Knowledge gap</span>
                  <strong>Route to owner / expert</strong>
                </div>
                <div className="kc-gap-answer">
                  <span className="editorial-label">
                    Owner answer · example
                  </span>
                  <p>Escalate undelivered orders above $500 to Operations.</p>
                  <div className="kc-gap-review">
                    <span>Remember this?</span>
                    <b>Add for review →</b>
                  </div>
                  <small className="kc-gap-queued">
                    Proposed update → human review.
                  </small>
                  <p className="kc-gap-publish">
                    After human approval <span>Approved for reuse</span>
                  </p>
                </div>
              </section>
              <div className="kc-ecosystem" data-kc-block>
                <div className="kc-ecosystem-input">
                  <span>What your business knows</span>
                  <p>
                    Selected Google files
                    <br />
                    Uploads · Calls
                    <br />
                    Owner answers
                  </p>
                </div>
                <div className="kc-ecosystem-output">
                  <span>Who needs to know it</span>
                  <p>
                    Employees · New hires
                    <br />
                    ChatGPT · Claude
                    <br />
                    Connected support & call agents
                  </p>
                </div>
                <p className="kc-positioning">
                  One approved source between your information and the people
                  and AI authorized to use it.
                </p>
              </div>
              <p className="kc-static-summary">
                Information is proposed, reviewed by a person, then approved.
                Authorized people and connected AI retrieve that same approved
                guidance.
              </p>
            </div>
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
