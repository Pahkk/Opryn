import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireAppContext } from "@/lib/app-context";
import { PageHeading } from "@/components/app/page-heading";
export default async function Page() {
  const context = await requireAppContext();
  return (
    <>
      <PageHeading
        title="Help"
        description="Find your next step, or talk to a person."
      />
      <div className="max-w-3xl divide-y divide-[var(--opryn-line)]">
        {[
          [
            "Find an approved answer",
            "Ask Opryn about the processes and rules your role can access.",
            "/app/ask",
          ],
          ...(context.isAdmin
            ? [
                [
                  "Teach and review",
                  "Bring in information, review findings, and approve what should be official.",
                  "/app/processes/new",
                ],
                [
                  "Manage connections",
                  "Check authorization and choose what your connected tools can do.",
                  "/app/integrations",
                ],
              ]
            : [
                [
                  "My Learning",
                  "Follow the approved processes assigned to your role.",
                  "/app/training",
                ],
              ]),
          [
            "Your account",
            "Manage your name, preferences, and sign-in settings.",
            "/app/settings/profile",
          ],
        ].map(([title, description, href]) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-24 items-center justify-between gap-6 py-6"
          >
            <span>
              <strong className="text-base">{title}</strong>
              <span className="mt-2 block text-sm leading-6 text-[var(--opryn-muted)]">
                {description}
              </span>
            </span>
            <ArrowRight size={18} className="shrink-0" />
          </Link>
        ))}
        <section className="py-7">
          <h2 className="text-base font-semibold">Contact Opryn</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--opryn-muted)]">
            Tell us what you were trying to do and what happened. Never send
            passwords, API keys, or private customer information.
          </p>
          <a
            className="mt-4 inline-flex min-h-11 items-center gap-3 text-sm font-semibold text-[var(--opryn-blue)]"
            href="mailto:usersupport@opryn.app"
          >
            usersupport@opryn.app <ArrowRight size={16} />
          </a>
        </section>
      </div>
    </>
  );
}
