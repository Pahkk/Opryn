"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { showAppToast } from "@/lib/client-toast";
import { WorkspaceNotice } from "@/components/app/workspace-context";
import { KnowledgeClassification } from "./knowledge-classification";
import type { KnowledgeCategory } from "@/lib/knowledge-library";

type Step = { id?: string; title: string; description: string };
type Rule = {
  id?: string;
  title: string;
  text: string;
  confidence?: number | null;
};
type Clarification = {
  id: string;
  question: string;
  answer: string;
  suggestedRule: string;
};
type ProcessData = {
  libraryCategory?: KnowledgeCategory;
  libraryTags?: string[];
  libraryRevision?: number;
  id: string;
  title: string;
  summary: string;
  purpose: string;
  status: string;
  roleId: string | null;
  expertId: string | null;
  criticality: "normal" | "critical";
  steps: Step[];
  rules: Rule[];
  exceptions: Array<{ text: string }>;
  clarifications: Clarification[];
};

export function ProcessReview({
  initial,
  returnTo,
  roleOptions,
  expertOptions,
  nextReview,
  onApproved,
}: {
  initial: ProcessData;
  returnTo: string;
  roleOptions: Array<{ id: string; label: string }>;
  expertOptions: Array<{ id: string; label: string }>;
  nextReview?: { id: string; title: string } | null;
  onApproved?: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [saving, setSaving] = useState<"save" | "approve" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const [approved, setApproved] = useState(false);
  async function save() {
    if (inFlight.current) return false;
    inFlight.current = true;
    setSaving("save");
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/processes/${data.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "Unable to save.");
        return false;
      }
      setMessage("Draft saved");
      router.refresh();
      return true;
    } catch {
      setError(
        "Your changes couldn't be saved. Check your connection and try again.",
      );
      return false;
    } finally {
      inFlight.current = false;
      setSaving(null);
    }
  }
  async function approve() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSaving("approve");
    setError("");
    setMessage("");
    try {
      const saved = await fetch(`/api/processes/${data.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const savedBody = await saved.json().catch(() => ({}));
      if (!saved.ok) {
        setError(savedBody.error ?? "Unable to save.");
        return;
      }
      const response = await fetch(`/api/processes/${data.id}/approve`, {
        method: "POST",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "Unable to approve.");
        return;
      }
      showAppToast(
        "Process approved!",
        "Your team can now use it when they ask Opryn questions.",
      );
      setApproved(true);
      onApproved?.();
      router.refresh();
    } catch {
      setError(
        "Opryn couldn't finish approval. Your changes are still here; please try again.",
      );
    } finally {
      inFlight.current = false;
      setSaving(null);
    }
  }
  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= data.steps.length) return;
    const steps = [...data.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    setData({ ...data, steps });
  }
  if (approved)
    return (
      <section
        role="status"
        className="rounded-2xl border border-[#d4e3f6] bg-[#f3f7ff] p-7"
      >
        <h2 className="text-xl font-semibold text-[#17345f]">Approved</h2>
        <p className="mt-2 text-sm text-[#52627a]">
          Your team and connected AI can use this process now.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {nextReview ? (
            <Link
              href={`/app/processes/${nextReview.id}?review=true&returnTo=%2Fapp%2Fprocesses`}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#245fc9] px-5 text-sm font-semibold text-white"
            >
              Review Next: {nextReview.title}
            </Link>
          ) : null}
          <Link
            href={returnTo}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#cbd8e8] bg-white px-5 text-sm font-semibold text-[#245fc9]"
          >
            Back to Knowledge
          </Link>
        </div>
      </section>
    );
  return (
    <fieldset
      disabled={Boolean(saving)}
      aria-busy={Boolean(saving)}
      className="process-review min-w-0 space-y-5"
    >
      {initial.libraryRevision && (
        <KnowledgeClassification
          id={initial.id}
          initialCategory={initial.libraryCategory || "uncategorized"}
          initialTags={initial.libraryTags || []}
          initialRevision={initial.libraryRevision}
        />
      )}
      <section className="rounded-2xl border border-[#dfe5ed] bg-white p-5 sm:p-7">
        <p className="text-xs font-bold uppercase tracking-[.12em] text-[#3158d8]">
          Opryn learned this process
        </p>
        <label className="mt-4 block text-xs font-semibold text-[#667184]">
          Title
          <input
            value={data.title}
            onChange={(event) =>
              setData({ ...data, title: event.target.value })
            }
            className="mt-2 h-12 w-full rounded-xl border border-[#d9e0e9] px-3.5 text-lg font-semibold outline-none focus:border-[#7190ee]"
          />
        </label>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <TextArea
            label="Summary"
            value={data.summary}
            onChange={(summary) => setData({ ...data, summary })}
          />
          <TextArea
            label="Purpose"
            value={data.purpose}
            onChange={(purpose) => setData({ ...data, purpose })}
          />
        </div>
        <div className="mt-5 grid gap-4 border-t border-[#edf0f4] pt-5 sm:grid-cols-3">
          <label className="text-xs font-semibold text-[#667184]">
            Team role
            <select
              value={data.roleId ?? ""}
              onChange={(event) =>
                setData({ ...data, roleId: event.target.value || null })
              }
              className="mt-2 h-12 w-full rounded-xl border border-[#d9e0e9] bg-white px-3 text-base outline-none focus:border-[#7190ee] sm:text-sm"
            >
              <option value="">All roles</option>
              {roleOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[#667184]">
            Expert
            <select
              value={data.expertId ?? ""}
              onChange={(event) =>
                setData({ ...data, expertId: event.target.value || null })
              }
              className="mt-2 h-12 w-full rounded-xl border border-[#d9e0e9] bg-white px-3 text-base outline-none focus:border-[#7190ee] sm:text-sm"
            >
              <option value="">No expert assigned</option>
              {expertOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-h-12 items-center gap-3 self-end rounded-xl border border-[#d9e0e9] px-3.5 text-sm font-semibold text-[#52627a]">
            <input
              type="checkbox"
              checked={data.criticality === "critical"}
              onChange={(event) =>
                setData({
                  ...data,
                  criticality: event.target.checked ? "critical" : "normal",
                })
              }
              className="size-5 accent-[#3158d8]"
            />
            Critical knowledge
          </label>
        </div>
      </section>
      <section className="rounded-2xl border border-[#dfe5ed] bg-white p-5 sm:p-7">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Steps</h2>
            <p className="mt-1 text-xs text-[#7a8698]">
              Put the work in the order an employee should follow.
            </p>
          </div>
          <button
            onClick={() =>
              setData({
                ...data,
                steps: [...data.steps, { title: "", description: "" }],
              })
            }
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#f0f3f7] px-3 py-2 text-xs font-semibold"
          >
            <Plus className="size-3.5" />
            Add step
          </button>
        </div>
        <div className="mt-5 space-y-3">
          {data.steps.map((step, index) => (
            <div
              key={step.id ?? `new-${index}`}
              id={step.id ? `step-${step.id}` : undefined}
              className="grid scroll-mt-28 gap-3 rounded-xl border border-[#e2e7ed] p-4 target:border-[#3158d8] target:bg-[#f4f7ff] target:ring-4 target:ring-[#3158d8]/10 sm:grid-cols-[34px_1fr_auto]"
            >
              <span className="grid size-8 place-items-center rounded-lg bg-[#edf2ff] text-xs font-bold text-[#3158d8]">
                {index + 1}
              </span>
              <div className="min-w-0 space-y-2">
                <input
                  aria-label={`Step ${index + 1} title`}
                  value={step.title}
                  onChange={(event) => {
                    const steps = [...data.steps];
                    steps[index] = { ...step, title: event.target.value };
                    setData({ ...data, steps });
                  }}
                  placeholder="Step title"
                  className="h-9 w-full rounded-lg border border-[#dfe5ed] px-3 text-sm font-semibold outline-none focus:border-[#7190ee]"
                />
                <GrowingTextarea
                  aria-label={`Step ${index + 1} description`}
                  value={step.description}
                  onChange={(event) => {
                    const steps = [...data.steps];
                    steps[index] = { ...step, description: event.target.value };
                    setData({ ...data, steps });
                  }}
                  placeholder="What should the employee do?"
                  rows={2}
                  className="w-full overflow-hidden rounded-lg border border-[#dfe5ed] px-3 py-2 text-sm leading-5 outline-none focus:border-[#7190ee]"
                />
              </div>
              <div className="flex gap-1 sm:flex-col">
                <IconButton label="Move up" onClick={() => move(index, -1)}>
                  <ArrowUp className="size-3.5" />
                </IconButton>
                <IconButton label="Move down" onClick={() => move(index, 1)}>
                  <ArrowDown className="size-3.5" />
                </IconButton>
                <IconButton
                  label="Remove step"
                  onClick={() =>
                    setData({
                      ...data,
                      steps: data.steps.filter(
                        (_, itemIndex) => itemIndex !== index,
                      ),
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <EditableList
          title="Company rules"
          items={data.rules}
          add={() =>
            setData({
              ...data,
              rules: [...data.rules, { title: "Company rule", text: "" }],
            })
          }
          render={(rule, index) => (
            <div
              id={rule.id ? `rule-${rule.id}` : undefined}
              className="scroll-mt-28 rounded-xl border border-[#e2e7ed] p-4 target:border-[#3158d8] target:bg-[#f4f7ff] target:ring-4 target:ring-[#3158d8]/10"
            >
              <div className="flex gap-2">
                <input
                  aria-label={`Rule ${index + 1} title`}
                  value={rule.title}
                  onChange={(event) => {
                    const rules = [...data.rules];
                    rules[index] = { ...rule, title: event.target.value };
                    setData({ ...data, rules });
                  }}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-[#dfe5ed] px-3 text-sm font-semibold"
                />
                <IconButton
                  label="Remove rule"
                  onClick={() =>
                    setData({
                      ...data,
                      rules: data.rules.filter((_, i) => i !== index),
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </IconButton>
              </div>
              <GrowingTextarea
                aria-label={`Rule ${index + 1} wording`}
                value={rule.text}
                onChange={(event) => {
                  const rules = [...data.rules];
                  rules[index] = { ...rule, text: event.target.value };
                  setData({ ...data, rules });
                }}
                rows={3}
                className="mt-2 w-full overflow-hidden rounded-lg border border-[#dfe5ed] p-3 text-sm leading-5"
              />
            </div>
          )}
        />
        <EditableList
          title="Exceptions"
          items={data.exceptions}
          add={() =>
            setData({ ...data, exceptions: [...data.exceptions, { text: "" }] })
          }
          render={(item, index) => (
            <div className="flex gap-2 rounded-xl border border-[#e2e7ed] p-4">
              <GrowingTextarea
                aria-label={`Exception ${index + 1}`}
                value={item.text}
                onChange={(event) => {
                  const exceptions = [...data.exceptions];
                  exceptions[index] = { text: event.target.value };
                  setData({ ...data, exceptions });
                }}
                rows={3}
                className="min-w-0 flex-1 overflow-hidden rounded-lg border border-[#dfe5ed] p-3 text-sm leading-5"
              />
              <IconButton
                label="Remove exception"
                onClick={() =>
                  setData({
                    ...data,
                    exceptions: data.exceptions.filter((_, i) => i !== index),
                  })
                }
              >
                <Trash2 className="size-3.5" />
              </IconButton>
            </div>
          )}
        />
      </section>
      {data.clarifications.length ? (
        <section className="rounded-2xl border border-[#e7d8ae] bg-[#fffdf7] p-5 sm:p-7">
          <h2 className="font-semibold">
            Opryn has {data.clarifications.length}{" "}
            {data.clarifications.length === 1 ? "question" : "questions"}
          </h2>
          <p className="mt-1 text-xs text-[#806e45]">
            Answer what Opryn could not safely infer. Your answers stay in
            review until approval.
          </p>
          <div className="mt-5 space-y-4">
            {data.clarifications.map((item, index) => (
              <div
                key={item.id}
                className="rounded-xl border border-[#eadfbe] bg-white p-4"
              >
                <p className="text-sm font-semibold">{item.question}</p>
                <GrowingTextarea
                  aria-label={item.question}
                  value={item.answer}
                  onChange={(event) => {
                    const clarifications = [...data.clarifications];
                    clarifications[index] = {
                      ...item,
                      answer: event.target.value,
                    };
                    setData({ ...data, clarifications });
                  }}
                  placeholder="Answer in your own words…"
                  rows={3}
                  className="mt-3 w-full overflow-hidden rounded-lg border border-[#dfe5ed] p-3 text-sm"
                />
                <input
                  value={item.suggestedRule}
                  onChange={(event) => {
                    const clarifications = [...data.clarifications];
                    clarifications[index] = {
                      ...item,
                      suggestedRule: event.target.value,
                    };
                    setData({ ...data, clarifications });
                  }}
                  placeholder="Optional reusable rule"
                  className="mt-2 h-10 w-full rounded-lg border border-[#dfe5ed] px-3 text-sm"
                />
              </div>
            ))}
          </div>
        </section>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-[#fff0f1] p-3 text-sm text-[#a83f49]"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="flex items-center gap-2 rounded-xl bg-[#eaf7f1] p-3 text-sm text-[#177257]">
          <Check className="size-4" />
          {message}
        </p>
      ) : null}
      <div
        aria-label="Process review actions"
        className="process-review-actions fixed inset-x-0 z-30 grid grid-cols-2 gap-3 border-t border-[#dfe5ed] bg-white/96 p-3 shadow-[0_-10px_28px_rgba(7,27,61,.08)] backdrop-blur sm:static sm:flex sm:flex-wrap sm:justify-end sm:rounded-2xl sm:border sm:p-4 sm:shadow-none"
      >
        <div className="col-span-2 mr-auto text-sm leading-6 text-[var(--opryn-muted)]">
          <WorkspaceNotice action="Reviewing for" />
          Accept makes this available to people and AI connections with access.
        </div>
        {saving !== "approve" ? (
          <button
            type="button"
            disabled={Boolean(saving)}
            onClick={() => void save()}
            className="min-h-12 rounded-xl border border-[#d5dce6] px-3 text-sm font-semibold disabled:opacity-60 sm:min-h-11 sm:px-5"
          >
            {saving === "save"
              ? "Saving…"
              : data.status === "approved"
                ? "Save Changes"
                : "Save Draft"}
          </button>
        ) : null}
        <button
          type="button"
          disabled={Boolean(saving)}
          onClick={() => void approve()}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#3158d8] px-3 text-sm font-semibold text-white disabled:opacity-60 sm:min-h-11 sm:min-w-40 sm:px-5"
        >
          {saving === "approve"
            ? "Accepting…"
            : data.status === "approved"
              ? "Accept Changes"
              : "Accept Process"}
        </button>
      </div>
    </fieldset>
  );
}
function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-xs font-semibold text-[#667184]">
      {label}
      <GrowingTextarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="mt-2 w-full overflow-hidden rounded-xl border border-[#d9e0e9] p-3.5 text-base leading-6 outline-none focus:border-[#7190ee] sm:text-sm"
      />
    </label>
  );
}

function GrowingTextarea({
  value,
  onChange,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [value]);

  return (
    <textarea
      {...props}
      ref={textareaRef}
      value={value}
      onChange={(event) => {
        event.currentTarget.style.height = "auto";
        event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
        onChange?.(event);
      }}
    />
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-11 shrink-0 place-items-center rounded-lg text-[#59697d] hover:bg-[#f0f3f7] hover:text-[#3158d8]"
    >
      {children}
    </button>
  );
}
function EditableList<T>({
  title,
  items,
  add,
  render,
}: {
  title: string;
  items: T[];
  add: () => void;
  render: (item: T, index: number) => React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#dfe5ed] bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{title}</h2>
        <button
          type="button"
          onClick={add}
          className="grid size-8 place-items-center rounded-lg bg-[#f0f3f7]"
          aria-label={`Add ${title.toLowerCase()}`}
        >
          <Plus className="size-4" />
        </button>
      </div>
      <div className="mt-4 space-y-3">
        {items.length ? (
          items.map(render)
        ) : (
          <p className="rounded-xl bg-[#f8fafc] p-4 text-sm text-[#7a8698]">
            None captured yet.
          </p>
        )}
      </div>
    </section>
  );
}
