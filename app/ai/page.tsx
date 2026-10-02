import Link from "next/link";
import { AuthProvider } from "@/components/auth";
import { Navbar, Footer } from "@/components/navigation";
import { publicMetadata } from "@/lib/marketing/metadata";
import {
  EditorialAction,
  EditorialHeading,
} from "@/components/marketing/editorial-motion";
import { PublicAction } from "@/components/marketing/public-motion";
import SoftBlurIn from "@/components/smoothui/soft-blur-in";
import {
  KnowledgeFlowScene,
  HumanReviewExample,
} from "@/components/marketing/knowledge-flow-scene";
import "@/components/marketing/editorial-home.css";
import "@/components/marketing/cinematic-public.css";
import "@/components/marketing/public-light.css";

export const metadata = publicMetadata(
  "/ai",
  "Give Your AI Company Context | Opryn",
  "Give compatible connected AI controlled access to reviewed company guidance, with sources and human approval.",
);

export default function AIPage() {
  return (
    <AuthProvider>
      <div className="knowledge-public-site opryn-public-editorial opryn-public-light">
        <Navbar />
        <main id="top" className="opryn-editorial-ai">
          <section className="editorial-wrap editorial-hero">
            <div>
              <p className="editorial-eyebrow">
                <SoftBlurIn stagger={10}>
                  Your AI. Your company’s guidance.
                </SoftBlurIn>
              </p>
              <EditorialHeading hero>
                Give your AI company context.
              </EditorialHeading>
              <p className="editorial-lead">
                Opryn gives compatible connected AI access to the approved
                company knowledge it is allowed to use.
              </p>
              <div className="editorial-actions">
                <EditorialAction href="/signup">Get started</EditorialAction>
                <PublicAction href="/integrations" variant="text">
                  View integrations
                </PublicAction>
              </div>
              <p className="editorial-footnote">
                Your documents and explanations become proposals. A person
                decides what becomes official. Each AI connection needs
                supported setup.
              </p>
            </div>
            <KnowledgeFlowScene ai />
          </section>
          <section
            className="editorial-section editorial-sky"
            aria-labelledby="ai-control-title"
          >
            <div className="editorial-wrap ai-permission-layout">
              <div>
                <p className="editorial-eyebrow" id="ai-control-title">
                  Defined access—not the whole workspace
                </p>
                <EditorialHeading>You decide what AI can use.</EditorialHeading>
                <p className="editorial-lead">
                  Limit an external AI connection to selected knowledge areas or
                  individual items. Existing workspace access rules still apply.
                </p>
                <PublicAction href="/security" variant="text">
                  See security &amp; data handling
                </PublicAction>
              </div>
              <article
                className="ai-permission-list"
                aria-label="Example external AI connection permissions"
              >
                <header>
                  <strong>Support connection</strong>
                  <span>Example access policy</span>
                </header>
                <dl>
                  {[
                    ["Policies", "Allowed"],
                    ["Processes", "Allowed"],
                    ["Customer Support", "Allowed"],
                    ["Pricing", "Excluded"],
                    ["Responsibilities", "Excluded"],
                  ].map(([subject, status]) => (
                    <div key={subject}>
                      <dt>{subject}</dt>
                      <dd
                        data-access={
                          status === "Allowed" ? "allowed" : "excluded"
                        }
                      >
                        {status === "Allowed" ? "✓" : "—"} {status}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="editorial-footnote">
                  Illustrative selections from Opryn’s knowledge categories—not
                  a live permission policy. Owners configure each connection’s
                  actual access.
                </p>
              </article>
            </div>
          </section>
          <section
            className="editorial-section editorial-review-blue"
            aria-labelledby="ai-human-title"
          >
            <div className="editorial-wrap">
              <p className="editorial-eyebrow" id="ai-human-title">
                Human judgment stays in the loop
              </p>
              <EditorialHeading>
                AI doesn’t decide what becomes company policy.
              </EditorialHeading>
              <p className="editorial-lead">
                Opryn organizes what your business provides. You approve, edit
                or reject it before it becomes company guidance.
              </p>
              <HumanReviewExample />
            </div>
          </section>
          <section
            className="editorial-section"
            aria-labelledby="ai-connections-title"
          >
            <div className="editorial-wrap">
              <div className="editorial-intro">
                <div>
                  <p className="editorial-eyebrow" id="ai-connections-title">
                    Keep the tools you already use
                  </p>
                  <EditorialHeading>
                    One source. Supported connections.
                  </EditorialHeading>
                </div>
                <p>
                  Opryn trains connected AI through approved context, controlled
                  knowledge access, behavior guidance and evaluations. Your
                  provider runs the agent; Opryn does not fine-tune its model
                  weights.
                </p>
              </div>
              <div className="ai-supported-connections">
                <div>
                  <h3>ChatGPT &amp; Claude</h3>
                  <p>
                    Retrieve authorized guidance through supported Opryn
                    connections. Learn from conversation context you explicitly
                    send—not your entire chat history.
                  </p>
                  <span>Pro</span>
                </div>
                <div>
                  <h3>Your existing AI</h3>
                  <p>
                    Connect a support bot, voice agent or custom workflow to the
                    secure Agent API. Define the knowledge it may retrieve.
                  </p>
                  <span>Starter + Pro</span>
                </div>
                <div>
                  <h3>Slack &amp; Teams</h3>
                  <p>
                    Let people ask Opryn where their team works, with configured
                    workspace connections.
                  </p>
                  <span>Starter + Pro</span>
                </div>
              </div>
              <p className="editorial-footnote">
                Provider plans and surfaces have their own eligibility
                requirements. Opryn Pro does not change your external provider
                plan.
              </p>
              <div className="editorial-actions">
                <PublicAction href="/integrations" variant="text">
                  View all integrations
                </PublicAction>
                <PublicAction href="/docs/mcp-development" variant="text">
                  Connection documentation
                </PublicAction>
              </div>
              <div className="ai-grounding">
                <span>Human review</span>
                <span>Source references where available</span>
                <span>Current approved revisions</span>
                <span>Controlled access</span>
              </div>
              <p className="editorial-footnote">
                Newly approved guidance is available on the next authorized
                lookup. Your external AI controls its cache and final responses;
                Opryn does not rewrite old conversations or guarantee every
                answer.
              </p>
            </div>
          </section>
          <section
            className="editorial-section editorial-cobalt editorial-texture"
            aria-labelledby="ai-unknown-title"
          >
            <div className="editorial-ring" aria-hidden="true" />
            <div className="editorial-wrap">
              <p className="editorial-eyebrow" id="ai-unknown-title">
                Missing guidance is a reason to ask
              </p>
              <EditorialHeading>
                No approved answer? Ask the business.
              </EditorialHeading>
              <p className="editorial-lead">
                Opryn can return an unknown result instead of guessing. When
                escalation is enabled and authorized, the question can go to the
                right person.
              </p>
              <div
                className="ai-unknown-flow"
                aria-label="Unknown guidance can become reviewed knowledge"
              >
                <strong>No approved answer</strong>
                <span aria-hidden="true">→</span>
                <strong>Ask a person</strong>
                <span aria-hidden="true">→</span>
                <strong>Prepare a proposal</strong>
                <span aria-hidden="true">→</span>
                <strong>Human review</strong>
              </div>
              <p className="editorial-footnote">
                A person’s answer still needs review before it becomes reusable
                company guidance.
              </p>
              <div className="ai-final-actions">
                <h3>Teach Opryn once. Use it wherever you work.</h3>
                <div className="editorial-actions">
                  <EditorialAction href="/signup">Get started</EditorialAction>
                  <PublicAction href="/integrations" variant="text">
                    View integrations
                  </PublicAction>
                </div>
                <p className="editorial-footnote">
                  <Link href="/pricing">
                    Choose the plan that fits your team →
                  </Link>
                </p>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
}
