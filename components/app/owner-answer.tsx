"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { showAppToast } from "@/lib/client-toast";
import { OprynThinkingOrb } from "@/components/motion/opryn-thinking-orb";
export function OwnerAnswer({
  questionId,
  onResolved,
  refreshOnResolved = true,
}: {
  questionId: string;
  refreshOnResolved?: boolean;
  onResolved?: (result: {
    action: "approve" | "answer_only" | "request_approval";
    title: string;
  }) => void;
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [oneTimeException, setOneTimeException] = useState(false);
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
  const [suggesting, setSuggesting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  async function prepare() {
    if (loading) return;
    setLoading(true);
    setSuggesting(!oneTimeException);
    setError("");
    const response = await fetch(`/api/questions/${questionId}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        answer,
        oneTimeException,
        answerId: suggestion?.answerId,
        clarificationAnswers: suggestion?.clarificationQuestions.map(
          (question) => ({
            question,
            answer: clarifications[question] || "",
          }),
        ),
      }),
    }).catch(() => null);
    if (!response) {
      setLoading(false);
      setSuggesting(false);
      setError(
        "Your answer could not be saved. Check your connection and try again.",
      );
      return;
    }
    const body = await response.json().catch(() => null);
    setLoading(false);
    setSuggesting(false);
    if (
      !response.ok ||
      !body ||
      typeof body.answerId !== "string" ||
      typeof body.complete !== "boolean"
    ) {
      setError(body?.error ?? "Unable to confirm your answer. Try again.");
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
    if (!suggestion || loading) return;
    setLoading(true);
    setError("");
    const response = await fetch(`/api/questions/${questionId}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...suggestion, action, oneTimeException }),
    }).catch(() => null);
    if (!response) {
      setLoading(false);
      setError(
        "Your action could not be confirmed. Try again; duplicate submissions are safe.",
      );
      return;
    }
    const body = await response.json().catch(() => null);
    setLoading(false);
    if (!response.ok || !body?.ok) {
      setError(body?.error ?? "Unable to finish.");
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
    onResolved?.({ action, title: suggestion.title });
    if (refreshOnResolved) router.refresh();
  }
  return (
    <div className="mt-4 border-t border-[#e8ecf1] pt-4">
      <p role="status" aria-live="polite" className="sr-only">
        {suggesting ? "Opryn is structuring your answer." : ""}
      </p>
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
          <label className="mt-3 flex items-center gap-2 text-xs text-[#566279]">
            <input
              type="checkbox"
              checked={oneTimeException}
              onChange={(event) => setOneTimeException(event.target.checked)}
            />
            This is a one-time exception, not a reusable company rule.
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
              suggesting ? (
                <OprynThinkingOrb
                  state="solving"
                  size={20}
                  label="Structuring your answer"
                  decorative
                />
              ) : (
                <LoaderCircle className="size-3.5 animate-spin" />
              )
            ) : null}
            {suggesting
              ? "Structuring your answer…"
              : loading
                ? "Saving…"
                : "Continue"}
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
          <button
            disabled={loading}
            onClick={() => void resolve("answer_only")}
            className="ml-2 mt-4 min-h-10 rounded-lg border border-[#cbd4e0] bg-white px-3 text-xs font-semibold"
          >
            Use answer once
          </button>
          {error ? (
            <p className="mt-2 text-xs text-[#a83f49]">{error}</p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-xl border border-[#cdd9fa] bg-[#f5f7ff] p-4">
          <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.1em] text-[#3158d8]">
            <CheckCircle2 className="size-4" />
            {oneTimeException
              ? "One-time answer"
              : "Use once, or make it reusable?"}
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
            {oneTimeException ? (
              <p className="text-xs text-[#566279]">
                This answer stays with this question. It will not enter company
                knowledge.
              </p>
            ) : (
              <button
                disabled={loading}
                onClick={() => void resolve("request_approval")}
                className="rounded-lg bg-[#3158d8] px-3.5 py-2 text-xs font-semibold text-white"
              >
                Create knowledge proposal
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
