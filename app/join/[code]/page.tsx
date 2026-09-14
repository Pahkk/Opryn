import Link from "next/link";
import { redirect } from "next/navigation";
import { OprynLogo } from "@/components/opryn-logo";
import { normalizeInviteCredential } from "@/lib/invite-code";
import { createClient } from "@/lib/supabase/server";

export default async function JoinTeamPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await params;
  const code = normalizeInviteCredential(rawCode).slice(0, 500);
  const onboardingPath = `/onboarding?mode=join&code=${encodeURIComponent(code)}`;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect(onboardingPath);

  return (
    <main className="opryn-auth-page min-h-screen px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-[480px]">
        <Link href="/" className="flex justify-center" aria-label="Opryn home">
          <OprynLogo size="large" priority />
        </Link>
        <section className="opryn-auth-card mt-8 rounded-[22px] border border-[#dbe2eb] bg-white p-7 shadow-[0_24px_70px_rgba(24,39,75,.08)] sm:p-9">
          <p className="text-xs font-bold uppercase tracking-[.12em] text-[#163f98]">
            Your team invited you
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-.045em] text-[#111b2e]">
            Join your Opryn workspace.
          </h1>
          <p className="mt-4 text-sm leading-6 text-[#657286]">
            Sign in with the email address that received the invitation. Your
            access code is already filled in.
          </p>
          <div className="mt-6 border-y border-[#e2e7ed] py-4">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#8a95a5]">
              Access code
            </p>
            <p className="mt-2 font-mono text-lg font-semibold tracking-[.08em] text-[#0e2f78]">
              {code}
            </p>
          </div>
          <div className="mt-7 grid gap-3">
            <Link
              href={`/signup?next=${encodeURIComponent(onboardingPath)}`}
              className="flex min-h-12 items-center justify-center bg-[#163f98] px-5 text-sm font-semibold text-white transition hover:bg-[#0e2f78]"
            >
              Create account and join
            </Link>
            <Link
              href={`/login?next=${encodeURIComponent(onboardingPath)}`}
              className="flex min-h-12 items-center justify-center border border-[#cfd7e1] bg-white px-5 text-sm font-semibold text-[#2f3b4e] transition hover:bg-[#f7f9fc]"
            >
              Sign in and join
            </Link>
          </div>
        </section>
        <p className="mt-5 text-center text-xs leading-5 text-[#7b8798]">
          Only the invited email address can use this code.
        </p>
      </div>
    </main>
  );
}
