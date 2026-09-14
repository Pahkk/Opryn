import type { Metadata } from "next";
import Link from "next/link";
import { LegalDocument, LegalSection } from "../../components/legal-document";

export const metadata: Metadata = {
  title: "Terms of Service | Opryn",
  description:
    "Terms governing access to the Opryn website, application, and services.",
  alternates: { canonical: "https://www.opryn.app/terms" },
};

export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      description="These terms govern your access to Opryn. By using the service, you agree to them."
    >
      <LegalSection title="1. Using Opryn">
        <p>
          You must be at least 18 years old and able to enter into a binding
          agreement to use Opryn. If you use Opryn for a company or another
          organization, you represent that you have authority to accept these
          terms on its behalf.
        </p>
        <p>
          Opryn is an evolving service. Features may change without notice or
          occasionally be unavailable while we test, maintain, and improve the
          product.
        </p>
      </LegalSection>

      <LegalSection title="2. Accounts">
        <p>
          You are responsible for keeping your account secure and for activity
          that occurs through it. You must provide accurate information and
          promptly notify us if you believe your account has been compromised.
          Google sign-in is provided through Google and Supabase and is also
          subject to their applicable terms.
        </p>
      </LegalSection>

      <LegalSection title="3. Acceptable use">
        <p>
          You may not misuse Opryn, interfere with its operation, attempt
          unauthorized access, introduce malicious code, use the service to
          violate law or another person&apos;s rights, reverse engineer
          protected portions of the service, or use automated means to burden or
          scrape the service without permission.
        </p>
      </LegalSection>

      <LegalSection title="4. Your content">
        <p>
          You retain ownership of the recordings, procedures, business
          information, questions, answers, and other content you submit. You
          grant Opryn permission to host, process, reproduce, and transform that
          content only as needed to operate, secure, support, and improve the
          service.
        </p>
        <p>
          You are responsible for ensuring you have the rights and permissions
          needed to submit content, including appropriate notice or consent when
          recordings or business materials contain information about employees,
          customers, or other people.
        </p>
      </LegalSection>

      <LegalSection title="5. Opryn materials">
        <p>
          Opryn and its licensors retain all rights in the service, software,
          design, branding, and documentation, excluding your content. These
          terms give you a limited, non-exclusive, non-transferable right to use
          the service for your authorized business use, including permitted
          employee and external AI integrations, while your access remains
          active.
        </p>
      </LegalSection>

      <LegalSection title="6. Feedback">
        <p>
          If you provide product ideas or feedback, you allow Opryn to use them
          without restriction or compensation. This does not give Opryn
          ownership of your business content.
        </p>
      </LegalSection>

      <LegalSection title="7. Pricing and subscriptions">
        <p>
          Onboarding offers a 5-day Premium trial for organizations that have
          not previously used it. Core does not include that trial. Checkout
          shows payment requirements and renewal amounts; cancel before the
          trial ends to avoid the next charge. Existing subscriptions are
          managed through the billing portal.
        </p>
        <p>
          Core includes up to 5 employee seats and Premium up to 20, in addition
          to one owner. Pending invitations count toward the limit. Standard
          checkout does not sell extra seats. Contact us before purchasing for a
          larger team.
        </p>
        <p>
          Paid Opryn plans renew automatically at the billing interval shown
          during checkout until canceled. Prices, included usage, and plan
          features are shown before purchase. You can manage supported payment,
          invoice, and cancellation options through the billing portal.
          Cancellation normally takes effect at the end of the current paid
          period unless otherwise stated.
        </p>
      </LegalSection>

      <LegalSection title="8. Third-party services">
        <p>
          You are responsible for authorizing connections and ensuring that
          recordings comply with applicable notice and consent requirements.
          Connected AI tools remain external systems: Opryn supplies permitted
          context, not model retraining or a guarantee of their final answers.
          Review and approve company policy before relying on it.
        </p>
        <p>
          Opryn relies on third-party hosting, storage, AI processing, payment,
          email, and connected services. We are not responsible for third-party
          services outside our control, and their separate terms and privacy
          policies may apply.
        </p>
      </LegalSection>

      <LegalSection title="9. Suspension and termination">
        <p>
          You may stop using Opryn at any time. We may suspend or terminate
          access when reasonably necessary to protect the service, comply with
          law, respond to misuse, or address a violation of these terms.
          Sections that by their nature should survive termination will remain
          in effect.
        </p>
      </LegalSection>

      <LegalSection title="10. Disclaimers">
        <p>
          To the extent permitted by law, Opryn is provided “as is” and “as
          available.” We do not guarantee that the service will be
          uninterrupted, error-free, or suitable for every business decision.
          You remain responsible for reviewing generated procedures, rules, and
          answers before relying on them in your operations.
        </p>
      </LegalSection>

      <LegalSection title="11. Limitation of liability">
        <p>
          To the extent permitted by law, Opryn will not be liable for indirect,
          incidental, special, consequential, exemplary, or punitive damages, or
          for lost profits, revenue, data, goodwill, or business interruption.
          Opryn&apos;s total liability arising from the service will not exceed
          the amount you paid Opryn during the 12 months before the event giving
          rise to the claim or $100 if you have not paid Opryn.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes">
        <p>
          We may update these terms as Opryn develops. We will post the revised
          terms here and update the effective date. If a material change affects
          existing users, we will provide reasonable notice when appropriate.
          Continuing to use Opryn after the updated terms take effect means you
          accept them.
        </p>
      </LegalSection>

      <LegalSection title="13. Contact">
        <p>
          For questions about these terms, use{" "}
          <Link href="/contact">Contact and Support</Link> and identify the
          message as a terms question.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
