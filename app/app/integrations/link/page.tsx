import { redirect } from "next/navigation";
import { OprynLogo } from "@/components/opryn-logo";
import { CommunicationAccountLink } from "@/components/app/communication-account-link";
import { requireUser } from "@/lib/app-context";

export default async function CommunicationLinkPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token || token.length < 20)
    redirect("/app?error=invalid_connection_link");
  await requireUser();
  return (
    <main className="fixed inset-0 z-[200] grid place-items-center bg-[var(--opryn-warm)] p-5">
      <section className="opryn-surface w-full max-w-xl p-7 sm:p-10">
        <div className="mb-8 flex justify-center">
          <OprynLogo size="large" />
        </div>
        <CommunicationAccountLink token={token} />
      </section>
    </main>
  );
}
