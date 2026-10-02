"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Context = {
  canReroute: boolean;
  assignedExpertId: string | null;
  people: Array<{ id: string; name: string }>;
  clarifications: Array<{
    id: string;
    message: string;
    reply: string | null;
    status: string;
  }>;
};

export function GapQuestionActions({
  questionId,
  onClose,
}: {
  questionId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [context, setContext] = useState<Context | null>(null);
  const [expertId, setExpertId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/questions/${questionId}/manage`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            data.error || "The question controls could not be loaded.",
          );
        if (!controller.signal.aborted) {
          setContext(data);
          setExpertId(data.assignedExpertId ?? "");
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      });
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, [questionId]);
  async function act(action: "reroute" | "request_clarification" | "dismiss") {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setReceipt("");
    try {
      const response = await fetch(`/api/questions/${questionId}/manage`, {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action, expertId: expertId || null, note }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data)
        throw new Error(
          data?.error || "The question could not be updated. Try again.",
        );
      if (action === "dismiss") onClose();
      else {
        setReceipt(
          action === "reroute"
            ? "Question reassigned. Approval authority is unchanged."
            : "Clarification requested. The asker can reply in Ask Opryn.",
        );
        if (action === "request_clarification")
          setContext((current) =>
            current
              ? {
                  ...current,
                  clarifications: [
                    {
                      id: data.clarificationId,
                      message: note,
                      reply: null,
                      status: "open",
                    },
                    ...current.clarifications,
                  ],
                }
              : current,
          );
      }
      router.refresh();
    } catch (error) {
      if (!controller.signal.aborted)
        setError(
          error instanceof Error
            ? error.message
            : "The question could not be updated.",
        );
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section
      className="mt-5 border-t border-[var(--opryn-line)] pt-5"
      aria-label="Question routing and context"
    >
      {context?.clarifications.map((item) => (
        <div
          key={item.id}
          className="mb-3 rounded-xl bg-[var(--opryn-sky,#eaf4ff)] p-3 text-sm"
        >
          <p className="font-semibold">
            {item.status === "open"
              ? "Waiting for clarification"
              : "Clarification"}
          </p>
          <p>{item.message}</p>
          {item.reply ? (
            <p className="mt-2">Asker’s context: {item.reply}</p>
          ) : null}
        </div>
      ))}
      {context?.canReroute ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex-1 text-sm">
            Assigned to
            <select
              aria-label="Assigned to"
              disabled={busy}
              value={expertId}
              onChange={(event) => setExpertId(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-[var(--opryn-line)] bg-white px-3"
            >
              <option value="">Workspace owners/admins</option>
              {context.people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy}
            onClick={() => void act("reroute")}
            className="opryn-button-secondary min-h-11 px-3"
          >
            Reassign
          </button>
        </div>
      ) : null}
      {context ? (
        <>
          <label className="mt-4 block text-sm">
            Missing context or dismissal reason
            <textarea
              disabled={busy}
              value={note}
              maxLength={2000}
              onChange={(event) => setNote(event.target.value)}
              className="mt-2 min-h-20 w-full rounded-xl border border-[var(--opryn-line)] p-3"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              disabled={
                busy ||
                note.trim().length < 3 ||
                context.clarifications.some((item) => item.status === "open")
              }
              onClick={() => void act("request_clarification")}
              className="opryn-button-secondary min-h-11 px-3"
            >
              Ask for clarification
            </button>
            <button
              disabled={busy || note.trim().length < 3}
              onClick={() => void act("dismiss")}
              className="min-h-11 rounded-xl px-3 text-sm text-[var(--opryn-muted)]"
            >
              Dismiss question
            </button>
          </div>
        </>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <p
        role="status"
        aria-live="polite"
        className="mt-3 text-sm text-[var(--opryn-muted)]"
      >
        {busy ? "Saving…" : receipt}
      </p>
    </section>
  );
}

export function ClarificationReplies({
  items,
}: {
  items: Array<{
    id: string;
    questionId: string;
    question: string;
    message: string;
  }>;
}) {
  const router = useRouter();
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  useEffect(() => () => active.current?.abort(), []);
  async function reply(item: (typeof items)[number]) {
    if (active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(item.id);
    setError("");
    try {
      const response = await fetch(`/api/questions/${item.questionId}/manage`, {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "reply",
          note: replies[item.id],
          clarificationId: item.id,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data)
        throw new Error(data?.error || "Your context could not be saved.");
      setDone((current) => ({ ...current, [item.id]: true }));
      router.refresh();
    } catch (error) {
      if (!controller.signal.aborted)
        setError(error instanceof Error ? error.message : "Try again.");
    } finally {
      active.current = null;
      if (!controller.signal.aborted) setBusy(null);
    }
  }
  if (!items.length) return null;
  return (
    <section
      aria-label="Questions needing your context"
      className="mb-5 space-y-3"
    >
      {items
        .filter((item) => !done[item.id])
        .map((item) => (
          <form
            key={item.id}
            onSubmit={(event) => {
              event.preventDefault();
              void reply(item);
            }}
            className="rounded-2xl border border-[var(--opryn-line)] bg-[#eaf4ff] p-4"
          >
            <h2 className="font-semibold">More context is needed</h2>
            <p className="mt-1 text-sm">Your question: {item.question}</p>
            <label className="mt-3 block text-sm">
              {item.message}
              <textarea
                value={replies[item.id] ?? ""}
                maxLength={4000}
                onChange={(event) =>
                  setReplies((current) => ({
                    ...current,
                    [item.id]: event.target.value,
                  }))
                }
                className="mt-2 min-h-20 w-full rounded-xl border border-[var(--opryn-line)] bg-white p-3"
              />
            </label>
            <button
              disabled={!!busy || (replies[item.id]?.trim().length ?? 0) < 3}
              className="opryn-action mt-3 min-h-11"
            >
              {busy === item.id ? "Saving…" : "Send context"}
            </button>
          </form>
        ))}
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {Object.keys(done).length ? (
        <p role="status" className="text-sm text-[var(--opryn-muted)]">
          Your context was sent for a human answer. It is not approved company
          knowledge.
        </p>
      ) : null}
    </section>
  );
}
