import Link from "next/link";
import { ArrowRight, FileText } from "lucide-react";
import { PageHeading } from "@/components/app/page-heading";
import { ProviderLogo } from "@/components/connections/provider-logo";
import { OprynLearningFlow } from "@/components/opryn/opryn-learning-flow";
import { requireAdminContext } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";

export default async function LearningSourcesPage() {
  const context = await requireAdminContext();
  const supabase = await createClient();
  const organizationId = context.organization.id;
  const [
    processesResult,
    integrationsResult,
    mcpResult,
    callsResult,
    googleResult,
  ] = await Promise.all([
    supabase
      .from("processes")
      .select("learning_source,status")
      .eq("organization_id", organizationId),
    supabase
      .from("communication_integrations")
      .select("provider,status")
      .eq("organization_id", organizationId)
      .neq("status", "disconnected"),
    supabase
      .from("mcp_oauth_grants")
      .select("client_kind")
      .eq("organization_id", organizationId)
      .is("revoked_at", null),
    supabase
      .from("phone_integrations")
      .select("provider,status")
      .eq("organization_id", organizationId)
      .neq("status", "disconnected"),
    supabase
      .from("integrations")
      .select("status")
      .eq("organization_id", organizationId)
      .eq("provider", "google_drive")
      .neq("status", "disconnected")
      .maybeSingle(),
  ]);

  const processes = processesResult.data ?? [];
  const count = (source: string) =>
    processes.filter((process) => process.learning_source === source).length;
  const communication = new Map(
    (integrationsResult.data ?? []).map((item) => [item.provider, item.status]),
  );
  const mcpClients = new Set(
    (mcpResult.data ?? []).map((grant) => grant.client_kind),
  );
  const twilioConnected = (callsResult.data ?? []).some(
    (item) => item.provider === "twilio" && item.status === "active",
  );
  const googleConnected = googleResult.data?.status === "connected";
  const activeSources = [
    count("google_drive") ? "Google Drive" : null,
    count("voice") ? "Voice" : null,
    count("ai_conversation") ? "AI conversations" : null,
    count("video") || count("screen") ? "Video" : null,
    twilioConnected ? "Calls" : null,
  ].filter((value): value is string => Boolean(value));

  const rows = [
    {
      id: "google_drive",
      name: "Google Workspace",
      detail: count("google_drive")
        ? `${count("google_drive")} imported item${count("google_drive") === 1 ? "" : "s"}`
        : googleConnected
          ? "Connected and ready for selected files"
          : "Bring in selected Docs, Sheets, and Slides",
      connected: googleConnected,
      href: "/app/integrations?provider=google_drive",
      action: googleConnected ? "Choose files" : "Connect",
    },
    {
      id: "documents",
      name: "Documents & explanations",
      detail: `${count("text") + count("voice") + count("ai_conversation")} item${count("text") + count("voice") + count("ai_conversation") === 1 ? "" : "s"} taught directly or from selected chats`,
      connected: count("text") + count("voice") + count("ai_conversation") > 0,
      href: "/app/processes/new",
      action: "Teach Opryn",
    },
    {
      id: "twilio",
      name: "Calls",
      detail: twilioConnected
        ? "Twilio Call Learning is connected"
        : "Learn from selected recorded business calls",
      connected: twilioConnected,
      href: "/app/integrations/twilio",
      action: twilioConnected ? "Manage" : "Connect",
    },
    {
      id: "slack",
      name: "Slack",
      detail:
        communication.get("slack") === "active"
          ? "Your team can use Opryn from Slack"
          : "Let your team ask Opryn from Slack",
      connected: communication.get("slack") === "active",
      href: "/app/integrations/slack",
      action: communication.get("slack") === "active" ? "Manage" : "Connect",
    },
    {
      id: "chatgpt",
      name: "ChatGPT & Claude",
      detail: mcpClients.size
        ? "Connected for approved Opryn knowledge access"
        : "Give your AI tools access to what Opryn knows",
      connected: mcpClients.size > 0,
      href: "/app/integrations?filter=ai",
      action: mcpClients.size ? "Manage" : "Set up",
    },
  ];

  return (
    <>
      <PageHeading
        eyebrow="Opryn Learn"
        title="Learning Sources"
        description="Show Opryn where your business knowledge already lives. Disconnecting a source never silently deletes approved company knowledge."
        actions={
          <Link href="/app/processes/new" className="opryn-action">
            Add Source <ArrowRight size={15} />
          </Link>
        }
      />

      <OprynLearningFlow
        sources={activeSources}
        completeThrough={
          processes.some((item) => item.status === "approved")
            ? "approved"
            : "sources"
        }
        detail="Sources create reviewable findings. Only approved knowledge becomes an answer your team can rely on."
      />

      <section className="mt-8 overflow-hidden rounded-[20px] border border-[var(--opryn-line)] bg-white shadow-[var(--opryn-shadow-sm)]">
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid gap-4 border-b border-[var(--opryn-line)] p-5 last:border-0 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6"
          >
            <div className="flex items-center gap-4">
              {row.id === "documents" ? (
                <span className="grid size-11 place-items-center rounded-[13px] border border-[#dce4ee] bg-white text-[#53657d]">
                  <FileText size={19} />
                </span>
              ) : (
                <ProviderLogo id={row.id} name={row.name} />
              )}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-[var(--opryn-navy)]">
                    {row.name}
                  </h2>
                  <span
                    className={`text-xs font-semibold ${row.connected ? "text-[var(--opryn-blue)]" : "text-[var(--opryn-faint)]"}`}
                  >
                    {row.connected ? "Ready" : "Not added"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[var(--opryn-muted)]">
                  {row.detail}
                </p>
              </div>
            </div>
            <Link
              href={row.href}
              className="opryn-secondary-action min-h-10 justify-center px-4"
            >
              {row.action}
            </Link>
          </div>
        ))}
      </section>
    </>
  );
}
