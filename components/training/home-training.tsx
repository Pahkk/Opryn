import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
export async function HomeTraining({
  organizationId,
}: {
  organizationId: string;
}) {
  const db = await createClient();
  const r = await db.rpc("training_operational_summary", {
    target_org: organizationId,
  });
  if (r.error)
    return (
      <section className="owner-working-strip">
        <p className="text-sm">
          Training summary is unavailable.{" "}
          <Link href="/app/training">Open training →</Link>
        </p>
      </section>
    );
  const s = r.data;
  return (
    <section className="owner-working-strip">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
          Training
        </p>
        <p className="mt-2 text-sm">
          <strong>{s.peopleReady}</strong> people ready ·{" "}
          <strong>{s.peopleUpdates}</strong> need updated guidance ·{" "}
          <strong>{s.agentAttention}</strong> agent tests need attention
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Readiness reflects assigned knowledge and recorded checks.
        </p>
      </div>
      <Link className="opryn-action" href="/app/training">
        Review training →
      </Link>
    </section>
  );
}
