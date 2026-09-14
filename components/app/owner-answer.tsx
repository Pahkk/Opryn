"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { showAppToast } from "@/lib/client-toast";
export function OwnerAnswer({
  questionId,
  onResolved,
}: {
  questionId: string;
  onResolved?: () => void;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [suggestion, setSuggestion] = useState<{
    answerId: string;
    title: string;
    rule: string;
    complete: boolean;
    clarificationQuestions: string[];
    canApprove: boolean;
  } | null>(null);
  const [clarifications, setClarifications] = useState<Record<string, string>>(
    {},
  );
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  async function prepare() {
    setLoading(true);
    setError("");
    const response = await fetch(`/api/questions/${questionId}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        answer,
        answerId: suggestion?.answerId,
        clarificationAnswers: suggestion?.clarificationQuestions.map(
          (question) => ({
            question,
            answer: clarifications[question] || "",
          }),
        ),
      }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(body.error ?? "Unable to save answer.");
      return;
    }
    setSuggestion(body);
    setEditing(false);
    setClarifications((current) =>
      Object.fromEntries(
        (body.clarificationQuestions ?? []).map((question: string) => [
          question,
          current[question] ?? "",
        ]),
      ),
    );
  }
  async function resolve(
    action: "approve" | "answer_only" | "request_approval",
  ) {
    if (!suggestion) return;
    setLoading(true);
    const response = await fetch(`/api/questions/${questionId}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...suggestion, action }),
    });
    const body = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(body.error ?? "Unable to finish.");
      return;
    }
    showAppToast(
      action === "approve" ? "Company rule approved!" : "Answer sent!",
      action === "approve"
        ? "Opryn can use it the next time this question comes up."
        : action === "request_approval"
          ? "The answer was sent and the reusable rule is waiting for owner approval."
          : "The employee question has been resolved.",
    );
    onResolved?.();
    router.refresh();
  }
  return (
    <div className="mt-4 border-t border-[#e8ecf1] pt-4">
      {!suggestion ? (
        <>
          <label className="block text-xs font-semibold text-[#657286]">
            What should your teammate know?
            <textarea
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Answer the way you would explain it to an employee…"
              rows={3}
              className="mt-2 w-full rounded-xl border border-[#d8e0e9] p-3 text-sm leading-5 outline-none focus:border-[#7190ee]"
            />
          </label>
          {error ? (
            <p className="mt-2 text-xs text-[#a83f49]">{error}</p>
          ) : null}
          <button
            disabled={!answer.trim() || loading}
            onClick={() => void prepare()}
            className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#3158d8] px-4 text-xs font-semibold text-white disabled:opacity-50"
          >
            {loading ? (
              <LoaderCircle className="size-3.5 animate-spin" />
            ) : null}
            Continue
          </button>
        </>
      ) : !suggestion.complete ? (
        <div className="rounded-xl border border-[#ead9ae] bg-[#fffdf7] p-4">
          <p className="text-[11px] font-bold uppercase tracking-[.1em] text-[#8c641f]">
            Opryn needs a little more detail
          </p>
          <p className="mt-2 text-sm leading-6 text-[#6f6248]">
            These details keep an incomplete answer from becoming company
            policy.
          </p>
          <div className="mt-4 space-y-4">
            {suggestion.clarificationQuestions.map((question) => (
              <label
                key={question}
                className="block text-sm font-semibold text-[#3d495b]"
              >
                {question}
                <input
                  value={clarifications[question] || ""}
                  onChange={(event) =>
                    setClarifications((current) => ({
                      ...current,
                      [question]: event.target.value,
                    }))
                  }
                  className="mt-2 h-11 w-full rounded-xl border border-[#d8e0e9] bg-white px-3 text-sm font-normal outline-none focus:border-[#7190ee]"
                />
              </label>
            ))}
          </div>
          <button
            disabled={
              loading ||
              suggestion.clarificationQuestions.some(
                (question) => !clarifications[question]?.trim(),
              )
            }
            onClick={() => void prepare()}
            className="mt-4 inline-flex min-h-10 items-center rounded-lg bg-[#3158d8] px-4 text-xs font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Checking answer…" : "Continue"}
          </button>
          {error ? (
            <p className="mt-2 text-xs text-[#a83f49]">{error}</p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-[#cdd9fa] bg-[#f5f7ff] p-4">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.1em] text-[#3158d8]">
            <CheckCircle2 className="size-4" />
            Want Opryn to remember this?
          </p>
          {editing ? (
            <>
              <input
                value={suggestion.title}
                onChange={(event) =>
                  setSuggestion({ ...suggestion, title: event.target.value })
                }
                className="mt-3 h-9 w-full rounded-lg border border-[#d4dce8] px-3 text-sm font-semibold"
              />
              <textarea
                value={suggestion.rule}
                onChange={(event) =>
                  setSuggestion({ ...suggestion, rule: event.target.value })
                }
                rows={3}
                className="mt-2 w-full rounded-lg border border-[#d4dce8] p-3 text-sm leading-5"
              />
            </>
          ) : (
            <div className="mt-3 rounded-xl border border-[#d4dce8] bg-white p-3">
              <p className="text-sm font-semibold">{suggestion.title}</p>
              <p className="mt-1 text-sm leading-6 text-[#536176]">
                {suggestion.rule}
              </p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestion.canApprove ? (
              <button
                disabled={loading}
                onClick={() => void resolve("approve")}
                className="rounded-lg bg-[#3158d8] px-3.5 py-2 text-xs font-semibold text-white"
              >
                Remember It
              </button>
            ) : (
              <button
                disabled={loading}
                onClick={() => void resolve("request_approval")}
                className="rounded-lg bg-[#3158d8] px-3.5 py-2 text-xs font-semibold text-white"
              >
                Send for owner approval
              </button>
            )}
            <button
              disabled={loading}
              onClick={() => setEditing((current) => !current)}
              className="rounded-lg border border-[#cbd4e0] bg-white px-3.5 py-2 text-xs font-semibold"
            >
              {editing ? "Done Editing" : "Edit"}
            </button>
            <button
              disabled={loading}
              onClick={() => void resolve("answer_only")}
              className="rounded-lg border border-[#cbd4e0] bg-white px-3.5 py-2 text-xs font-semibold"
            >
              Just Answer
            </button>
          </div>
          {error ? (
            <p className="mt-2 text-xs text-[#a83f49]">{error}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
