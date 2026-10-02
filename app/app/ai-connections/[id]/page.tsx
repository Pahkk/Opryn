import { notFound } from "next/navigation";
import Link from "next/link";
import { ConnectionDetail } from "@/components/app/ai-connections";
import { PageHeading } from "@/components/app/page-heading";
import { requireAdminContext } from "@/lib/app-context";
import { requireFeature } from "@/lib/billing/subscription";
import { createClient } from "@/lib/supabase/server";
import { ConnectionIcon } from "@/components/opryn-icons/opryn-icons";
import { OprynStatus } from "@/components/opryn/opryn-status";
import { AIAccessPolicy } from "@/components/app/ai-access-policy";

export default async function AIConnectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requireAdminContext();
  const supabase = await createClient();
  const org = context.organization.id;
  await requireFeature(supabase, org, "aiConnections");
  const { id } = await params;
  // This server-rendered cutoff intentionally reflects the request time.
  // eslint-disable-next-line react-hooks/purity
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const [
    { data: connection },
    { data: scopes },
    { data: access },
    { data: activity },
    { data: escalations },
    { data: key },
    knowledge,
  ] = await Promise.all([
    supabase
      .from("external_ai_connections")
      .select(
        "id,agent_id,name,provider,description,status,knowledge_mode,last_used_at,created_at,updated_at,knowledge_policy,unknown_behavior,activity_retention_days",
      )
      .eq("id", id)
      .eq("organization_id", org)
      .maybeSingle(),
    supabase
      .from("external_ai_scopes")
      .select("scope")
      .eq("connection_id", id)
      .eq("organization_id", org),
    supabase
      .from("external_ai_knowledge_access")
      .select("source_type,source_id")
      .eq("connection_id", id)
      .eq("organization_id", org),
    supabase
      .from("external_ai_activity")
      .select(
        "id,endpoint,result_status,source_count,created_at,knowledge_versions",
      )
      .eq("connection_id", id)
      .eq("organization_id", org)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("external_ai_escalations")
      .select(
        "id,question,context,status,resolution,proposed_rule,created_at,is_one_time_exception,knowledge_proposal_id",
      )
      .eq("connection_id", id)
      .eq("organization_id", org)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("external_ai_api_keys")
      .select("key_prefix")
      .eq("connection_id", id)
      .eq("organization_id", org)
      .is("revoked_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("knowledge_chunks")
      .select("id,content,library_category,current_version")
      .eq("organization_id", org)
      .eq("approved", true)
      .is("library_archived_at", null)
      .order("created_at", { ascending: false })
      .limit(501),
  ]);
  if (!connection) notFound();
  if (knowledge.error)
    throw new Error("AI knowledge access could not be loaded.");
  const recent = (activity ?? []).filter((item) => item.created_at >= since);
  const stats = {
    queries: recent.filter((item) => item.endpoint === "answer").length,
    answered: recent.filter(
      (item) => item.endpoint === "answer" && item.result_status === "answered",
    ).length,
    unknown: recent.filter(
      (item) => item.endpoint === "answer" && item.result_status === "unknown",
    ).length,
    escalated: recent.filter(
      (item) =>
        item.endpoint === "escalations" && item.result_status === "created",
    ).length,
  };
  return (
    <>
      <PageHeading
        eyebrow="Connections"
        title={connection.name}
        description={connection.description || "External AI connection"}
        actions={
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold ${connection.status === "active" ? "bg-[#eaf7f1] text-[#177257]" : "bg-[#eef0f3] text-[#6d7888]"}`}
          >
            <ConnectionIcon size={14} />
            <OprynStatus
              kind={connection.status === "active" ? "connected" : "draft"}
              label={connection.status === "active" ? "Connected" : "Paused"}
            />
          </span>
        }
      />
      <ConnectionDetail
        connection={connection as never}
        scopes={(scopes ?? []).map((item) => item.scope)}
        access={(access ?? []) as never[]}
        activity={(activity ?? []) as never[]}
        escalations={(escalations ?? []) as never[]}
        keyPrefix={key?.key_prefix ?? null}
        stats={stats}
      />
      <AIAccessPolicy
        connection={connection}
        knowledge={(knowledge.data ?? []).slice(0, 500)}
        limited={(knowledge.data?.length ?? 0) > 500}
      />
      <section className="mt-6 border-t border-[#dbe5f2] pt-6">
        <h2 className="text-xl font-semibold">Recent sourced lookups</h2>
        <p className="mt-2 text-sm text-[#566279]">
          Actual item/version records from this release onward. Older logs do
          not identify versions.
        </p>
        <ul className="mt-4 divide-y divide-[#dbe5f2]">
          {(activity ?? [])
            .filter(
              (a) =>
                Array.isArray(a.knowledge_versions) &&
                a.knowledge_versions.length,
            )
            .slice(0, 10)
            .map((a) => (
              <li key={a.id} className="py-3 text-sm">
                <time>{new Date(a.created_at).toLocaleString()}</time>
                <span className="ml-2">
                  {a.endpoint === "answer" ? "Answer" : "Knowledge lookup"}
                </span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    a.knowledge_versions as Array<{
                      id: string;
                      version: number;
                    }>
                  ).map((v) => (
                    <Link
                      key={v.id}
                      className="opryn-secondary-action"
                      href={`/app/knowledge/${v.id}/impact`}
                    >
                      {knowledge.data
                        ?.find((k) => k.id === v.id)
                        ?.content.split(/[\n:]/)[0]
                        .slice(0, 65) || "Knowledge item"}{" "}
                      · v{v.version}
                    </Link>
                  ))}
                </div>
              </li>
            ))}
        </ul>
      </section>
      <Link
        href={`/app/knowledge/test?connectionId=${id}`}
        className="opryn-button-secondary mt-5 inline-flex min-h-11 items-center px-4"
      >
        Test connection permissions
      </Link>
    </>
  );
}
