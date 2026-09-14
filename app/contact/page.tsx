import { publicMetadata } from "@/lib/marketing/metadata";
import { ContactComposer } from "@/components/marketing/contact-composer";
import { PublicInfoPage } from "@/components/marketing/public-info-page";
import { company } from "@/lib/marketing/company";
export const metadata = publicMetadata(
  "/contact",
  "Contact and Support | Opryn",
  "Talk to Opryn about product fit, support, security, larger teams or integration requests. Contact usersupport@opryn.app.",
);
export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const { topic } = await searchParams;
  return (
    <PublicInfoPage
      title="Talk to Opryn."
      intro="Questions about your workspace, a larger team, or whether Opryn fits your business?"
    >
      <ContactComposer initialTopic={topic} />
      <section>
        <h2>Support, security, and privacy</h2>
        {company.supportEmail ? (
          <p>
            Email{" "}
            <a href={`mailto:${company.supportEmail}`}>
              {company.supportEmail}
            </a>
            .
          </p>
        ) : (
          <p>
            Our public support contact is being finalized. Please use your
            existing contact with Opryn for assistance.
          </p>
        )}
        <p>
          Include your organization name and what you need help with. For
          access, correction, or deletion, use “Privacy request” in the subject.
          We may need to verify your identity and authority. Do not send
          passwords, API keys, payment details, or private recordings by email.
        </p>
      </section>
      <section>
        <h2>Early customers and larger teams</h2>
        <p>
          Tell us what your team or connected AI needs to know. We can discuss
          your setup and team size before you commit. No custom pricing or
          extra-seat availability is promised until agreed.
        </p>
      </section>
    </PublicInfoPage>
  );
}
