import Link from "next/link";
import { redirect } from "next/navigation";
import { OprynLogo } from "@/components/opryn-logo";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseAuthorizationRequest } from "@/lib/opryn/oauth/validation";

export default async function OAuthAuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(raw))
    if (typeof value === "string") params.set(key, value);
  let authorization;
  try {
    authorization = parseAuthorizationRequest(params);
  } catch (error) {
    return (
      <AuthorizationError
        message={
          error instanceof Error
            ? error.message
            : "Invalid authorization request."
        }
      />
    );
  }
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) {
    const next = `/oauth/authorize?${params.toString()}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const service = createServiceClient();
  const { data: client } = await service
    .from("mcp_oauth_clients")
    .select("id,client_name,redirect_uris")
    .eq("client_id", authorization.clientId)
    .maybeSingle();
  if (
    !client ||
    !(client.redirect_uris as string[]).includes(authorization.redirectUri)
  )
    return (
      <AuthorizationError message="This AI client or callback address is not registered with Opryn." />
    );
  const { data: memberships } = await service
    .from("organization_members")
    .select("organization_id,permission_level,organizations!inner(id,name)")
    .eq("user_id", authData.user.id);
  const organizations = [] as Array<{ id: string; name: string }>;
  for (const membership of memberships ?? []) {
    const rawOrganization = membership.organizations as unknown;
    const organization = (
      Array.isArray(rawOrganization) ? rawOrganization[0] : rawOrganization
    ) as { id: string; name: string };
    organizations.push(organization);
  }
  if (!organizations.length)
    return (
      <AuthorizationError message="Create or join an Opryn business before connecting this client." />
    );
  return (
    <main className="opryn-auth-page min-h-screen px-4 py-10 text-[#071b3d] sm:py-16">
      <section className="opryn-auth-card mx-auto max-w-[520px] rounded-[22px] border border-[#dbe2ec] bg-white p-6 shadow-[0_22px_60px_rgba(7,27,61,.08)] sm:p-8">
        <OprynLogo size="large" priority />
        <p className="mt-9 text-xs font-semibold uppercase tracking-[.12em] text-[#146bff]">
          Secure connection
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-.04em]">
          Connect {client.client_name} to Opryn
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#657188]">
          This lets {client.client_name} use only the approved company knowledge
          your Opryn account can already access.
        </p>
        <form
          action="/api/oauth/authorize"
          method="post"
          className="mt-7 space-y-5"
        >
          {Array.from(params.entries()).map(([key, value]) => (
            <input key={key} type="hidden" name={key} value={value} />
          ))}
          <label className="block text-sm font-semibold">
            Which business should this connection use?
            <select
              name="organization_id"
              required
              className="mt-2 min-h-12 w-full border border-[#cfd8e5] bg-white px-3 text-sm outline-none focus:border-[#146bff]"
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </label>
          <div className="border-y border-[#e1e6ed] py-4">
            <p className="text-sm font-semibold">Requested access</p>
            <ul className="mt-2 space-y-2 text-sm text-[#657188]">
              {authorization.scopes.map((scope) => (
                <li key={scope}>— {scopeLabel(scope)}</li>
              ))}
            </ul>
          </div>
          <p className="text-xs leading-5 text-[#788499]">
            Opryn never gives the AI client your password. You can revoke this
            connection at any time.
          </p>
          <div className="flex gap-3">
            <button
              name="decision"
              value="approve"
              className="min-h-12 flex-1 bg-[#146bff] px-4 text-sm font-semibold text-white hover:bg-[#0f57d2]"
            >
              Allow access
            </button>
            <button
              name="decision"
              value="deny"
              className="min-h-12 border border-[#d7dee8] px-4 text-sm font-semibold hover:bg-[#f5f7fa]"
            >
              Cancel
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

function AuthorizationError({ message }: { message: string }) {
  return (
    <main className="opryn-auth-page grid min-h-screen place-items-center p-4 text-[#071b3d]">
      <section className="opryn-auth-card w-full max-w-md rounded-[22px] border border-[#dbe2ec] bg-white p-7 text-center">
        <OprynLogo size="large" priority />
        <h1 className="mt-8 text-2xl font-semibold">
          Opryn couldn&apos;t connect this client.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#657188]">{message}</p>
        <Link
          href="/app/integrations?filter=ai"
          className="mt-6 inline-flex min-h-11 items-center bg-[#146bff] px-4 text-sm font-semibold text-white"
        >
          Back to Connections
        </Link>
      </section>
    </main>
  );
}

function scopeLabel(scope: string) {
  return (
    (
      {
        "opryn.knowledge.read": "Read approved company knowledge",
        "opryn.processes.read": "Read approved processes",
        "opryn.sources.read": "Show supporting sources",
        "opryn.escalations.create":
          "Ask an owner or expert when guidance is missing",
        "opryn.learning.create":
          "Send selected conversation context to Opryn for owner review",
        "opryn.processes.create":
          "Create suggested processes from selected conversation context",
        "opryn.processes.approve":
          "Approve or deny safe knowledge and process proposals when you explicitly ask",
      } as Record<string, string>
    )[scope] || scope
  );
}
