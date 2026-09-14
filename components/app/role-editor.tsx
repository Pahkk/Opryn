"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Plus, Trash2 } from "lucide-react";
type Props = {
  role: {
    id: string;
    name: string;
    description: string;
    responsibilities: {
      every_morning: string[];
      every_customer: string[];
      requires_approval: string[];
    };
  };
  processes: Array<{ id: string; title: string }>;
  assigned: string[];
};
export function RoleEditor({ role, processes, assigned }: Props) {
  const router = useRouter();
  const [data, setData] = useState({ ...role, processIds: assigned });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    const cleaned = {
      ...data,
      responsibilities: {
        every_morning: data.responsibilities.every_morning.filter((item) =>
          item.trim(),
        ),
        every_customer: data.responsibilities.every_customer.filter((item) =>
          item.trim(),
        ),
        requires_approval: data.responsibilities.requires_approval.filter(
          (item) => item.trim(),
        ),
      },
    };
    try {
      const response = await fetch(`/api/roles/${role.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cleaned),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to save role.");
      setData(cleaned);
      setMessage("Role and knowledge access saved.");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to save role.",
      );
    } finally {
      setSaving(false);
    }
  }
  function update(
    section: keyof Props["role"]["responsibilities"],
    index: number,
    value: string,
  ) {
    const responsibilities = {
      ...data.responsibilities,
      [section]: data.responsibilities[section].map((item, i) =>
        i === index ? value : item,
      ),
    };
    setData({ ...data, responsibilities });
  }
  function add(section: keyof Props["role"]["responsibilities"]) {
    setData({
      ...data,
      responsibilities: {
        ...data.responsibilities,
        [section]: [...data.responsibilities[section], ""],
      },
    });
  }
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#dfe5ed] bg-white p-5 sm:p-7">
        <label className="block text-xs font-semibold text-[#667184]">
          Role name
          <input
            value={data.name}
            onChange={(e) => setData({ ...data, name: e.target.value })}
            className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] px-3.5 text-lg font-semibold"
          />
        </label>
        <label className="mt-5 block text-xs font-semibold text-[#667184]">
          Description
          <textarea
            value={data.description}
            onChange={(e) => setData({ ...data, description: e.target.value })}
            rows={3}
            className="mt-2 w-full rounded-xl border border-[#d9e0e9] p-3.5 text-sm"
          />
        </label>
      </section>
      <div className="grid gap-5 xl:grid-cols-3">
        <Responsibility
          title="Core Responsibilities"
          note="The main work this person owns as part of their job."
          placeholder="Example: Answer new customer calls"
          items={data.responsibilities.every_customer}
          add={() => add("every_customer")}
          update={(i, v) => update("every_customer", i, v)}
          remove={(i) =>
            setData({
              ...data,
              responsibilities: {
                ...data.responsibilities,
                every_customer: data.responsibilities.every_customer.filter(
                  (_, x) => x !== i,
                ),
              },
            })
          }
        />
        <Responsibility
          title="Recurring Tasks"
          note="Work they repeat on a schedule—daily, weekly, or monthly."
          placeholder="Example: Review today's appointments"
          items={data.responsibilities.every_morning}
          add={() => add("every_morning")}
          update={(i, v) => update("every_morning", i, v)}
          remove={(i) =>
            setData({
              ...data,
              responsibilities: {
                ...data.responsibilities,
                every_morning: data.responsibilities.every_morning.filter(
                  (_, x) => x !== i,
                ),
              },
            })
          }
        />
        <Responsibility
          title="Approval Boundaries"
          note="Decisions this person must send to an owner or manager."
          placeholder="Example: Refund over $250"
          items={data.responsibilities.requires_approval}
          add={() => add("requires_approval")}
          update={(i, v) => update("requires_approval", i, v)}
          remove={(i) =>
            setData({
              ...data,
              responsibilities: {
                ...data.responsibilities,
                requires_approval:
                  data.responsibilities.requires_approval.filter(
                    (_, x) => x !== i,
                  ),
              },
            })
          }
        />
      </div>
      <section className="rounded-2xl border border-[#dfe5ed] bg-white p-5 sm:p-7">
        <h2 className="font-semibold">Assigned processes</h2>
        <p className="mt-1 text-xs text-[#7a8698]">
          Employees in this role can access these approved processes.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {processes.map((process) => (
            <label
              key={process.id}
              className="flex items-center gap-3 rounded-xl border border-[#e1e6ed] p-3 text-sm font-medium"
            >
              <input
                type="checkbox"
                checked={data.processIds.includes(process.id)}
                onChange={(e) =>
                  setData({
                    ...data,
                    processIds: e.target.checked
                      ? [...data.processIds, process.id]
                      : data.processIds.filter((id) => id !== process.id),
                  })
                }
                className="size-4 accent-[#3158d8]"
              />
              {process.title}
            </label>
          ))}
        </div>
      </section>
      {error ? (
        <p className="rounded-xl bg-[#fff0f1] p-3 text-sm text-[#a83f49]">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="flex items-center gap-2 rounded-xl bg-[#eaf7f1] p-3 text-sm text-[#177257]">
          <Check className="size-4" />
          {message}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button
          disabled={saving}
          onClick={() => void save()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#3158d8] px-5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
        >
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {saving ? "Saving…" : "Save Role"}
        </button>
      </div>
    </div>
  );
}
function Responsibility({
  title,
  note,
  placeholder,
  items,
  add,
  update,
  remove,
}: {
  title: string;
  note: string;
  placeholder: string;
  items: string[];
  add: () => void;
  update: (index: number, value: string) => void;
  remove: (index: number) => void;
}) {
  return (
    <section className="rounded-2xl border border-[#dfe5ed] bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-xs leading-5 text-[#7a8698]">{note}</p>
        </div>
        <button
          onClick={add}
          className="grid size-7 place-items-center rounded-lg bg-[#f0f3f7]"
          aria-label={`Add ${title}`}
        >
          <Plus className="size-3.5" />
        </button>
      </div>
      <div className="mt-4 space-y-2">
        {items.map((item, index) => (
          <div key={index} className="flex gap-1">
            <input
              value={item}
              onChange={(e) => update(index, e.target.value)}
              placeholder={placeholder}
              className="h-9 min-w-0 flex-1 rounded-lg border border-[#dfe5ed] px-2.5 text-xs"
            />
            <button
              onClick={() => remove(index)}
              aria-label="Remove"
              className="grid size-9 place-items-center text-[#8a95a5]"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        {!items.length ? (
          <p className="rounded-lg bg-[#f7f9fc] px-3 py-2 text-xs leading-5 text-[#8a95a5]">
            Nothing added yet. Use + to add one.
          </p>
        ) : null}
      </div>
    </section>
  );
}
