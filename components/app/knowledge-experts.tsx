"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { showAppToast } from "@/lib/client-toast";

type Person = { id: string; name: string };
type Expert = {
  id: string;
  userId: string;
  name: string;
  category: string;
  canApprove: boolean;
};

export function KnowledgeExperts({
  people,
  experts,
}: {
  people: Person[];
  experts: Expert[];
}) {
  const router = useRouter();
  const [userId, setUserId] = useState(people[0]?.id ?? "");
  const [category, setCategory] = useState("");
  const [canApprove, setCanApprove] = useState(false);
  const [busy, setBusy] = useState(false);

  async function add(event: FormEvent) {
    event.preventDefault();
    if (!userId || !category.trim()) return;
    setBusy(true);
    const response = await fetch("/api/team/experts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, category, canApprove }),
    });
    setBusy(false);
    if (!response.ok) return;
    setCategory("");
    setCanApprove(false);
    showAppToast(
      "Company expert assigned.",
      "Opryn can route matching questions to the right person.",
    );
    router.refresh();
  }

  async function remove(id: string) {
    const response = await fetch("/api/team/experts", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (response.ok) router.refresh();
  }

  return (
    <section
      data-guide="team.experts"
      className="mt-6 rounded-2xl border border-[#dfe5ed] bg-white p-5 sm:p-6"
    >
      <div className="max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-[.1em] text-[#3158d8]">
          Company experts
        </p>
        <h2 className="mt-1 text-xl font-semibold">
          Send questions to the person who knows.
        </h2>
        <p className="mt-2 text-sm leading-6 text-[#718095]">
          Choose a knowledge area such as Refunds, Warranty, or Vendor
          Purchasing. Opryn asks that expert before interrupting the owner.
        </p>
      </div>
      {experts.length ? (
        <div className="mt-5 divide-y divide-[#e8ecf1] border-y border-[#e8ecf1]">
          {experts.map((expert) => (
            <div
              key={expert.id}
              className="flex flex-wrap items-center gap-3 py-3.5 text-sm"
            >
              <strong className="min-w-40">{expert.category}</strong>
              <span className="text-[#657286]">{expert.name}</span>
              {expert.canApprove ? (
                <span className="text-xs font-medium text-[#177257]">
                  Can approve answers
                </span>
              ) : null}
              <button
                type="button"
                onClick={() => void remove(expert.id)}
                className="ml-auto min-h-9 px-2 text-xs font-semibold text-[#8a4650]"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 rounded-xl bg-[#f7f9fc] p-4 text-sm text-[#718095]">
          No knowledge experts assigned yet.
        </p>
      )}
      {people.length ? (
        <form
          onSubmit={(event) => void add(event)}
          className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_auto] lg:items-end"
        >
          <label className="text-xs font-semibold text-[#657286]">
            Teammate
            <select
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
              className="mt-2 h-11 w-full rounded-xl border border-[#d8e0e9] bg-white px-3 text-sm"
            >
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold text-[#657286]">
            Knowledge area
            <input
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Example: Refunds"
              className="mt-2 h-11 w-full rounded-xl border border-[#d8e0e9] px-3 text-sm"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex min-h-11 items-center gap-2 text-xs font-medium text-[#657286]">
              <input
                type="checkbox"
                checked={canApprove}
                onChange={(event) => setCanApprove(event.target.checked)}
              />
              May approve reusable answers
            </label>
            <button
              disabled={busy || !category.trim()}
              className="min-h-11 rounded-xl bg-[#3158d8] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Saving…" : "Assign Expert"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
