"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  ImageIcon,
  LoaderCircle,
  Video,
} from "lucide-react";
import { showAppToast } from "@/lib/client-toast";
import { OprynEmptyState } from "@/components/opryn/opryn-empty-state";
import { OprynMetric } from "@/components/opryn/opryn-metric";
import { TeamIcon } from "@/components/opryn-icons/opryn-icons";

type Person = {
  id: string;
  name: string;
  email: string;
  roleName: string | null;
};
type Assignment = {
  id: string;
  user_id: string;
  process_id: string;
  status: "assigned" | "started" | "completed";
  completed_at: string | null;
};
type Process = {
  id: string;
  title: string;
  summary: string;
  roleNames: string[];
  hasVideo: boolean;
  imageCount: number;
};

export function TrainingManager({
  people,
  processes,
  initialAssignments,
}: {
  people: Person[];
  processes: Process[];
  initialAssignments: Assignment[];
}) {
  const [assignments, setAssignments] =
    useState<Assignment[]>(initialAssignments);
  const [drafts, setDrafts] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(
      processes.map((process) => [
        process.id,
        initialAssignments
          .filter((item) => item.process_id === process.id)
          .map((item) => item.user_id),
      ]),
    ),
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");

  function toggle(processId: string, userId: string) {
    setDrafts((current) => {
      const selected = current[processId] ?? [];
      return {
        ...current,
        [processId]: selected.includes(userId)
          ? selected.filter((id) => id !== userId)
          : [...selected, userId],
      };
    });
  }

  async function save(processId: string) {
    setSaving(processId);
    setError("");
    try {
      const response = await fetch("/api/training/assignments", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ processId, userIds: drafts[processId] ?? [] }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Unable to save training.");
      setAssignments((current) => [
        ...current.filter((item) => item.process_id !== processId),
        ...body.assignments.map((item: Omit<Assignment, "process_id">) => ({
          ...item,
          process_id: processId,
        })),
      ]);
      showAppToast(
        "Learning assigned",
        "The selected teammates can find this process in My Learning.",
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save training.",
      );
    } finally {
      setSaving(null);
    }
  }

  if (!processes.length)
    return (
      <OprynEmptyState
        title="Start with one approved process"
        description="Once a process is approved, assign it to the people who need it and follow their progress here."
        action={
          <Link href="/app/processes/new" className="opryn-action">
            Teach Opryn <ArrowRight className="size-4" />
          </Link>
        }
      />
    );

  const completed = assignments.filter(
    (item) => item.status === "completed",
  ).length;
  const started = assignments.filter(
    (item) => item.status === "started",
  ).length;

  return (
    <div className="space-y-5">
      <section
        aria-label="Learning overview"
        className="learning-summary opryn-surface grid divide-y divide-[var(--opryn-border)] overflow-hidden sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        <OprynMetric label="Assignments" value={assignments.length} />
        <OprynMetric label="In progress" value={started} />
        <OprynMetric label="Completed" value={completed} />
      </section>

      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-[#fff0f1] p-3 text-sm text-[#a83f49]"
        >
          {error}
        </p>
      ) : null}

      <section className="space-y-4">
        {processes.map((process, index) => {
          const selected = drafts[process.id] ?? [];
          const saved = assignments.filter(
            (item) => item.process_id === process.id,
          );
          const unchanged = sameIds(
            selected,
            saved.map((item) => item.user_id),
          );
          return (
            <article
              key={process.id}
              className="opryn-surface overflow-hidden border-l-[3px] border-l-[var(--opryn-blue)]"
            >
              <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,.8fr)_minmax(380px,1.2fr)] lg:p-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {index === 0 && !saved.length ? (
                      <span className="rounded-full bg-[#eaf7f1] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] text-[#177257]">
                        Start here
                      </span>
                    ) : null}
                    {!saved.length && index !== 0 ? (
                      <span className="rounded-full bg-[#eaf7f1] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.08em] text-[#177257]">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <h2 className="mt-3 text-lg font-semibold tracking-[-.025em]">
                    {process.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-[#6c788b]">
                    {process.summary || "Approved company training process"}
                  </p>
                  {process.roleNames.length ? (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {process.roleNames.map((role) => (
                        <span
                          key={role}
                          className="rounded-full bg-[#f1f4f8] px-2.5 py-1 text-[10px] font-semibold text-[#657286]"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {process.hasVideo || process.imageCount ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {process.hasVideo ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#edf2ff] px-2.5 py-1 text-[10px] font-semibold text-[#3158d8]">
                          <Video className="size-3" /> Video included
                        </span>
                      ) : null}
                      {process.imageCount ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#f1f4f8] px-2.5 py-1 text-[10px] font-semibold text-[#657286]">
                          <ImageIcon className="size-3" /> {process.imageCount}{" "}
                          {process.imageCount === 1 ? "image" : "images"}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  <Link
                    href={`/app/processes/${process.id}`}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-[#3158d8]"
                  >
                    Review process &amp; media{" "}
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
                <div className="border-t border-[var(--opryn-border)] bg-[var(--opryn-soft-blue)] p-4 lg:border-l lg:border-t-0">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-[#37465c]">
                        Assign teammates
                      </p>
                      <p className="mt-1 text-[11px] text-[#7a8698]">
                        {selected.length} selected ·{" "}
                        {
                          saved.filter((item) => item.status === "completed")
                            .length
                        }{" "}
                        complete
                      </p>
                    </div>
                    <TeamIcon className="size-4 text-[var(--opryn-muted)]" />
                  </div>
                  {!people.length ? (
                    <p className="mt-4 rounded-lg bg-white p-3 text-xs leading-5 text-[#718095]">
                      Invite a teammate before assigning this training.
                    </p>
                  ) : (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {people.map((person) => {
                        const checked = selected.includes(person.id);
                        const status = saved.find(
                          (item) => item.user_id === person.id,
                        )?.status;
                        return (
                          <button
                            type="button"
                            key={person.id}
                            onClick={() => toggle(process.id, person.id)}
                            aria-pressed={checked}
                            className={`flex min-h-14 items-center gap-3 rounded-xl border p-2.5 text-left transition ${checked ? "border-[#a7d8c8] bg-[#eff9f5]" : "border-[#e1e6ed] bg-white hover:border-[#b9c5d5]"}`}
                          >
                            <span
                              className={`grid size-7 shrink-0 place-items-center rounded-lg ${checked ? "bg-[#208063] text-white" : "bg-[#eef1f5] text-[#8390a2]"}`}
                            >
                              {checked ? (
                                <Check className="size-3.5" />
                              ) : (
                                person.name.slice(0, 1).toUpperCase()
                              )}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-xs font-semibold">
                                {person.name}
                              </span>
                              <span className="block truncate text-[10px] capitalize text-[#7a8698]">
                                {status ?? person.roleName ?? "Not assigned"}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={saving === process.id || unchanged}
                    onClick={() => void save(process.id)}
                    className="opryn-action mt-4 w-full text-xs disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {saving === process.id ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : null}
                    {saving === process.id ? "Saving…" : "Save assignments"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}

function sameIds(left: string[], right: string[]) {
  if (left.length !== right.length) return false;
  const values = new Set(left);
  return right.every((id) => values.has(id));
}
