import { publicMetadata } from "@/lib/marketing/metadata";
import Link from "next/link";
import { PublicInfoPage } from "@/components/marketing/public-info-page";
export const metadata = publicMetadata(
  "/security",
  "Security and Data Handling | Opryn",
  "How Opryn handles organization access, approved knowledge, connected services, and business recordings.",
);
export default function SecurityPage() {
  return (
    <PublicInfoPage
      title="Your business knowledge deserves serious protection."
      intro="Clear access controls. Reviewable knowledge. An honest account of how your information is handled."
    >
      <section className="security-summary">
        <p className="editorial-label">Security at a glance</p>
        <h2>Defined access. Human authority.</h2>
        <ul>
          {[
            "Organization-scoped access",
            "Server-side credentials",
            "Review before approval",
            "Revocable connections",
            "Source-backed knowledge",
          ].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <ol className="public-data-flow">
          {[
            "Source",
            "Opryn processing",
            "Human review",
            "Approved knowledge",
            "Authorized lookup",
          ].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
        <Link href="/privacy">Read the Privacy Policy →</Link>
      </section>
      <section>
        <h2>Your organization, your access rules</h2>
        <p>
          Opryn checks signed-in membership and scopes company requests to the
          active organization. Owner and administrator permissions are required
          for sensitive management actions. Knowledge retrieval applies the
          requesting person’s or AI connection’s permitted access.
        </p>
      </section>
      <section>
        <h2>Reviewed knowledge, not invented policy</h2>
        <p>
          Approved knowledge is distinct from Observed findings awaiting review.
          Opryn’s shared answer pipeline checks approval and blocking conflicts
          before using retrieved guidance. Source references help people inspect
          the basis of an answer where available.
        </p>
        <p>
          AI can still make mistakes. Review important decisions and do not
          treat Opryn as a substitute for professional advice or required human
          authorization.
        </p>
      </section>
      <section>
        <h2>Connections have a defined purpose</h2>
        <p>
          Manual Drive imports read links or copies you provide. Where
          authorized Drive connections are enabled, Opryn can browse files
          covered by your Google consent, but imports only the files you choose.
          Connecting does not automatically import or approve your Drive
          content. ChatGPT and Claude can send context you explicitly ask them
          to share and retrieve permitted Opryn knowledge. Connecting them does
          not give Opryn unrestricted chat history.
        </p>
        <p>
          Slack and Teams require their supported setup and authorized user
          interactions. Custom bots and agents remain external systems; Opryn
          does not build or retrain them.
        </p>
      </section>
      <section>
        <h2>Credentials and service providers</h2>
        <p>
          Server-side integration code handles OAuth tokens and provider
          credentials. External AI access uses authorized grants or connection
          keys; those can be revoked in Opryn. Customer-created API keys must
          also be kept secure by the system using them.
        </p>
        <p>
          Hosting, authentication, storage, payment, email, and AI processing
          depend on service providers. Company content may be sent to the
          configured model provider to transcribe, organize, search, or answer
          questions. See the <Link href="/privacy">Privacy Policy</Link> for
          details.
        </p>
      </section>
      <section>
        <h2>Calls and media</h2>
        <p>
          Businesses choose the recordings they upload or authorize through
          configured call learning. Recordings, transcripts, selected video
          frames, and derived findings may be processed. Businesses are
          responsible for recording notices, permissions, and consent.
        </p>
        <p>
          Twilio call-audio settings support removal after processing or a
          retention period of 7, 30, or 90 days. Cleanup depends on successful
          processing and maintenance runs; transcripts and derived knowledge are
          separate. This is not a universal deletion schedule for all uploads,
          nor does it delete the provider’s original recording.
        </p>
      </section>
      <section>
        <h2>Service providers</h2>
        <p>
          Opryn uses infrastructure providers for specific parts of the service.
          The Privacy Policy describes the information involved.
        </p>
        <dl className="provider-purpose">
          {[
            ["Vercel", "Application hosting"],
            ["Supabase", "Authentication, database and storage"],
            ["OpenAI", "Configured AI processing"],
            ["Stripe", "Subscriptions and payments"],
            ["Resend", "Configured invitation email delivery"],
            ["Nango", "Managed integration authorization where used"],
          ].map(([name, purpose]) => (
            <div key={name}>
              <dt>{name}</dt>
              <dd>{purpose}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section>
        <h2>Disconnecting and removing information</h2>
        <p>
          Disconnecting a service stops the associated access; it does not
          automatically erase knowledge already imported or copies already
          received by another system. Authorized users can remove supported
          items through the app. Full account, organization, or stored-media
          deletion requires a <Link href="/contact">data removal request</Link>;
          we do not promise instant deletion from every backup or third-party
          system.
        </p>
      </section>
      <section>
        <h2>Questions before connecting?</h2>
        <p>
          <Link href="/contact">Contact Opryn</Link> about your access,
          security, or data handling needs. No certification or independent
          security audit is claimed on this page.
        </p>
      </section>
    </PublicInfoPage>
  );
}
