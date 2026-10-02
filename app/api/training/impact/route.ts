import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext, apiError } from "@/lib/api";
export async function GET(request: Request) {
  const ctx = await getRequestContext({ admin: true });
  if ("error" in ctx) return ctx.error;
  const params = new URL(request.url).searchParams;
  const id = params.get("knowledgeId"),
    process = params.get("processId");
  if (!z.uuid().safeParse(id ?? process).success)
    return NextResponse.json(
      { error: "Choose knowledge to inspect." },
      { status: 400 },
    );
  const org = ctx.membership.organization_id,
    db = ctx.supabase;
  try {
    let keys: string[] = [];
    if (id) keys = [id];
    else {
      const p = await db
        .from("processes")
        .select("id,supersedes_process_id")
        .eq("organization_id", org)
        .eq("id", process!)
        .maybeSingle();
      if (p.error) throw p.error;
      if (!p.data)
        return NextResponse.json(
          { error: "Process unavailable." },
          { status: 404 },
        );
      const k = await db
        .from("knowledge_chunks")
        .select("id")
        .eq("organization_id", org)
        .in("process_id", [
          p.data.id,
          ...(p.data.supersedes_process_id
            ? [p.data.supersedes_process_id]
            : []),
        ])
        .limit(200);
      if (k.error) throw k.error;
      keys = (k.data ?? []).map((x) => x.id);
    }
    if (!keys.length)
      return NextResponse.json({
        people: 0,
        roles: 0,
        tests: 0,
        agents: 0,
        scenarios: 0,
        limited: false,
      });
    const [a, r, t, s] = await Promise.all([
      db
        .from("training_assignments")
        .select("user_id")
        .eq("organization_id", org)
        .in("knowledge_chunk_id", keys)
        .is("retired_at", null)
        .limit(501),
      db
        .from("role_knowledge_requirements")
        .select("role_id")
        .eq("organization_id", org)
        .in("knowledge_chunk_id", keys)
        .limit(201),
      db
        .from("knowledge_test_cases")
        .select("id,connection_id")
        .eq("organization_id", org)
        .or(
          `expected_knowledge_ids.ov.{${keys.join(",")}},linked_knowledge_ids.ov.{${keys.join(",")}}`,
        )
        .limit(201),
      db
        .from("training_scenarios")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", org)
        .in("knowledge_chunk_id", keys)
        .neq("status", "retired"),
    ]);
    for (const result of [a, r, t, s]) if (result.error) throw result.error;
    return NextResponse.json({
      people: new Set(a.data?.map((x) => x.user_id)).size,
      roles: new Set(r.data?.map((x) => x.role_id)).size,
      tests: t.data?.length ?? 0,
      agents: new Set(
        t.data?.filter((x) => x.connection_id).map((x) => x.connection_id),
      ).size,
      scenarios: s.count ?? 0,
      limited:
        keys.length >= 200 ||
        (a.data?.length ?? 0) > 500 ||
        (r.data?.length ?? 0) > 200 ||
        (t.data?.length ?? 0) > 200,
    });
  } catch (e) {
    return apiError(
      e,
      "Training impact could not be loaded. Review affected consumers in Training.",
    );
  }
}
