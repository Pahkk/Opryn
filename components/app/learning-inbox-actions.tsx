"use client";

import { useRouter } from "next/navigation";
import { showAppToast } from "@/lib/client-toast";
import {
  OprynAction,
  useActionFeedback,
} from "@/components/motion/opryn-action";

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
  const feedback = useActionFeedback();
  async function run() {
    await feedback.run(async () => {
      const response = await fetch("/api/learning-inbox", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(action),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(
          body.error || "That review wasn't saved. Please try again.",
        );
      }
      showAppToast(
        action.action === "confirm_knowledge"
          ? "Still accurate."
          : "Learning Inbox updated.",
        action.action === "confirm_knowledge"
          ? "Opryn will keep using this approved knowledge."
          : "Your review was saved.",
      );
      router.refresh();
    });
  }
  return (
    <OprynAction
      label={typeof children === "string" ? children : "Save review"}
      pendingLabel="Saving…"
      successLabel={
        action.action === "resolve_conflict"
          ? "Resolved"
          : action.action === "confirm_knowledge"
            ? "Confirmed"
            : "Saved"
      }
      state={feedback.state}
      errorMessage={feedback.error}
      variant={primary ? "primary" : "secondary"}
      onClick={() => void run()}
    />
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
  const feedback = useActionFeedback();
  async function approve() {
    await feedback.run(async () => {
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
      if (!response.ok) {
        throw new Error(
          body.error || "That approval wasn't saved. Please try again.",
        );
      }
      showAppToast(
        "Opryn remembered it.",
        "Your team can use this approved answer now.",
      );
      router.refresh();
    });
  }
  return (
    <OprynAction
      label="Remember It"
      pendingLabel="Approving…"
      successLabel="Approved"
      state={feedback.state}
      errorMessage={feedback.error}
      onClick={() => void approve()}
    />
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
      key={critical ? "critical" : "normal"}
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
