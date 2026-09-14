import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/api";

const querySchema = z.enum(["chatgpt", "claude"]);

export async function GET(request: Request) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;

  const provider = querySchema.safeParse(
    new URL(request.url).searchParams.get("provider"),
  );
  if (!provider.success)
    return NextResponse.json(
      { error: "Choose ChatGPT or Claude." },
      { status: 400 },
    );

  const [grantsResult, learningResult] = await Promise.all([
    context.supabase
      .from("mcp_oauth_grants")
      .select("id,scopes,last_used_at")
      .eq("organization_id", context.membership.organization_id)
      .eq("user_id", context.user.id)
      .eq("client_kind", provider.data)
      .is("revoked_at", null)
      .order("authorized_at", { ascending: false })
      .limit(5),
    context.supabase
      .from("external_learning_jobs")
      .select(
        "id,name,status,result_summary,process_id,error_message,created_at,updated_at,last_requested_at",
      )
      .eq("organization_id", context.membership.organization_id)
      .eq("created_by", context.user.id)
      .eq("client_kind", provider.data)
      .order("last_requested_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (grantsResult.error || learningResult.error)
    return NextResponse.json(
      { error: "Opryn couldn't check this connection." },
      { status: 500 },
    );

  const processId = learningResult.data?.process_id;
  const [processResult, rulesResult] = processId
    ? await Promise.all([
        context.supabase
          .from("processes")
          .select("title,status")
          .eq("organization_id", context.membership.organization_id)
          .eq("id", processId)
          .maybeSingle(),
        context.supabase
          .from("process_rules")
          .select("title")
          .eq("organization_id", context.membership.organization_id)
          .eq("process_id", processId)
          .limit(5),
      ])
    : [{ data: null }, { data: [] }];
  const findings = (rulesResult.data ?? []).map((rule) => rule.title as string);
  if (processResult.data?.title) findings.unshift(processResult.data.title);

  return NextResponse.json({
    provider: provider.data,
    connected: Boolean(grantsResult.data?.length),
    learningEnabled: Boolean(
      grantsResult.data?.some((grant) =>
        (grant.scopes ?? []).includes("opryn.learning.create"),
      ),
    ),
    latestLearning: learningResult.data
      ? {
          id: learningResult.data.id,
          createdAt: learningResult.data.created_at,
          requestedAt: learningResult.data.last_requested_at,
          name: learningResult.data.name,
          status: learningResult.data.status,
          summary: learningResult.data.result_summary,
          processId: learningResult.data.process_id,
          findings,
          approved: processResult.data?.status === "approved",
          questions:
            processResult.data?.status === "approved"
              ? findings
                  .slice(0, 3)
                  .map((title) => `What should I know about ${title}?`)
              : [],
          error:
            learningResult.data.status === "failed"
              ? "Opryn couldn't organize this conversation. Try sending it again."
              : null,
          updatedAt: learningResult.data.updated_at,
        }
      : null,
  });
}
