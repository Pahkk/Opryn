import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { CallReview } from "@/components/app/call-review";
import { CallProcessing } from "@/components/app/call-processing";
import { PageHeading } from "@/components/app/page-heading";
import { requireAdminContext } from "@/lib/app-context";
import { requireFeature } from "@/lib/billing/subscription";
import { createClient } from "@/lib/supabase/server";

export default async function CallReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const context = await requireAdminContext();
  const supabase = await createClient();
  const { id } = await params;
  const org = context.organization.id;
  await requireFeature(supabase, org, "callLearning");
  const [{ data: call }, { data: findings }] = await Promise.all([
    supabase
      .from("call_recordings")
      .select(
        "id,title,call_type,status,created_at,provider,duration_seconds,channels,analysis_summary,transcript_text,error_message",
      )
      .eq("id", id)
      .eq("organization_id", org)
      .maybeSingle(),
    supabase
      .from("call_findings")
      .select("id,finding_type,title,content,evidence,confidence,status")
      .eq("call_id", id)
      .eq("organization_id", org)
      .order("created_at"),
  ]);
  if (!call) notFound();
  return (
    <>
      <Link
        href="/app/calls"
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-[#687487] hover:text-[#3158d8]"
      >
        <ArrowLeft className="size-4" />
        Back to calls
      </Link>
      <PageHeading
        eyebrow={`${call.provider === "twilio" ? "Twilio" : "Uploaded"} · ${call.call_type} call · ${new Date(call.created_at).toLocaleDateString()}`}
        title={call.title}
        description={
          call.analysis_summary || "Opryn learned from this conversation."
        }
      />
      <div className="mb-5 flex flex-wrap gap-2 text-xs text-[#687487]">
        {call.duration_seconds ? (
          <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
            {Math.floor(call.duration_seconds / 60)}m{" "}
            {call.duration_seconds % 60}s
          </span>
        ) : null}
        <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
          {call.channels === 2 ? "Dual-channel audio" : "Single-channel audio"}
        </span>
        <span className="rounded-full bg-white px-3 py-1.5 shadow-sm">
          Source: {call.provider === "twilio" ? "Twilio call" : "Manual upload"}
        </span>
      </div>
      {call.status === "needs_review" || call.status === "approved" ? (
        <>
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-[#dce6e1] bg-[#f3faf7] p-4 text-sm leading-6 text-[#46665b]">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-[#2b9a76]" />
            <p>
              <strong>Review required.</strong> Observed and unknown findings
              are not official company knowledge. Only items you approve can be
              used by Ask Opryn.
            </p>
          </div>
          <CallReview callId={call.id} initialFindings={findings ?? []} />
        </>
      ) : (
        <CallProcessing
          callId={call.id}
          status={call.status}
          errorMessage={call.error_message}
        />
      )}
      {call.transcript_text ? (
        <details className="mt-5 rounded-2xl border border-[#dfe5ed] bg-white p-5 sm:p-6">
          <summary className="cursor-pointer text-sm font-semibold">
            View redacted transcript
          </summary>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[#59677b]">
            {call.transcript_text}
          </p>
        </details>
      ) : null}
    </>
  );
}
