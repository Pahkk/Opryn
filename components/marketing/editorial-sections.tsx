import Link from "next/link";
import {
  PointerSurface,
  SignatureStory,
} from "@/components/motion/signature-story";

export function DirectionalLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="directional-link">
      <span>{children}</span>
      <span className="directional-arrow" aria-hidden="true">
        →
      </span>
    </Link>
  );
}

export function EditorialFeaturePanel({
  title,
  description,
  href,
  action,
  tint = false,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
  tint?: boolean;
}) {
  return (
    <PointerSurface>
      <article
        className={`editorial-feature${tint ? " editorial-feature-sage" : ""}`}
        data-story-reveal
      >
        <h2>{title}</h2>
        <p>{description}</p>
        <DirectionalLink href={href}>{action}</DirectionalLink>
      </article>
    </PointerSurface>
  );
}

const steps = [
  {
    title: "Selected sources",
    detail: "Documents, owner answers, and selected Drive files.",
    path: "Information",
  },
  {
    title: "Opryn review",
    detail: "Useful findings, ready for your business to review.",
    path: "Your approval",
  },
  {
    title: "Approved knowledge",
    detail: "Processes, policies, and answers you can reuse.",
    path: "Authorized lookup",
  },
  {
    title: "People + connected AI",
    detail: "Company context, within the access you give them.",
  },
];

export function KnowledgeFlow() {
  return (
    <SignatureStory kind="teach">
      <ol
        className="editorial-flow"
        aria-label="How information becomes approved company knowledge"
      >
        {steps.map((step, i) => (
          <li key={step.title}>
            <span className="flow-step-number" aria-hidden="true">
              0{i + 1}
            </span>
            <h3>{step.title}</h3>
            <p>{step.detail}</p>
            {step.path ? (
              <div className="editorial-flow-path">
                <span>{step.path}</span>
                <svg
                  viewBox="0 0 160 24"
                  aria-hidden="true"
                  preserveAspectRatio="none"
                >
                  <path pathLength="1" d="M1 12 H153 M147 6 L154 12 L147 18" />
                </svg>
              </div>
            ) : null}
          </li>
        ))}
      </ol>
    </SignatureStory>
  );
}

export function CentralUpdate() {
  return (
    <section className="editorial-update">
      <div className="story-shell editorial-update-layout">
        <header data-story-reveal>
          <p className="editorial-label">Company context, kept current</p>
          <h2>
            Maintain the
            <br />
            knowledge once.
          </h2>
          <p>
            Approve a change in Opryn. Your people and connected agents can
            retrieve the new version without maintaining a separate knowledge
            base for each tool.
          </p>
        </header>
        <SignatureStory kind="distribute">
          <div className="editorial-update-diagram">
            <p className="editorial-label">Example · approved update</p>
            <div className="editorial-update-source">
              <span>✓ Approved revision</span>
              <h3>Website project policy</h3>
              <p>Additional rounds require project lead approval.</p>
            </div>
            <ul aria-label="Where updated knowledge can be used">
              {["Team", "ChatGPT", "Support Bot", "Call Agent"].map((name) => (
                <li key={name}>
                  <svg
                    className="distribution-path"
                    viewBox="0 0 100 28"
                    aria-hidden="true"
                  >
                    <path
                      pathLength="1"
                      d="M1 1 C1 14 10 14 24 14 H96 M90 8 L97 14 L90 20"
                    />
                  </svg>
                  <span className="distribution-destination">{name}</span>
                </li>
              ))}
            </ul>
            <strong className="editorial-update-result">
              Available on the next authorized lookup.
            </strong>
            <p className="editorial-note">
              Existing conversations, exported documents, and external caches do
              not change automatically. Opryn provides context; it does not
              execute the agent’s actions.
            </p>
          </div>
        </SignatureStory>
      </div>
    </section>
  );
}

export function EditorialTrust() {
  return (
    <section className="editorial-trust" id="security">
      <div className="story-shell">
        <header data-story-reveal>
          <p className="editorial-label">Trust is part of the workflow</p>
          <h2>
            Your business decides
            <br />
            what becomes official.
          </h2>
        </header>
        <div className="editorial-trust-rows" data-story-reveal>
          {[
            [
              "Approved",
              "Reviewed and available to authorized users and connections.",
            ],
            ["Needs review", "Captured information waiting for a decision."],
            [
              "Unknown",
              "No approved answer found. Route the question to the right person.",
            ],
          ].map(([title, text]) => (
            <div key={title}>
              <h3>{title}</h3>
              <p>{text}</p>
            </div>
          ))}
        </div>
        <div className="editorial-trust-bottom">
          <p>Sources stay attached. Access stays controlled.</p>
          <DirectionalLink href="/security">
            How Opryn handles your data
          </DirectionalLink>
        </div>
      </div>
    </section>
  );
}
