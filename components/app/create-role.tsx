"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { showAppToast } from "@/lib/client-toast";
export function CreateRole() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/roles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to create role.");
      showAppToast("Role created!", `${name.trim()} is ready to set up.`);
      setOpen(false);
      setName("");
      setDescription("");
      setSaving(false);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to create role.",
      );
      setSaving(false);
    }
  }
  return (
    <>
      {
        <button
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#3158d8] px-4 text-sm font-semibold text-white"
        >
          <Plus className="size-4" />
          Create Role
        </button>
      }
      {open ? (
        <div
          className="mobile-sheet-overlay fixed inset-0 z-[100] grid place-items-center bg-[#0d1729]/45 p-4 backdrop-blur-sm"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setOpen(false)
          }
        >
          <form
            onSubmit={submit}
            className="mobile-sheet-panel w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="flex justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.1em] text-[#3158d8]">
                  New role
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-.03em]">
                  Who is this role for?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="grid size-9 place-items-center rounded-lg hover:bg-[#f2f4f7]"
              >
                <X className="size-4" />
              </button>
            </div>
            <label className="mt-6 block text-sm font-medium">
              Role name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Customer Service Representative"
                className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] px-3.5"
              />
            </label>
            <label className="mt-4 block text-sm font-medium">
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-2 w-full rounded-xl border border-[#d9e0e9] p-3.5"
              />
            </label>
            {error ? (
              <p className="mt-3 text-sm text-[#a83f49]">{error}</p>
            ) : null}
            <button
              disabled={saving}
              className="mt-5 min-h-11 w-full rounded-xl bg-[#3158d8] text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
            >
              {saving ? "Creating…" : "Create Role"}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
