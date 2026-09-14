"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertCircle, ArrowRight, Check } from "lucide-react";
import { showAppToast } from "@/lib/client-toast";

type PendingItem = {
  id: string;
  title: string;
  summary: string;
  source: string;
  sourceTitle: string | null;
  createdAt: string;
  steps: number;
  rules: number;
  clarifications: number;
  highRisk: boolean;
  safeForBulk: boolean;
};

type PendingProposal = {
  version: number;
  updatedAt: string;
  id: string;
  title: string;
  content: string;
  source: string;
  createdAt: string;
  highRisk: boolean;
  reviewRequired: boolean;
  reviewReason: string | null;
  reviewUrl: string;
};

export function PendingApprovals({
  items,
  proposals: initialProposals = [],
}: {
  items: PendingItem[];
  proposals?: PendingProposal[];
}) {
  const router = useRouter();
  const [proposals, setProposals] = useState(initialProposals);
  const [previousProposals, setPreviousProposals] = useState(initialProposals);
  if (previousProposals !== initialProposals) {
    setPreviousProposals(initialProposals);
    setProposals(initialProposals);
  }
  const [selected, setSelected] = useState<string[]>([]);
  const [approving, setApproving] = useState(false);
  const [resolvingProposal, setResolvingProposal] = useState<string | null>(
    null,
  );
  const [notice, setNotice] = useState("");
  const safeIds = useMemo(
    () =>
      new Set(items.filter((item) => item.safeForBulk).map((item) => item.id)),
    [items],
  );
  const selectedSafe = selected.filter((id) => safeIds.has(id));

  async function approveSelected() {
    if (!selectedSafe.length || approving) return;
    setApproving(true);
    setNotice("");
    try {
      const response = await fetch("/api/processes/bulk-approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ processIds: selectedSafe }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Approval failed.");
      const blocked = Number(body.reviewRequired?.length ?? 0);
      setNotice(
        blocked
          ? `${body.approved.length} approved. ${blocked} still need individual review.`
          : `${body.approved.length} ${body.approved.length === 1 ? "item" : "items"} approved.`,
      );
      setSelected([]);
      router.refresh();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Opryn couldn't approve these items.",
      );
    } finally {
      setApproving(false);
    }
  }

  async function resolveProposal(
    proposal: PendingProposal,
    action: "approve" | "deny",
  ) {
    if (resolvingProposal) return;
    setResolvingProposal(proposal.id);
    try {
      const response = await fetch(
        `/api/knowledge-proposals/${proposal.id}/${action}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            version: proposal.version,
            updatedAt: proposal.updatedAt,
          }),
        },
      );
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        if (response.status === 409) router.refresh();
        throw new Error(body.error || "That decision was not saved.");
      }
      setProposals((current) =>
        current.filter((item) => item.id !== proposal.id),
      );
      showAppToast(
        action === "approve" ? "Opryn knows this now." : "Not added.",
        action === "approve"
          ? "Your team and connected AI can use it now."
          : "Opryn won't use this as company policy.",
      );
      router.refresh();
    } catch (error) {
      showAppToast(
        "That decision wasn't saved.",
        error instanceof Error ? error.message : "Please try again.",
      );
    } finally {
      setResolvingProposal(null);
    }
  }

  const total = items.length + proposals.length;

  return (
    <section className="pending-approval-panel mb-7 overflow-hidden rounded-[18px] border border-[var(--opryn-line)] bg-[#f4f3ee]">
      <div className="flex flex-col gap-4 border-b border-[#dce6f5] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <p className="text-sm font-medium text-[var(--opryn-muted)]">
            Needs Approval
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-[-.03em] text-[#172b4d] sm:text-2xl">
            {total} {total === 1 ? "item needs" : "items need"} your approval.
          </h2>
          <p className="mt-1 text-sm text-[#68768a]">
            Accept makes this available to people and AI connections with
            access.
          </p>
        </div>
        <Link
          href="/app/needs-you?filter=approve"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#3158d8] px-4 text-sm font-semibold text-white"
        >
          Review Now <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="divide-y divide-[#e2e9f3] bg-white">
        {proposals.slice(0, 6).map((proposal) => (
          <article
            key={proposal.id}
            className="grid gap-4 px-5 py-5 sm:grid-cols-[1fr_auto] sm:items-center sm:px-6"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-[#172b4d]">
                  {proposal.title}
                </h3>
                {proposal.reviewRequired ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#a15b45]">
                    <AlertCircle className="size-3.5" /> Review required
                  </span>
                ) : null}
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-[#68768a]">
                {proposal.content}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#7a8798]">
                <span>Policy</span>
                <span>Source: {proposal.source}</span>
                <span>{proposal.createdAt}</span>
              </div>
            </div>
            <div className="flex gap-2">
              {proposal.reviewRequired || proposal.content.length > 600 ? (
                <Link
                  href={proposal.reviewUrl}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#3158d8] px-4 text-sm font-semibold text-white"
                >
                  Review
                </Link>
              ) : (
                <button
                  type="button"
                  disabled={resolvingProposal !== null}
                  onClick={() => void resolveProposal(proposal, "approve")}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#3158d8] px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {resolvingProposal === proposal.id ? "Adding…" : "Accept"}
                </button>
              )}
              <button
                type="button"
                disabled={resolvingProposal !== null}
                onClick={() => void resolveProposal(proposal, "deny")}
                className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#cdd8e7] bg-white px-4 text-sm font-semibold text-[#536176] disabled:opacity-50"
              >
                Deny
              </button>
            </div>
          </article>
        ))}
        {items.slice(0, 6).map((item) => (
          <article
            key={item.id}
            className="grid gap-4 px-5 py-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:px-6"
          >
            <label className="flex min-h-11 items-center gap-3 sm:block sm:min-h-0">
              <input
                type="checkbox"
                disabled={!item.safeForBulk}
                checked={selected.includes(item.id)}
                onChange={(event) =>
                  setSelected((current) =>
                    event.target.checked
                      ? [...current, item.id]
                      : current.filter((id) => id !== item.id),
                  )
                }
                className="size-5 accent-[#3158d8] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`Select ${item.title}`}
              />
              <span className="text-xs text-[#68768a] sm:sr-only">Select</span>
            </label>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-semibold text-[#172b4d]">{item.title}</h3>
                {item.highRisk ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#a15b45]">
                    <AlertCircle className="size-3.5" /> Individual review
                  </span>
                ) : null}
              </div>
              <p className="mt-1 line-clamp-1 text-sm text-[#68768a]">
                {item.summary || "Structured process ready for review."}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#7a8798]">
                <span>Process</span>
                <span>Source: {item.source}</span>
                <span>{item.steps} steps</span>
                <span>{item.rules} rules</span>
                {item.clarifications ? (
                  <span>{item.clarifications} clarifications</span>
                ) : null}
                <span>{item.createdAt}</span>
              </div>
            </div>
            <Link
              href={`/app/processes/${item.id}?review=true&returnTo=%2Fapp%2Fprocesses`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#cdd8e7] px-4 text-sm font-semibold text-[#3158d8] hover:bg-[#f4f7ff]"
            >
              Review
            </Link>
          </article>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-[#dce6f5] px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs text-[#68768a]">
          High-risk policy and unanswered clarifications require individual
          review.
        </p>
        <button
          type="button"
          onClick={() => void approveSelected()}
          disabled={!selectedSafe.length || approving}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#eaf1ff] px-4 text-sm font-semibold text-[#3158d8] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Check className="size-4" />
          {approving
            ? "Approving…"
            : `Accept Selected${selectedSafe.length ? ` (${selectedSafe.length})` : ""}`}
        </button>
      </div>
      {notice ? (
        <p
          role="status"
          className="border-t border-[#dce6f5] px-5 py-3 text-sm text-[#52627a] sm:px-6"
        >
          {notice}
        </p>
      ) : null}
    </section>
  );
}
