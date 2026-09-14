"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { showAppToast } from "@/lib/client-toast";

type Action =
  | { action: "confirm_knowledge"; knowledgeId: string; version: number }
  | { action: "needs_update"; knowledgeId: string }
  | { action: "resolve_feedback"; feedbackId: string }
  | { action: "dismiss_cluster"; clusterId: string }
  | {
      action: "resolve_conflict";
      conflictId: string;
      resolution: "use_first" | "use_second" | "keep_both";
    }
  | {
      action: "set_criticality";
      knowledgeId: string;
      criticality: "normal" | "critical";
    };

export function InboxAction({
  action,
  children,
  primary = false,
}: {
  action: Action;
  children: React.ReactNode;
  primary?: boolean;
}) {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    let response: Response;
    try {
      response = await fetch("/api/learning-inbox", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action),
      });
    } catch {
      setBusy(false);
      showAppToast(
        "That review wasn't saved.",
        "Check your connection and try again.",
      );
      return;
    }
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setBusy(false);
    if (!response.ok) {
      showAppToast(
        "That review wasn't saved.",
        body.error || "Please try again.",
      );
      return;
    }
    buttonRef.current
      ?.closest("[data-inbox-card]")
      ?.classList.add("is-resolving");
    showAppToast(
      action.action === "confirm_knowledge"
        ? "Still accurate."
        : "Learning Inbox updated.",
      action.action === "confirm_knowledge"
        ? "Opryn will keep using this approved knowledge."
        : "Your review was saved.",
    );
    window.setTimeout(() => router.refresh(), 260);
  }
  return (
    <button
      ref={buttonRef}
      type="button"
      disabled={busy}
      onClick={() => void run()}
      className={`min-h-10 rounded-lg px-3.5 text-xs font-semibold disabled:opacity-50 ${
        primary
          ? "bg-[#3158d8] text-white"
          : "border border-[#d5dde7] bg-white text-[#536176]"
      }`}
    >
      {busy ? "Saving…" : children}
    </button>
  );
}

export function SuggestedKnowledgeApproval({
  questionId,
  answerId,
  rule,
}: {
  questionId: string;
  answerId: string;
  rule: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function approve() {
    setBusy(true);
    const response = await fetch(`/api/questions/${questionId}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        answerId,
        action: "approve",
        title: "Expert guidance",
        rule,
      }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    setBusy(false);
    if (!response.ok) {
      showAppToast(
        "That approval wasn't saved.",
        body.error || "Please try again.",
      );
      return;
    }
    showAppToast(
      "Opryn remembered it.",
      "Your team can use this approved answer now.",
    );
    router.refresh();
  }
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void approve()}
      className="min-h-10 rounded-lg bg-[#3158d8] px-3.5 text-xs font-semibold text-white disabled:opacity-50"
    >
      {busy ? "Approving…" : "Remember It"}
    </button>
  );
}

export function KnowledgeCriticalityToggle({
  knowledgeId,
  critical,
}: {
  knowledgeId: string;
  critical: boolean;
}) {
  return (
    <InboxAction
      action={{
        action: "set_criticality",
        knowledgeId,
        criticality: critical ? "normal" : "critical",
      }}
    >
      {critical ? "Remove Critical label" : "Mark Critical"}
    </InboxAction>
  );
}
