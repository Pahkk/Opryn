"use client";
import { useRouter } from "next/navigation";
import {
  OprynAction,
  useActionFeedback,
} from "@/components/motion/opryn-action";
export function TrainingButton({
  processId,
  status,
}: {
  processId: string;
  status: string;
}) {
  const router = useRouter();
  const feedback = useActionFeedback();
  async function complete() {
    await feedback.run(async () => {
      const response = await fetch(`/api/training/${processId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!response.ok)
        throw new Error("Your progress wasn't saved. Please try again.");
      router.refresh();
    });
  }
  return (
    <OprynAction
      label="Mark Complete"
      pendingLabel="Completing…"
      successLabel="Completed"
      state={status === "completed" ? "success" : feedback.state}
      errorMessage={feedback.error}
      onClick={() => void complete()}
    />
  );
}
