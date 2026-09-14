import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeading } from "@/components/app/page-heading";
import {
  CallPrivacy,
  CallRow,
  CallsLocked,
  CallUploader,
} from "@/components/app/calls-workspace";
import { requireAdminContext } from "@/lib/app-context";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { hasFeature } from "@/lib/billing/plans";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CallsIcon } from "@/components/opryn-icons/opryn-icons";
import { OprynStatus } from "@/components/opryn/opryn-status";

export default async function CallsPage() {
  const context = await requireAdminContext();
  const supabase = await createClient();
  const org = context.organization.id;
  const subscription = await getOrganizationPlan(supabase, org);
  if (!hasFeature(subscription.plan, "callLearning"))
    return (
      <>
        <PageHeading
          eyebrow="Premium learning"
          title="Calls"
          description="Turn real conversations into reusable business knowledge."
        />
        <CallsLocked />
      </>
    );
  const service = createServiceClient();
  const [
    { data: acknowledgment },
    { data: calls },
    { data: findings },
    { data: twilioIntegration },
  ] = await Promise.all([
    supabase
      .from("call_privacy_acknowledgments")
      .select("id")
      .eq("organization_id", org)
      .eq("acknowledged_by", context.user.id)
      .maybeSingle(),
    supabase
      .from("call_recordings")
      .select("id,title,call_type,status,created_at,provider")
      .eq("organization_id", org)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("call_findings")
      .select("finding_type,title,status")
      .eq("organization_id", org)
      .neq("status", "ignored"),
    service
      .from("phone_integrations")
      .select("id,last_webhook_at,last_successful_import_at")
      .eq("organization_id", org)
      .eq("provider", "twilio")
      .eq("status", "active")
      .maybeSingle(),
  ]);
  const common = new Map<string, number>();
  for (const item of findings ?? [])
    if (
      item.finding_type === "customer_question" ||
      item.finding_type === "sales_objection"
    )
      common.set(item.title, (common.get(item.title) ?? 0) + 1);
  const repeated = [...common.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  return (
    <>
      <PageHeading
        eyebrow="Premium learning"
        title="Calls"
        description="Turn real conversations into reusable business knowledge."
      />
      <CallPrivacy acknowledged={Boolean(acknowledgment)} />
      <section className="opryn-surface mb-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center border-r border-[var(--opryn-line)] pr-3 text-[var(--opryn-blue)]">
            <CallsIcon size={19} />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Twilio Call Learning</h2>
              <OprynStatus
                kind={twilioIntegration ? "connected" : "draft"}
                label={twilioIntegration ? "Connected" : "Not connected"}
              />
            </div>
            <p className="mt-1 text-sm text-[#718095]">
              {twilioIntegration
                ? "Completed Twilio recordings can arrive here automatically."
                : "Connect Twilio to learn from selected calls automatically."}
            </p>
          </div>
        </div>
        <Link
          href="/app/integrations/twilio"
          className="opryn-secondary-action"
        >
          {twilioIntegration ? "Manage" : "Connect Twilio"}
          <ArrowRight className="size-4" />
        </Link>
      </section>
      <div className="grid gap-5 xl:grid-cols-[1fr_.8fr]">
        <CallUploader organizationId={org} />
        <section className="opryn-surface p-5 sm:p-6">
          <h2 className="font-semibold">This workspace</h2>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Metric
              label="Calls analyzed"
              value={
                (calls ?? []).filter(
                  (call) =>
                    call.status === "needs_review" ||
                    call.status === "approved",
                ).length
              }
            />
            <Metric
              label="Approved findings"
              value={
                (findings ?? []).filter((item) => item.status === "approved")
                  .length
              }
            />
          </div>
          <h3 className="mt-6 text-sm font-semibold">
            Recurring call insights
          </h3>
          {repeated.length ? (
            <div className="mt-3 space-y-2">
              {repeated.map(([title, count]) => (
                <div
                  key={title}
                  className="flex items-center justify-between rounded-xl bg-[#f7f9fc] p-3 text-sm"
                >
                  <span className="truncate pr-3">{title}</span>
                  <strong>{count}×</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-[#718095]">
              Patterns will appear after Opryn analyzes more calls.
            </p>
          )}
        </section>
      </div>
      <section className="opryn-surface mt-5 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Recent calls</h2>
          <span className="text-xs text-[#7a8798]">
            Uploads and Twilio imports
          </span>
        </div>
        {calls?.length ? (
          <div className="mt-3">
            {calls.map((call) => (
              <CallRow key={call.id} call={call} />
            ))}
          </div>
        ) : (
          <p className="mt-5 rounded-xl bg-[#f7f9fc] p-5 text-sm text-[#718095]">
            No calls analyzed yet. Upload a recording or connect Twilio to begin
            learning from authorized calls.
          </p>
        )}
      </section>
      <section className="mt-5 border-y border-[#e2e7ed] bg-[#f9fafc] p-5">
        <p className="text-sm font-semibold text-[#243750]">
          Use another call source?
        </p>
        <p className="mt-1 text-sm leading-6 text-[#718095]">
          Add the software your business already uses and follow its secure
          setup guide.
        </p>
        <Link
          href="/app/integrations"
          className="mt-4 inline-flex min-h-10 items-center rounded-[8px] border border-[#cbd5e2] px-4 text-xs font-semibold hover:border-[#146bff]"
        >
          Open Connections
        </Link>
      </section>
    </>
  );
}
function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#f7f9fc] p-4">
      <p className="text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-[#718095]">{label}</p>
    </div>
  );
}
