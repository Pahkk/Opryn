"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
export function TrainingButton({
  processId,
  status,
}: {
  processId: string;
  status: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function complete() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/training/${processId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!response.ok)
        throw new Error("Your progress wasn't saved. Please try again.");
      router.refresh();
    } catch {
      setError("Your progress wasn't saved. Please try again.");
    } finally {
      setLoading(false);
    }
  }
  return status === "completed" ? (
    <span className="inline-flex items-center gap-2 rounded-xl bg-[#eaf7f1] px-4 py-3 text-sm font-semibold text-[#177257]">
      <CheckCircle2 className="size-4" />
      Completed
    </span>
  ) : (
    <span>
      <button
        disabled={loading}
        onClick={() => void complete()}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#3158d8] px-5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "Saving…" : "Mark Complete"}
        <CheckCircle2 className="size-4" />
      </button>
      {error ? (
        <span role="alert" className="mt-2 block text-sm text-[#a83f49]">
          {error}
        </span>
      ) : null}
    </span>
  );
}
