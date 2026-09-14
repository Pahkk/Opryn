import { NextResponse } from "next/server";
import { z } from "zod";
import { getRequestContext } from "@/lib/api";

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const context = await getRequestContext({ admin: true });
  if ("error" in context) return context.error;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return NextResponse.json({ error: "Process not found." }, { status: 404 });
  const db = context.supabase,
    org = context.membership.organization_id;
  const process = await db
    .from("processes")
    .select("*")
    .eq("organization_id", org)
    .eq("id", id)
    .maybeSingle();
  if (process.error)
    return NextResponse.json(
      { error: "Review could not load." },
      { status: 503 },
    );
  if (!process.data || process.data.library_archived_at)
    return NextResponse.json(
      { error: "This process is no longer available for review." },
      { status: 404 },
    );
  const [steps, rules, exceptions, questions, assignments, roles, members] =
    await Promise.all([
      db
        .from("process_steps")
        .select("id,title,description")
        .eq("organization_id", org)
        .eq("process_id", id)
        .order("step_order"),
      db
        .from("process_rules")
        .select("id,title,text,confidence")
        .eq("organization_id", org)
        .eq("process_id", id),
      db
        .from("process_exceptions")
        .select("text")
        .eq("organization_id", org)
        .eq("process_id", id),
      db
        .from("clarification_questions")
        .select("id,question,answer,suggested_rule")
        .eq("organization_id", org)
        .eq("process_id", id),
      db
        .from("process_role_assignments")
        .select("role_id")
        .eq("organization_id", org)
        .eq("process_id", id),
      db.from("roles").select("id,name").eq("organization_id", org),
      db
        .from("organization_members")
        .select("user_id")
        .eq("organization_id", org),
    ]);
  if (
    [steps, rules, exceptions, questions, assignments, roles, members].some(
      (r) => r.error,
    )
  )
    return NextResponse.json(
      { error: "Review could not load. Retry without leaving Knowledge." },
      { status: 503 },
    );
  const memberIds = (members.data || []).map((m) => m.user_id);
  const profiles = memberIds.length
    ? await db.from("profiles").select("id,full_name,email").in("id", memberIds)
    : { data: [], error: null };
  if (profiles.error)
    return NextResponse.json(
      { error: "Reviewers could not load." },
      { status: 503 },
    );
  const p = process.data;
  return NextResponse.json(
    {
      initial: {
        id: p.id,
        title: p.title,
        summary: p.summary || "",
        purpose: p.purpose || "",
        status: p.status,
        roleId: assignments.data?.[0]?.role_id || null,
        expertId: p.assigned_expert_id || null,
        criticality: p.criticality || "normal",
        libraryCategory: p.library_category,
        libraryTags: p.library_tags,
        libraryRevision: p.library_revision,
        steps: steps.data || [],
        rules: rules.data || [],
        exceptions: exceptions.data || [],
        clarifications: (questions.data || []).map((q) => ({
          id: q.id,
          question: q.question,
          answer: q.answer || "",
          suggestedRule: q.suggested_rule || "",
        })),
      },
      roleOptions: (roles.data || []).map((r) => ({ id: r.id, label: r.name })),
      expertOptions: (profiles.data || []).map((p) => ({
        id: p.id,
        label: p.full_name || p.email,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
