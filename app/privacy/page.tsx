import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalSection } from "@/components/legal-document";
export const metadata: Metadata = {
  title: "Privacy Policy | Opryn",
  description:
    "Information Opryn processes for company knowledge, training, connected AI, and supported integrations.",
  alternates: { canonical: "https://www.opryn.app/privacy" },
};
export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      description="How Opryn handles information across its website, application, company knowledge, and supported connections."
    >
      <LegalSection title="1. Information you provide">
        <p>
          We collect account and organization information such as your name,
          email, business name, role, and workspace settings. Your organization
          may provide documents, processes, company rules, training materials,
          employee questions, feedback, owner or expert answers, and other
          business knowledge.
        </p>
        <p>
          We also process technical and service information such as IP
          addresses, device and browser information, timestamps, authentication
          events, usage events, and diagnostic logs. Payment card details are
          handled by Stripe rather than stored directly by Opryn.
        </p>
      </LegalSection>
      <LegalSection title="2. Connected services">
        <p>
          Google sign-in provides the basic identity information needed to
          authenticate you; it does not itself authorize access to your Drive or
          other Google services. Manual Drive and Docs imports read accessible
          document links you provide or downloaded files you upload. Where the
          authorized Drive connection is enabled, Opryn can browse and read
          files covered by your Google consent. Only files you explicitly choose
          are imported; connecting does not automatically import your Drive.
          Imported content is stored and processed as company knowledge and
          findings require review.
        </p>
        <p>
          When an authorized person connects Slack, Microsoft Teams, Twilio, or
          another supported service, Opryn may receive account or tenant
          identifiers, authorization tokens, messages, call metadata,
          recordings, and other information required by that connection. The
          permission screen and implemented workflow determine what is
          available. Slack interactions include supported direct messages,
          mentions, and commands; Teams setup includes Microsoft identity and
          tenant information. These connections do not imply unrestricted access
          to all messaging history.
        </p>
        <p>
          Some setup flows store customer-provided integration credentials.
          Saving credentials is not a promise that every provider’s data can be
          imported. Use supported capabilities and review the access you
          authorize.
        </p>
        <p>
          For connections managed through Nango, Nango handles authorization,
          credential storage and token refresh. Opryn stores connection
          identifiers, organization ownership and status, and makes authorized
          provider requests through Nango. Disconnecting stops Opryn from using
          that connection; previously imported knowledge is not automatically
          deleted. You may also revoke provider-side access in the connected
          service’s account settings.
        </p>
      </LegalSection>
      <LegalSection title="3. Connected AI tools">
        <p>
          Authorized ChatGPT, Claude, MCP clients, and external AI systems may
          receive Opryn knowledge, source information, and responses according
          to their connection permissions. Those systems may also send queries
          and relevant context you intentionally ask them to share. Opryn does
          not gain unrestricted access to your ChatGPT or Claude history through
          an MCP connection.
        </p>
        <p>
          Information received by an external AI tool is also subject to that
          tool’s policies and your configuration. Revoking its Opryn access does
          not erase copies it has already received.
        </p>
      </LegalSection>
      <LegalSection title="4. Calls, audio, and video">
        <p>
          Opryn accepts selected audio and video uploads and authorized business
          call recordings. Processing may include transcription, extraction of
          selected video frames, analysis, and creation of reviewable findings.
          Recordings, transcripts, and derived knowledge can be retained
          separately.
        </p>
        <p>
          Configured Twilio call learning can process eligible recorded calls
          automatically according to the business’s settings. Twilio
          audio-retention settings support removal after processing or 7, 30, or
          90 days. Cleanup requires successful processing and maintenance
          execution; it does not remove transcripts, derived knowledge, or
          recordings retained by Twilio. Other uploaded recordings do not have
          this same automatic expiry.
        </p>
        <p>
          Businesses are responsible for the notices, rights, and consent
          required by applicable recording and privacy laws before recording or
          submitting a conversation. Opryn’s acknowledgment screen does not
          obtain consent from call participants.
        </p>
      </LegalSection>
      <LegalSection title="5. How we use information">
        <p>
          We use information to provide and secure Opryn, authenticate users,
          organize and retrieve knowledge, generate answers and training
          guidance, route questions, record approvals, deliver notifications,
          manage billing, support users, troubleshoot, understand product use,
          prevent abuse, and meet legal obligations.
        </p>
        <p>
          Company information may be sent to configured AI/model providers,
          currently including OpenAI, as needed for transcription, analysis,
          embeddings, and generated responses. Provider processing and retention
          depend on their applicable terms and account configuration. We do not
          promise zero retention, local-only processing, or that no third party
          sees submitted content.
        </p>
      </LegalSection>
      <LegalSection title="6. Sharing and service providers">
        <p>
          We do not sell your personal information. Service providers support
          hosting and delivery (Vercel), authentication, database and file
          storage (Supabase), AI processing (OpenAI), payment processing
          (Stripe), and email delivery (Resend where configured). Connected
          services also receive information when you authorize their workflows.
        </p>
        <p>
          Organization administrators and permitted members may access workspace
          information according to their roles. We may disclose information when
          required by law, to protect rights or safety, or in connection with a
          business transfer. Our providers and connected tools operate under
          their applicable agreements and policies.
        </p>
      </LegalSection>
      <LegalSection title="7. Browser storage and usage information">
        <p>
          Cookies and browser storage maintain sign-in, security, preferences,
          and onboarding progress. Opryn records product activity and usage for
          service operation and product improvement. Clearing browser storage
          may sign you out or reset local preferences; it does not delete
          company records held by Opryn.
        </p>
      </LegalSection>
      <LegalSection title="8. Retention and removal">
        <p>
          We retain information as needed to provide the service, support
          workspace history, meet legal obligations, resolve disputes, and
          maintain legitimate business records. There is no single automatic
          deletion period for all company knowledge, questions, uploads, or
          audit records.
        </p>
        <p>
          Authorized users can remove supported items in the app. Disconnecting
          an integration or deleting a process does not necessarily remove
          associated stored files, audit history, backups, or third-party
          copies. For account, organization, or stored-media removal, make a{" "}
          <Link href="/contact">privacy request</Link>. We may verify identity
          and organization authority and explain any legal or technical
          retention limitations.
        </p>
      </LegalSection>
      <LegalSection title="9. Security and your choices">
        <p>
          We use access checks and organization-scoped processing, but no online
          service is perfectly secure. See{" "}
          <Link href="/security">Security and Data Handling</Link> for
          implemented protections and limitations. You can limit submitted
          information, manage supported connections, revoke authorized access,
          and request access, correction, or deletion of personal information.
          Workspace members may also need to contact their organization
          administrator.
        </p>
      </LegalSection>
      <LegalSection title="10. International use and children">
        <p>
          Information may be processed outside your country by Opryn and its
          providers, where privacy laws may differ. Opryn is a business service
          for adult account holders and is not directed to children. Do not
          submit children’s personal information without appropriate authority
          and a lawful basis.
        </p>
      </LegalSection>
      <LegalSection title="11. Changes and contact">
        <p>
          We will post policy updates here and update the effective date.
          Material changes may also be communicated through the service. For
          questions or rights requests, visit{" "}
          <Link href="/contact">Contact and Support</Link> and identify your
          message as a privacy request.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
