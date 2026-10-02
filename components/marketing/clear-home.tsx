import Link from "next/link";
import { PLAN_DETAILS, PLAN_FEATURES } from "@/lib/billing/plans";
import { ProviderLogo } from "@/components/connections/provider-logo";
import { PublicAction, PublicReveal } from "./public-motion";
import { KnowledgeDemo } from "./knowledge-demo";
import { MotionWords } from "@/components/motion/motion-text";
import "./clear-home.css";

const sources = [
  ["google_drive", "Google Workspace", "Choose Docs, Sheets and Slides."],
  ["notion", "Notion", "Choose pages or databases."],
  ["confluence", "Confluence", "Choose pages or spaces."],
];
const destinations = [
  ["slack", "Slack", "Ask Opryn from supported Slack conversations."],
  ["teams", "Microsoft Teams", "Ask through the configured Teams bot."],
  [
    "chatgpt",
    "ChatGPT",
    "Retrieve permitted guidance in supported connections. Pro.",
  ],
  [
    "claude",
    "Claude",
    "Retrieve permitted guidance in supported connections. Pro.",
  ],
];

export function ClearHome() {
  return (
    <main className="clear-home">
      <section
        className="clear-hero clear-wrap"
        id="top"
        aria-labelledby="home-title"
      >
        <div className="clear-hero-copy">
          <p className="clear-label">Company knowledge for people and AI</p>
          <h1 id="home-title">
            <MotionWords text="Teach your business once." />
          </h1>
          <p className="clear-lede">
            Opryn turns your company’s processes, policies, and answers into
            approved knowledge your employees and connected AI can use.
          </p>
          <p className="clear-outcome">
            Less repeating yourself. Faster onboarding.
            <br />
            Consistent company answers.
          </p>
          <div className="clear-actions">
            <PublicAction href="/signup" rolling>
              Get started
            </PublicAction>
            <PublicAction href="#how-it-works" variant="secondary">
              See how it works
            </PublicAction>
          </div>
          <p className="clear-inputs">
            Start with documents, an answer, or selected connected sources.
            Opryn organizes what you provide; a person approves what becomes
            official.
          </p>
        </div>
        <KnowledgeDemo />
      </section>

      <section
        className="clear-wrap clear-section"
        id="answer-everywhere"
        aria-labelledby="audience-title"
      >
        <PublicReveal>
          <header className="clear-heading">
            <p className="clear-label">Who it helps</p>
            <h2 id="audience-title">
              One reviewed source. Two ways to use it.
            </h2>
          </header>
          <div className="clear-audiences">
            <article>
              <p className="clear-label">For your team</p>
              <h3>Give people answers without repeating yourself.</h3>
              <p>
                Employees and new hires can use company guidance instead of
                asking the same people every time.
              </p>
              <div className="clear-mini">
                <span>Example · “Can I include a third revision?”</span>
                <strong>
                  Additional revisions require project-lead approval.
                </strong>
                <small>Source: Website Revision Policy · Approved</small>
              </div>
            </article>
            <article>
              <p className="clear-label">For your AI</p>
              <h3>Give your AI company context.</h3>
              <p>
                Compatible AI tools can retrieve the approved knowledge they’re
                allowed to use.
              </p>
              <div className="clear-mini">
                <span>Example · Authorized AI lookup</span>
                <strong>
                  Project-lead approval is required for extra revisions.
                </strong>
                <small>
                  Source: Website Revision Policy · Access controlled
                </small>
              </div>
              <Link href="/ai" className="clear-link">
                Explore AI connections →
              </Link>
            </article>
          </div>
        </PublicReveal>
      </section>

      <section
        className="clear-wrap clear-section"
        id="how-it-works"
        aria-labelledby="how-title"
      >
        <PublicReveal>
          <header className="clear-heading">
            <p className="clear-label">How Opryn works</p>
            <h2 id="how-title">Bring it in. Review it. Put it to use.</h2>
          </header>
          <ol className="clear-steps">
            <li>
              <span>01</span>
              <h3>Bring in what you already know</h3>
              <p>
                Choose Google, Notion or Confluence content. Upload files or
                authorized recordings, or explain it yourself.
              </p>
            </li>
            <li>
              <span>02</span>
              <h3>Review what becomes official</h3>
              <p>
                Opryn prepares proposed knowledge. A person approves, edits, or
                rejects it.
              </p>
            </li>
            <li>
              <span>03</span>
              <h3>Use it everywhere</h3>
              <p>
                Employees and compatible connected AI retrieve the guidance
                their access permits.
              </p>
            </li>
          </ol>
          <p className="clear-gap">
            When Opryn doesn’t know, it can route the question back to the right
            person.
          </p>
        </PublicReveal>
      </section>

      <section
        className="clear-wrap clear-section"
        id="integrations"
        aria-labelledby="connections-title"
      >
        <PublicReveal>
          <header className="clear-heading clear-heading-inline">
            <div>
              <p className="clear-label">Your tools, with a clear purpose</p>
              <h2 id="connections-title">
                Choose what comes in. Control who uses it.
              </h2>
            </div>
            <Link href="/integrations" className="clear-link">
              View all integrations →
            </Link>
          </header>
          <div className="clear-integrations">
            <div>
              <h3 className="clear-label">Learn from</h3>
              {sources.map(([id, name, copy]) => (
                <div className="clear-provider" key={id}>
                  <ProviderLogo id={id} name={name} />
                  <div>
                    <strong>{name}</strong>
                    <p>{copy}</p>
                  </div>
                </div>
              ))}
              <p className="clear-note">
                Or upload files and selected recordings, or explain a process.
              </p>
            </div>
            <div>
              <h3 className="clear-label">Use Opryn in</h3>
              {destinations.map(([id, name, copy]) => (
                <div className="clear-provider" key={id}>
                  <ProviderLogo id={id} name={name} />
                  <div>
                    <strong>{name}</strong>
                    <p>{copy}</p>
                  </div>
                </div>
              ))}
              <p className="clear-note">
                API / MCP: supported setup and access permissions required.
              </p>
            </div>
          </div>
          <p className="clear-note">
            Connecting does not import everything or grant access to chat
            history. Provider setup, account compatibility and plan limits
            apply.
          </p>
          <aside className="clear-trust" aria-labelledby="trust-title">
            <div>
              <h3 id="trust-title">
                Your business decides what becomes official.
              </h3>
              <ul>
                <li>Human review</li>
                <li>Sources attached</li>
                <li>Controlled access</li>
              </ul>
              <p>
                Approval records a human decision—not a guarantee of
                correctness.
              </p>
            </div>
            <Link href="/security" className="clear-link">
              See security &amp; data handling →
            </Link>
          </aside>
        </PublicReveal>
      </section>

      <section
        className="clear-wrap clear-section clear-pricing"
        id="pricing"
        aria-labelledby="pricing-title"
      >
        <PublicReveal>
          <header className="clear-heading clear-heading-inline">
            <div>
              <p className="clear-label">Start with one useful answer</p>
              <h2 id="pricing-title">A plan for your company knowledge.</h2>
            </div>
            <Link href="/pricing" className="clear-link">
              Compare all plans →
            </Link>
          </header>
          <div className="clear-plans">
            {(["core", "premium"] as const).map((plan) => (
              <article key={plan}>
                <p className="clear-label">{PLAN_DETAILS[plan].name}</p>
                <h3>
                  ${PLAN_DETAILS[plan].monthlyPrice}
                  <small>/month</small>
                </h3>
                <p>
                  {plan === "core"
                    ? "For teams building shared company guidance."
                    : "For richer sources and supported AI connections."}
                </p>
                <ul>
                  <li>
                    One owner + up to {PLAN_FEATURES[plan].teamLimit} employees
                  </li>
                  <li>
                    {plan === "core"
                      ? "Ask, processes, training and human review"
                      : "Everything in Starter"}
                  </li>
                  <li>
                    {plan === "core"
                      ? "Documents, Google files, text and audio"
                      : "Video, screen recordings and call learning"}
                  </li>
                  <li>
                    {plan === "core"
                      ? "External AI Connections and Agent API"
                      : "Supported ChatGPT / Claude connections"}
                  </li>
                  {plan === "premium" && (
                    <li>Learn from conversations you explicitly send</li>
                  )}
                </ul>
                <PublicAction
                  href={`/signup?plan=${plan}`}
                  variant={plan === "core" ? "secondary" : "primary"}
                >
                  Get started with {plan === "core" ? "Starter" : "Pro"}
                </PublicAction>
              </article>
            ))}
          </div>
          <p className="clear-note">
            USD, billed monthly. Annual billing and current trial eligibility
            are explained on <Link href="/pricing">the pricing page</Link>.
            Pending invitations count toward employee limits.
          </p>
          <div className="clear-final">
            <h3>Start with one process, policy, or answer.</h3>
            <PublicAction href="/signup" rolling>
              Get started
            </PublicAction>
          </div>
        </PublicReveal>
      </section>
    </main>
  );
}
