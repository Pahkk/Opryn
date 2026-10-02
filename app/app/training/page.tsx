import {
  knowledgeScopeSchema,
  matchKnowledgeScope,
} from "@/lib/opryn/knowledge/scope";
import Image from "next/image";
import Link from "next/link";
import { requireAppContext } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";
import { trainingWorkspace } from "@/lib/training/data";
import { knowledgeReadiness, knowledgeTitle } from "@/lib/training/model";
import {
  EmployeeLearning,
  TrainingConfiguration,
  TrainingStatus,
} from "@/components/training/people-training";
import { AgentTraining } from "@/components/training/agent-training";
import "@/components/training/training.css";
export default async function TrainingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string; q?: string }>;
}) {
  const [ctx, query] = await Promise.all([requireAppContext(), searchParams]);
  const db = await createClient();
  const page = Math.min(
    10000,
    Math.max(0, Number.parseInt(query.page ?? "0", 10) || 0),
  );
  const view =
    ctx.isAdmin && query.view === "agents"
      ? "agents"
      : query.view === "mine"
        ? "mine"
        : query.view === "roles"
          ? "roles"
          : "people";
  const data = await trainingWorkspace(
    db,
    ctx.organization.id,
    ctx.user.id,
    ctx.isAdmin && view !== "mine",
    page,
  );
  const stages = Object.fromEntries(
    data.requirements
      .filter((r) => r.role_id === ctx.membership.roleId)
      .map((r) => [r.knowledge_chunk_id, r.stage]),
  );
  const stageRank: Record<string, number> = {
    day_one: 0,
    core: 1,
    advanced: 2,
  };
  const mine = data.assignments
    .filter((a) => a.user_id === ctx.user.id)
    .sort(
      (a, b) =>
        Number(b.update_required) - Number(a.update_required) ||
        (stageRank[stages[a.knowledge_chunk_id]] ?? 1) -
          (stageRank[stages[b.knowledge_chunk_id]] ?? 1),
    );
  const previous: Record<string, string> = {};
  const historical = mine.filter(
    (a) =>
      a.previous_version &&
      data.knowledge.some((k) => k.id === a.knowledge_chunk_id),
  );
  if (historical.length) {
    const versions = await db
      .from("knowledge_versions")
      .select("knowledge_chunk_id,version_number,content")
      .eq("organization_id", ctx.organization.id)
      .in(
        "knowledge_chunk_id",
        historical.map((a) => a.knowledge_chunk_id),
      )
      .in(
        "version_number",
        historical.map((a) => a.previous_version!),
      )
      .limit(1000);
    if (!versions.error)
      for (const a of historical) {
        const v = versions.data?.find(
          (v) =>
            v.knowledge_chunk_id === a.knowledge_chunk_id &&
            v.version_number === a.previous_version,
        );
        if (v) previous[a.knowledge_chunk_id] = v.content;
      }
  }
  const state = (a: (typeof data.assignments)[number]) => {
    const k = data.knowledge.find((k) => k.id === a.knowledge_chunk_id);
    const member = data.members.find((m) => m.user_id === a.user_id);
    const role = data.roles.find((r) => r.id === member?.role_id);
    const scope = knowledgeScopeSchema.safeParse(k?.scope ?? {});
    const accessible =
      !!k &&
      !!member &&
      (!k.role_id || k.role_id === member.role_id) &&
      scope.success &&
      matchKnowledgeScope(scope.data, {
        roles: role ? [role.id, role.name] : [],
        channels: ["employee"],
      }).status === "matches";
    return knowledgeReadiness(
      a,
      k,
      data.scenarios.find(
        (s) =>
          s.knowledge_chunk_id === a.knowledge_chunk_id &&
          s.status === "approved",
      ),
      accessible,
    );
  };
  const members = data.members.map((m) => {
    const p = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
    return {
      id: m.user_id,
      roleId: m.role_id,
      name: p?.full_name || p?.email || "Team member",
    };
  });
  const filter = (query.q ?? "").toLowerCase();
  return (
    <div className="training-workspace">
      <header className="training-header">
        <div className="training-identity">
          {ctx.organization.logoUrl ? (
            <Image
              src={ctx.organization.logoUrl}
              width={30}
              height={30}
              alt={`${ctx.organization.name} logo`}
              unoptimized
            />
          ) : (
            <span className="training-monogram">
              {ctx.organization.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <span className="training-eyebrow">
            {ctx.organization.name} · One approved knowledge layer
          </span>
        </div>
        <h1>Keep your company trained.</h1>
        <p>
          People learn what their role needs. Agents use the same approved
          knowledge with controlled access. Both stay current as your business
          changes.
        </p>
      </header>
      <nav className="training-tabs" aria-label="Training">
        {ctx.isAdmin && (
          <>
            <Link
              href="/app/training"
              aria-current={view === "people" ? "page" : undefined}
            >
              People
            </Link>
            <Link
              href="/app/training?view=agents"
              aria-current={view === "agents" ? "page" : undefined}
            >
              Agents
            </Link>
            <Link
              href="/app/training?view=roles"
              aria-current={view === "roles" ? "page" : undefined}
            >
              Role knowledge
            </Link>
          </>
        )}
        <Link
          href="/app/training?view=mine"
          aria-current={view === "mine" || !ctx.isAdmin ? "page" : undefined}
        >
          My learning
        </Link>
        <Link href="/app/training/legacy">Process training</Link>
      </nav>
      {data.limited && (
        <p role="status" className="training-muted">
          Showing a bounded workspace view. Counts describe the loaded records;
          use Knowledge and Team for the complete library.
        </p>
      )}
      {view === "agents" && ctx.isAdmin ? (
        <AgentTraining agents={data.agents} tests={data.tests} />
      ) : !ctx.isAdmin || view === "mine" ? (
        <EmployeeLearning
          assignments={mine}
          knowledge={data.knowledge}
          scenarios={data.scenarios}
          previous={previous}
          stages={stages}
        />
      ) : (
        <>
          <div className="training-summary">
            <span>
              <strong>
                {data.assignments.filter((a) => state(a) === "Ready").length}
              </strong>{" "}
              knowledge requirements ready
            </span>
            <span>
              <strong>
                {
                  data.assignments.filter((a) => state(a) === "Update Required")
                    .length
                }
              </strong>{" "}
              updates required
            </span>
            <span>
              <strong>
                {data.assignments.filter((a) => state(a) === "Blocked").length}
              </strong>{" "}
              need review
            </span>
          </div>
          <form>
            <input type="hidden" name="view" value={view} />
            <label className="training-field training-search">
              Search people, roles or knowledge
              <input name="q" type="search" defaultValue={query.q ?? ""} />
            </label>
          </form>
          {view === "roles" ? (
            <section className="training-section">
              <h2>Role knowledge map</h2>
              {data.roles
                .filter(
                  (r) =>
                    r.name.toLowerCase().includes(filter) ||
                    data.requirements.some(
                      (req) =>
                        req.role_id === r.id &&
                        data.knowledge.some(
                          (k) =>
                            k.id === req.knowledge_chunk_id &&
                            k.content.toLowerCase().includes(filter),
                        ),
                    ),
                )
                .map((r) => (
                  <details className="training-learn" key={r.id}>
                    <summary className="font-semibold cursor-pointer">
                      {r.name} ·{" "}
                      {
                        data.requirements.filter((x) => x.role_id === r.id)
                          .length
                      }{" "}
                      required areas
                    </summary>
                    {["day_one", "core", "advanced"].map((stage) => (
                      <section key={stage} className="mt-5">
                        <h3 className="training-eyebrow">
                          {stage === "day_one"
                            ? "Day 1 essentials"
                            : stage === "core"
                              ? "Core knowledge"
                              : "Next up"}
                        </h3>
                        {data.requirements
                          .filter(
                            (req) =>
                              req.role_id === r.id && req.stage === stage,
                          )
                          .map((req) => {
                            const k = data.knowledge.find(
                              (k) => k.id === req.knowledge_chunk_id,
                            );
                            return (
                              <div
                                className="training-row"
                                key={req.knowledge_chunk_id}
                              >
                                <span>
                                  {k
                                    ? knowledgeTitle(k)
                                    : "Knowledge outside this view"}
                                </span>
                                <Link
                                  href={`/app/knowledge/${req.knowledge_chunk_id}/impact`}
                                  className="text-sm text-blue-600"
                                >
                                  View impact →
                                </Link>
                              </div>
                            );
                          })}
                      </section>
                    ))}
                  </details>
                ))}
            </section>
          ) : (
            <section className="training-section">
              <h2>People</h2>
              <p>
                Readiness is evidence of required knowledge, not a productivity
                measure.
              </p>
              {members
                .filter((m) =>
                  `${m.name} ${data.roles.find((r) => r.id === m.roleId)?.name ?? ""}`
                    .toLowerCase()
                    .includes(filter),
                )
                .map((m) => {
                  const assignments = data.assignments.filter(
                    (a) => a.user_id === m.id,
                  );
                  const ready = assignments.filter(
                    (a) => state(a) === "Ready",
                  ).length;
                  return (
                    <details
                      key={m.id}
                      className="border-b border-slate-200 py-4"
                    >
                      <summary className="cursor-pointer">
                        <span className="font-semibold mr-3">{m.name}</span>
                        <span className="training-muted">
                          {data.roles.find((r) => r.id === m.roleId)?.name ??
                            "No role assigned"}{" "}
                          · {ready}/{assignments.length} required areas ready
                        </span>
                      </summary>
                      {assignments.map((a) => (
                        <div className="training-row" key={a.id}>
                          <span>
                            {data.knowledge.find(
                              (k) => k.id === a.knowledge_chunk_id,
                            )
                              ? knowledgeTitle(
                                  data.knowledge.find(
                                    (k) => k.id === a.knowledge_chunk_id,
                                  )!,
                                )
                              : "Guidance unavailable"}
                          </span>
                          <TrainingStatus state={state(a)} />
                        </div>
                      ))}
                      {!assignments.length && (
                        <p className="training-muted mt-4">
                          No knowledge requirements assigned in this view.
                        </p>
                      )}
                    </details>
                  );
                })}
            </section>
          )}
          <TrainingConfiguration
            knowledge={data.knowledge}
            roles={data.roles}
          />
        </>
      )}
      <nav className="training-actions" aria-label="Training pages">
        {page > 0 && (
          <Link
            className="training-button secondary"
            href={`/app/training?view=${view}&page=${page - 1}`}
          >
            Previous
          </Link>
        )}
        {data.hasMore && (
          <Link
            className="training-button secondary"
            href={`/app/training?view=${view}&page=${page + 1}`}
          >
            Next assignments
          </Link>
        )}
      </nav>
    </div>
  );
}
