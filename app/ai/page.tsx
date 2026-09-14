import { publicMetadata } from "@/lib/marketing/metadata";
import Link from "next/link";
import { PublicInfoPage } from "@/components/marketing/public-info-page";
export const metadata = publicMetadata(
  "/ai",
  "Company Context for AI Builders | Opryn",
  "Give your existing support bots, voice agents, ChatGPT, and custom AI permission-controlled access to approved company knowledge.",
);
export default function AIPage() {
  return (
    <PublicInfoPage
      title="Stop teaching every AI the business from scratch."
      intro="Opryn gives the AI tools you already build and use access to the same approved company knowledge."
    >
      <p className="public-actions">
        <Link className="story-button story-button-primary" href="/signup">
          Get Started →
        </Link>
        <Link href="/security">How Opryn handles your data →</Link>
      </p>
      <section>
        <h2>Bring your own AI</h2>
        <p>
          For automation agencies, voice-AI developers, support-bot builders,
          and businesses connecting multiple tools. Keep your agents, workflows,
          and model providers. Opryn supplies company context—not an agent
          builder or model fine-tuning service.
        </p>
      </section>
      <section
        className="ai-architecture"
        aria-labelledby="ai-architecture-title"
      >
        <p className="editorial-label">Connection architecture</p>
        <h2 id="ai-architecture-title">
          Your agent. Approved company context.
        </h2>
        <div className="ai-endpoints">
          {["ChatGPT", "Claude", "Support", "Voice", "Custom agent"].map(
            (name) => (
              <span key={name}>{name}</span>
            ),
          )}
        </div>
        <div className="architecture-lookup">
          <span aria-hidden>↓</span> Permission-controlled lookup{" "}
          <span aria-hidden>↓</span>
        </div>
        <div className="authority-surface">
          <span className="editorial-label">Opryn approved knowledge</span>
          <h3>Only the guidance this connection may use.</h3>
          <dl>
            <div>
              <dt>Allowed knowledge</dt>
              <dd>Scoped to the connection</dd>
            </div>
            <div>
              <dt>Sources</dt>
              <dd>References where available</dd>
            </div>
            <div>
              <dt>Versions</dt>
              <dd>Current approved guidance</dd>
            </div>
            <div>
              <dt>Missing guidance</dt>
              <dd>Unknown, clarification or escalation</dd>
            </div>
          </dl>
        </div>
        <p className="public-note">
          Illustrative architecture. Each client needs supported MCP or API
          setup. Opryn provides context—not agent hosting or model training.
        </p>
      </section>
      <section className="ai-answer-example">
        <p className="editorial-label">
          Example lookup · not a live agent test
        </p>
        <h2>See what the connection receives.</h2>
        <div className="answer-example-grid">
          <div>
            <h3>Question</h3>
            <p>What is our refund limit?</p>
            <h3>Connection access</h3>
            <p>
              Refund policy: allowed
              <br />
              Other company knowledge: not assumed
            </p>
          </div>
          <div className="authority-surface">
            <span className="approved-label">Approved guidance</span>
            <p>
              Managers may approve refunds up to $500. Above $500 requires owner
              approval.
            </p>
            <dl>
              <div>
                <dt>Source</dt>
                <dd>Refund Policy · selected Google Doc</dd>
              </div>
              <div>
                <dt>Knowledge revision</dt>
                <dd>Example version 3</dd>
              </div>
            </dl>
          </div>
        </div>
        <p className="public-note">
          The external agent controls its final response. This lookup does not
          approve or process a refund.
        </p>
      </section>
      <section>
        <h2>Why AI builders use Opryn.</h2>
        <div className="public-editorial-rows">
          {[
            [
              "One company context",
              "Maintain reviewed business guidance once instead of rebuilding separate instructions for each agent.",
            ],
            [
              "Permissioned access",
              "Choose what a connection can retrieve. A connection is not unrestricted access to the business.",
            ],
            [
              "Ask when unsure",
              "Missing approved guidance can return to a person and become a proposal—not silently become policy.",
            ],
          ].map(([title, copy]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <section>
        <h2>MCP + API, with defined access</h2>
        <p>
          Core includes external AI Connections and the Agent API. Premium adds
          remote MCP access for supported clients such as ChatGPT and Claude.
          Choose the knowledge and actions a connection may access; an API key
          is not permission to read every organization or document.
        </p>
        <p>
          <Link href="/docs/mcp-development">Connection documentation</Link> ·{" "}
          <Link href="/pricing">Compare plans</Link>
        </p>
      </section>
      <section>
        <h2>Update once. Use the new context.</h2>
        <p>
          Once a revision is approved and available, authorized connections can
          retrieve it on their next query. Your external system controls its own
          cache, prompts, and final responses; Opryn does not rewrite its model
          or guarantee every response it produces.
        </p>
      </section>
    </PublicInfoPage>
  );
}
