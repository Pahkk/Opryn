import Link from "next/link";
import { PLAN_DETAILS, PLAN_FEATURES } from "@/lib/billing/plans";
import { HumanReviewExample } from "./knowledge-flow-scene";
import { PublicAction } from "./public-motion";
import { SceneHeading, SceneReveal } from "./cinematic-motion";
import { OprynImageStack } from "./opryn-image-stack";
import "./premium-stack.css";
import SoftBlurIn from "@/components/smoothui/soft-blur-in";
import { EvidenceExample, MemoryPlayback } from "./interactive-story";
import "./editorial-home.css";

export function EditorialHome() {
  return (
    <main className="opryn-editorial-home cinematic-home" id="top">
      <section
        className="cinematic-scene cinematic-opening"
        aria-labelledby="cinematic-intro"
      >
        <div className="cinematic-shell cinematic-opening-grid">
          <div className="cinematic-opening-copy">
            <p className="cinematic-kicker" id="cinematic-intro">
              <SoftBlurIn stagger={12}>
                THE TRAINING LAYER FOR YOUR COMPANY
              </SoftBlurIn>
            </p>
            <SceneHeading
              hero
              signature
              lines={["Teach your", "business once."]}
            />
            <SceneReveal>
              <p className="cinematic-lead">
                Train every employee and AI agent from the same approved
                knowledge.
              </p>
              <div
                className="cinematic-outcome"
                aria-label="Less repeating yourself. Faster onboarding. Consistent answers."
              >
                <span>Less repeating</span>
                <span>Faster onboarding</span>
                <span>Consistent answers</span>
              </div>
              <div className="cinematic-actions">
                <PublicAction href="/signup">Get started</PublicAction>
                <PublicAction href="#how-it-works" variant="text">
                  See how it works
                </PublicAction>
              </div>
            </SceneReveal>
          </div>
        </div>
        <div className="cinematic-shell cinematic-opening-bottom">
          <span>SCROLL TO FOLLOW THE KNOWLEDGE</span>
          <span aria-hidden="true">↓</span>
        </div>
      </section>

      <section
        className="cinematic-shell premium-trust"
        aria-labelledby="shared-training-title"
      >
        <div className="premium-section-intro">
          <div>
            <p className="cinematic-kicker">ONE KNOWLEDGE LAYER</p>
            <h2
              id="shared-training-title"
              className="text-4xl font-semibold tracking-tight"
            >
              Two outcomes. One company truth.
            </h2>
          </div>
          <p>
            Opryn turns your processes, policies, documents, and answers into
            approved company knowledge — then uses it to train your people and
            govern your AI.
          </p>
        </div>
        <div className="premium-trust-grid">
          <div className="premium-trust-item">
            <span className="premium-field-label">PEOPLE</span>
            <h3 className="mt-4 text-2xl font-semibold">
              Learn what your role needs.
            </h3>
            <p className="mt-4">
              Read approved guidance, practice real situations, and learn what
              changed without repeating an entire course.
            </p>
          </div>
          <div className="premium-trust-item">
            <span className="premium-field-label">AI AGENTS</span>
            <h3 className="mt-4 text-2xl font-semibold">
              Operate from approved knowledge.
            </h3>
            <p className="mt-4">
              Control knowledge access, test Opryn’s answers for your connected
              AI, and route missing guidance to the right person.
            </p>
          </div>
        </div>
        <p className="mt-6">
          Both stay updated when your company changes. Training updates approved
          context and guidance; it does not fine-tune model weights.
        </p>
      </section>
      <section className="premium-gallery cinematic-shell" id="how-it-works">
        <div className="premium-section-intro">
          <div>
            <p className="cinematic-kicker">02 / THE KNOWLEDGE LOOP</p>
            <SceneHeading lines={["Bring in", "what you know."]} />
          </div>
          <p>
            Everything Opryn does follows one idea: capture what you know,
            review what matters, and reuse the answer.
          </p>
        </div>
        <OprynImageStack />
      </section>

      <section className="premium-trust cinematic-shell" id="review">
        <div className="premium-section-intro">
          <div>
            <p className="cinematic-kicker">03 / PEOPLE MAKE IT OFFICIAL</p>
            <SceneHeading
              signature
              lines={["You decide what", "becomes official."]}
            />
          </div>
          <p>
            You decide what becomes official. Every approved answer keeps its
            connection to the source.
          </p>
        </div>
        <div className="premium-trust-grid">
          <div className="premium-trust-item">
            <span className="premium-field-label">
              01 — REVIEW THE GUIDANCE
            </span>
            <HumanReviewExample />
          </div>
          <div className="premium-trust-item" id="knowledge-loop">
            <span className="premium-field-label">
              02 — INSPECT THE EVIDENCE
            </span>
            <EvidenceExample />
          </div>
        </div>
      </section>

      <section className="premium-memory cinematic-shell" id="company-memory">
        <div id="answer-everywhere" className="premium-section-intro">
          <div>
            <p className="cinematic-kicker">04 / ASK. DECIDE. REMEMBER.</p>
            <SceneHeading signature lines={["Ask your", "company."]} />
          </div>
          <p>
            When approved guidance is missing, a person supplies the answer.
            Reviewed knowledge can then help the next person.
          </p>
        </div>
        <MemoryPlayback />
        <div id="integrations" className="premium-connections">
          <div>
            <span className="premium-field-label">
              KNOWLEDGE, WHERE YOU WORK
            </span>
            <h3>
              Choose what comes in.
              <br />
              Control where it goes.
            </h3>
          </div>
          <PublicAction href="/integrations" variant="text">
            Explore integrations
          </PublicAction>
          <PublicAction href="/ai" variant="text">
            Opryn for connected AI
          </PublicAction>
        </div>
      </section>

      <section className="cinematic-scene cinematic-pricing-scene" id="pricing">
        <div className="cinematic-shell cinematic-asymmetric">
          <div className="cinematic-copy">
            <p className="cinematic-kicker">05 / PRICING</p>
            <SceneHeading lines={["Start with", "what fits."]} />
            <SceneReveal>
              <p>
                Keep building as Opryn becomes part of more of your workflow.
              </p>
              <PublicAction href="/pricing" variant="text">
                Compare plans
              </PublicAction>
            </SceneReveal>
          </div>
          <div className="cinematic-plan-pair">
            {(["core", "premium"] as const).map((plan) => (
              <article className={`cinematic-plan ${plan}`} key={plan}>
                <span>{PLAN_DETAILS[plan].name}</span>
                <strong>
                  ${PLAN_DETAILS[plan].monthlyPrice}
                  <small>/ month</small>
                </strong>
                <p>{PLAN_FEATURES[plan].teamLimit} employees, plus the owner</p>
                <Link href={`/signup?plan=${plan}`}>
                  Choose {PLAN_DETAILS[plan].name} ↗
                </Link>
              </article>
            ))}
          </div>
        </div>
        <p className="cinematic-shell cinematic-pricing-note">
          USD, billed monthly. Current annual options and checkout terms are on
          the pricing page.
        </p>
      </section>

      <section className="cinematic-scene cinematic-final-scene">
        <div className="cinematic-shell">
          <p className="cinematic-kicker">06 / START WITH ONE ANSWER</p>
          <SceneHeading signature lines={["Teach your", "business once."]} />
          <SceneReveal>
            <p>Stop repeating what your company already knows.</p>
            <PublicAction href="/signup">Get started</PublicAction>
          </SceneReveal>
        </div>
      </section>
    </main>
  );
}
