import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  KnowledgeAssignment,
  TrainingKnowledge,
  TrainingScenario,
} from "./model";
export async function trainingWorkspace(
  db: SupabaseClient,
  org: string,
  user: string,
  admin: boolean,
  page = 0,
) {
  const assignments = db
    .from("training_assignments")
    .select(
      "id,user_id,knowledge_chunk_id,required_version,acknowledged_version,passed_version,update_required,previous_version,started_at,retired_at",
    )
    .eq("organization_id", org)
    .not("knowledge_chunk_id", "is", null)
    .is("retired_at", null)
    .order("created_at")
    .range(page * 100, page * 100 + 100);
  const [a, k, s, r, m, requirements, agents, tests] = await Promise.all([
    admin ? assignments : assignments.eq("user_id", user),
    db
      .from("knowledge_chunks")
      .select(
        "id,content,current_version,source_type,process_id,library_category,approved,health_status,library_archived_at,scope,role_id",
      )
      .eq("organization_id", org)
      .eq("approved", true)
      .is("library_archived_at", null)
      .order("created_at", { ascending: false })
      .limit(201),
    db
      .from("training_scenarios")
      .select("*")
      .eq("organization_id", org)
      .in("status", ["approved", "update_required", "draft"])
      .order("created_at", { ascending: false })
      .limit(201),
    db.from("roles").select("id,name").eq("organization_id", org).limit(201),
    admin
      ? db
          .from("organization_members")
          .select(
            "user_id,role_id,profiles!organization_members_user_id_fkey(full_name,email)",
          )
          .eq("organization_id", org)
          .limit(201)
      : Promise.resolve({ data: [], error: null }),
    db
      .from("role_knowledge_requirements")
      .select("role_id,knowledge_chunk_id,stage")
      .eq("organization_id", org)
      .limit(501),
    admin
      ? db
          .from("external_ai_connections")
          .select(
            "id,name,description,provider,status,knowledge_policy,unknown_behavior,configuration_version,behavior_rules",
          )
          .eq("organization_id", org)
          .order("created_at", { ascending: false })
          .limit(101)
      : Promise.resolve({ data: [], error: null }),
    admin
      ? db
          .from("knowledge_test_cases")
          .select(
            "id,title,connection_id,question,expected_behavior,expected_outcome,needs_rerun,last_result,last_run_at,evaluation_version,agent_response_required,agent_response_needs_update,last_agent_result",
          )
          .eq("organization_id", org)
          .not("connection_id", "is", null)
          .is("retired_at", null)
          .limit(201)
      : Promise.resolve({ data: [], error: null }),
  ]);
  for (const x of [a, k, s, r, m, requirements, agents, tests])
    if (x.error) throw x.error;
  // Resolve assigned references even when outside the knowledge picker page.
  const ids = [...new Set((a.data ?? []).map((x) => x.knowledge_chunk_id))];
  const missing = ids.filter((id) => !k.data?.some((x) => x.id === id));
  const extra = missing.length
    ? await db
        .from("knowledge_chunks")
        .select(
          "id,content,current_version,source_type,process_id,library_category,approved,health_status,library_archived_at,scope,role_id",
        )
        .eq("organization_id", org)
        .in("id", missing)
    : { data: [], error: null };
  if (extra.error) throw extra.error;
  const knowledge = [
    ...(k.data ?? []).slice(0, 200),
    ...(extra.data ?? []),
  ] as TrainingKnowledge[];
  const activeScenarios = ids.length
    ? await db
        .from("training_scenarios")
        .select("*")
        .eq("organization_id", org)
        .in("knowledge_chunk_id", ids.slice(0, 100))
        .eq("status", "approved")
        .limit(100)
    : { data: [], error: null };
  if (activeScenarios.error) throw activeScenarios.error;
  const scenarioRows = [
    ...(activeScenarios.data ?? []),
    ...(s.data ?? []).filter(
      (row) => !activeScenarios.data?.some((current) => current.id === row.id),
    ),
  ];
  if (admin && knowledge.length) {
    const keys = knowledge.map((k) => k.id).join(",");
    const conflicts = await db
      .from("knowledge_conflicts")
      .select("knowledge_chunk_a,knowledge_chunk_b")
      .eq("organization_id", org)
      .eq("status", "open")
      .eq("conflict_type", "conflict")
      .or(`knowledge_chunk_a.in.(${keys}),knowledge_chunk_b.in.(${keys})`)
      .limit(1001);
    if (conflicts.error) throw conflicts.error;
    const blocked = new Set(
      (conflicts.data ?? []).flatMap((c) => [
        c.knowledge_chunk_a,
        c.knowledge_chunk_b,
      ]),
    );
    for (const item of knowledge)
      if (blocked.has(item.id) || (conflicts.data?.length ?? 0) > 1000)
        item.health_status = "conflict";
  }
  let allowed = knowledge.map((x) => x.id);
  if (!admin) {
    const checked = await db.rpc("training_accessible_knowledge", {
      target_org: org,
      knowledge_ids: ids.slice(0, 100),
    });
    if (checked.error) throw checked.error;
    allowed = (checked.data ?? []).map((row: { id: string }) => row.id);
  }
  return {
    assignments: (a.data ?? []).slice(0, 100) as KnowledgeAssignment[],
    knowledge: admin
      ? knowledge
      : knowledge.filter((x) => allowed.includes(x.id)),
    scenarios: (admin
      ? scenarioRows
      : scenarioRows.filter((x) =>
          allowed.includes(x.knowledge_chunk_id),
        )) as TrainingScenario[],
    roles: r.data ?? [],
    members: m.data ?? [],
    requirements: requirements.data ?? [],
    agents: agents.data ?? [],
    tests: tests.data ?? [],
    hasMore: (a.data?.length ?? 0) > 100,
    limited:
      (k.data?.length ?? 0) > 200 ||
      (s.data?.length ?? 0) > 200 ||
      (requirements.data?.length ?? 0) > 500 ||
      (agents.data?.length ?? 0) > 100 ||
      (tests.data?.length ?? 0) > 200,
  };
}
