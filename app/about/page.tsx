import { publicMetadata } from "@/lib/marketing/metadata";
import Link from "next/link";
import { PublicInfoPage } from "@/components/marketing/public-info-page";
import { company } from "@/lib/marketing/company";
export const metadata = publicMetadata(
  "/about",
  "Why Opryn Exists | Opryn",
  "Why we are building an operational knowledge layer that businesses can teach, review and reuse across people and AI.",
);
export default function AboutPage() {
  return (
    <PublicInfoPage
      title="Why Opryn exists."
      intro="A business shouldn’t have to explain itself from scratch every time someone—or something—new joins it."
    >
      <section>
        <h2>The business knows. The knowledge is scattered.</h2>
        <p>
          Processes live in documents. Exceptions live with experienced people.
          Decisions happen on calls. Useful context stays inside a conversation
          with an AI tool. As the business grows, keeping those explanations
          consistent gets harder.
        </p>
      </section>
      <section>
        <p className="editorial-label">The belief</p>
        <h2>Every question should make the business better prepared.</h2>
        <p>
          An experienced person’s answer shouldn’t disappear when the
          conversation ends. It should be possible to capture the useful part,
          decide where it applies, and make it available the next time someone
          needs it.
        </p>
        <p>
          That doesn’t make every answer a rule. Decisions, exceptions and
          approved policy need to stay distinguishable. Trust comes from knowing
          the difference.
        </p>
      </section>
      <section>
        <p className="editorial-label">What we are building</p>
        <h2>One company memory, built over time</h2>
        <p>
          Opryn brings useful information together, prepares it for review, and
          makes approved knowledge available to employees, new hires, and
          connected AI. When guidance is missing, a person can answer and
          improve what the business knows next time.
        </p>
      </section>
      <section className="public-callout">
        <h2>Focused by choice.</h2>
        <p>
          Opryn is not an HR suite, an employee monitoring platform, an AI-agent
          builder, or a replacement for every document your company uses. We
          focus on the guidance people and connected systems need to work with
          confidence.
        </p>
      </section>
      <section>
        <h2>Built for real day-to-day use</h2>
        <p>
          Opryn is an early-stage product focused on making company knowledge
          useful and trustworthy. We welcome businesses that want to help shape
          it through real workflows and direct feedback.
        </p>
        {company.operator ? (
          <p>Opryn is operated by {company.operator}.</p>
        ) : null}
        <p>
          <Link href="/contact">Talk to Opryn</Link> or{" "}
          <Link href="/signup">create a workspace</Link>.
        </p>
      </section>
    </PublicInfoPage>
  );
}
