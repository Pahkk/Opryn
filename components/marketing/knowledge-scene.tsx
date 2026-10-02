import { SiGoogledocs, SiGooglesheets } from "react-icons/si";
import { OprynLogo } from "@/components/opryn-logo";
import {
  CallsIcon,
  TeamIcon,
  TrainingIcon,
  ConnectionIcon,
} from "@/components/opryn-icons/opryn-icons";

export const STORY_STAGES = [
  "Information",
  "Structure",
  "Review",
  "Approved",
  "Use",
  "Learn",
] as const;
const headlines = [
  "Your business already knows the answer.",
  "Information isn’t the same as company knowledge.",
  "Someone decides what becomes official.",
  "Now your business has an answer.",
  "One approved answer. Wherever it’s needed.",
  "And when Opryn doesn’t know, it asks.",
];
const endpoints = [
  {
    name: "Team",
    question: "Can I approve $300?",
    answer: "Yes — if you’re a manager.",
    Icon: TeamIcon,
  },
  {
    name: "New hire",
    question: "Refund approvals",
    answer: "Managers: up to $500.",
    Icon: TrainingIcon,
  },
  {
    name: "ChatGPT",
    question: "What’s our refund approval policy?",
    answer: "Manager approval up to $500.",
    Icon: ConnectionIcon,
  },
  {
    name: "Support",
    question: "$700 refund",
    answer: "Owner approval required.",
    Icon: ConnectionIcon,
  },
  {
    name: "Call agent",
    question: "$600 refund",
    answer: "Escalate to the owner.",
    Icon: CallsIcon,
  },
];

/** Semantic, readable HTML first. The document shell is also the knowledge shell;
 * motion never swaps it for a second card or changes application state. */
export function KnowledgeScene() {
  return (
    <div className="kc-stage">
      <aside className="kc-progress" aria-hidden="true">
        <span className="kc-progress-caption">
          Scroll story <b className="kc-progress-number">01 / 06</b>
        </span>
        <div className="kc-progress-track">
          <i />
          <em />
        </div>
        <ol>
          {STORY_STAGES.map((name, i) => (
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
          <div className={`kc-headline kc-headline-${i}`} key={headline}>
            <p>{headline}</p>
          </div>
        ))}
      </div>
      <p className="kc-scattered-label">It’s just scattered everywhere.</p>
      <div className="kc-canvas">
        <div className="kc-plane" aria-hidden="true" />
        <p className="kc-static-step">01 / Information</p>
        <div className="kc-sources">
          <article
            className="kc-fragment kc-sheet"
            data-source="1"
            data-flip-id="story-pricing"
          >
            <div className="kc-fragment-title">
              <SiGooglesheets aria-hidden="true" />
              <span>
                Google Sheets<strong>Pricing</strong>
              </span>
            </div>
            <div className="kc-fragment-content">
              <table>
                <caption className="kc-sr">
                  Example refund approval threshold
                </caption>
                <tbody>
                  <tr>
                    <td>Manager limit</td>
                    <td>$500</td>
                  </tr>
                  <tr>
                    <td>Above limit</td>
                    <td>Owner</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
          <article
            className="kc-fragment kc-call"
            data-source="2"
            data-flip-id="story-call"
          >
            <div className="kc-fragment-title">
              <CallsIcon size={26} />
              <span>
                Selected call<strong>Customer escalation</strong>
              </span>
            </div>
            <div className="kc-fragment-content">
              <span className="kc-transcript-mark">02:14 — CUSTOMER</span>
              <p>“Can we refund this after 60 days?”</p>
            </div>
          </article>
          <article
            className="kc-fragment kc-owner"
            data-source="3"
            data-flip-id="story-owner"
          >
            <div className="kc-fragment-title">
              <span className="kc-person-mark">O</span>
              <span>
                Owner answer<strong>Refund authority</strong>
              </span>
            </div>
            <div className="kc-fragment-content">
              <p>“Ask me before approving anything above $500.”</p>
            </div>
          </article>
        </div>
        <article
          className="kc-knowledge kc-doc"
          data-source="0"
          data-kc-block
          data-flip-id="story-authority"
        >
          <div className="kc-document">
            <div className="kc-fragment-title">
              <SiGoogledocs aria-hidden="true" />
              <span>
                Google Docs<strong>Refund Policy</strong>
              </span>
            </div>
            <div className="kc-fragment-content">
              <p>Refunds over $500 require owner approval.</p>
              <div className="kc-document-lines" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            </div>
          </div>
          <div className="kc-proposal">
            <p className="kc-static-step">02 / Structure → 03 / Human review</p>
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
              </div>
              <small>An authorized person makes the decision.</small>
            </div>
            <p className="kc-confirmation">
              <span className="kc-static-step">04 / Approved</span>
              <span>Source-backed</span>
              <span>Version 3</span>
            </p>
            <div className="kc-provenance" data-flip-id="story-provenance">
              <span>Sources retained</span>
              <p>Refund Policy · Pricing · Owner answer</p>
              <small>The call’s 60-day exception still needs an answer.</small>
            </div>
          </div>
          <svg className="kc-approval-sweep" aria-hidden="true">
            <rect
              x="1"
              y="1"
              width="calc(100% - 2px)"
              height="calc(100% - 2px)"
              rx="11"
              pathLength="1"
            />
          </svg>
        </article>
        <svg className="kc-paths" aria-hidden="true">
          {endpoints.map(({ name }, i) => (
            <path className="kc-out-path" data-path={i} key={name} />
          ))}
          <path className="kc-feedback-path" />
          <path className="kc-return-path" />
        </svg>
        <div className="kc-layout-probes" aria-hidden="true">
          <div data-layout="source" />
          <div data-layout="stack" />
          <div data-layout="proposal" />
          <div data-layout="review" />
          <div data-layout="approved" />
          <div data-layout="hub" />
          <div data-layout="learn" />
        </div>
        <div
          className="kc-destinations"
          aria-label="Authorized people and connected AI"
        >
          <p className="kc-static-step">05 / Use</p>
          {endpoints.map(({ name, question, answer, Icon }, i) => (
            <article
              className={`kc-destination kc-destination-${i}`}
              key={name}
            >
              <h3>
                <Icon size={18} />
                {name}
              </h3>
              <p>{question}</p>
              <strong>{answer}</strong>
            </article>
          ))}
        </div>
        <section
          className="kc-feedback"
          aria-label="Example unanswered question and review loop"
        >
          <p className="kc-static-step">06 / Learn</p>
          <div className="kc-gap-question">
            <span className="editorial-label">Team asks</span>
            <h3>What if the shipment never arrived?</h3>
            <p className="kc-gap-result">No approved answer.</p>
            <small>
              The general refund limit still applies. This exception needs
              review.
            </small>
          </div>
          <div className="kc-gap-route">
            <span>Knowledge gap → Operations Lead</span>
            <strong>
              What should we do for undelivered orders above $500?
            </strong>
          </div>
          <div className="kc-gap-answer">
            <span className="editorial-label">
              Operations Lead · example answer
            </span>
            <p>“Escalate those to Operations.”</p>
            <div className="kc-gap-review">
              <span>Remember this?</span>
              <b>Add for review →</b>
            </div>
          </div>
        </section>
        <div className="kc-new-proposal">
          <span>Proposed update · Needs Review</span>
          <strong>Undelivered orders above $500</strong>
          <p>Escalate to Operations.</p>
          <small>Queued for human review — not official yet.</small>
        </div>
        <div
          className="kc-loop"
          aria-label="Information becomes guidance; questions return for review"
        >
          <svg viewBox="0 0 680 430" preserveAspectRatio="none" aria-hidden="true">
            <path d="M340 60 V84 M195 160 C170 160 210 190 210 215 V250 C210 278 260 286 316 286 M485 160 C510 160 470 190 470 215 V250 C470 278 420 286 364 286 M340 230 V286" />
          </svg>
          <div className="kc-loop-label kc-loop-information"><span>Information</span></div>
          <span className="kc-loop-opryn">
            <OprynLogo size="small" />
            <small>Review · Approve · Maintain</small>
          </span>
          <div className="kc-loop-label kc-loop-people"><span>People</span></div>
          <div className="kc-loop-label kc-loop-ai"><span>Connected AI</span></div>
          <div className="kc-loop-label kc-loop-questions"><span>Questions</span></div>
          <p className="kc-positioning">
            Your business gets better every time it answers something once.
          </p>
        </div>
      </div>
    </div>
  );
}
