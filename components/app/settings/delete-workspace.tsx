"use client";

import { useRef, useState } from "react";

export function DeleteWorkspace({
  organizationId,
  name,
}: {
  organizationId: string;
  name: string;
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);
  async function remove(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current || confirmation !== name || !acknowledged) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/settings", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "x-opryn-organization": organizationId,
        },
        body: JSON.stringify({
          organizationId,
          confirmation,
          acknowledged: true,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.deleted)
        throw new Error(
          result.error ||
            "Workspace could not be deleted. Nothing was confirmed deleted.",
        );
      // A full navigation discards workspace-specific React caches.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/app");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not confirm deletion. Check your connection and try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  function cancel() {
    setOpen(false);
    setConfirmation("");
    setAcknowledged(false);
    setError("");
    requestAnimationFrame(() => trigger.current?.focus());
  }
  return (
    <section
      className="mt-8 border-t border-[#d2d8de] pt-6"
      aria-labelledby="delete-workspace-title"
    >
      <h2 id="delete-workspace-title" className="text-lg font-semibold">
        Delete workspace
      </h2>
      <p className="mt-2 text-sm leading-6">
        Permanently remove <strong>{name}</strong> and its Opryn knowledge,
        questions, memberships and workspace records. Your personal account and
        other workspaces stay intact.
      </p>
      <p className="mt-2 text-sm leading-6">
        Opryn will disconnect this workspace’s integrations, delete its uploaded
        files, and cancel its active subscription without a prorated refund.
        Original files in Google and other external services stay unchanged.
      </p>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls="delete-workspace-confirmation"
        className="mt-4 min-h-11 rounded-lg border border-[#b34f58] px-4 text-sm font-semibold text-[#9b303e] focus-visible:outline-2 focus-visible:outline-offset-4"
        onClick={() => setOpen(true)}
        disabled={open}
      >
        Delete workspace
      </button>
      {open && (
        <form
          id="delete-workspace-confirmation"
          onSubmit={remove}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !busy) cancel();
          }}
          className="mt-4 rounded-xl border border-[#dab9be] bg-[#fff8f8] p-5"
        >
          <p className="text-sm leading-6">
            This cannot be undone from Opryn. Sign in within the last 10 minutes
            before confirming.
          </p>
          <label
            className="mt-4 block text-sm font-medium"
            htmlFor="workspace-delete-name"
          >
            Type the workspace name: {name}
          </label>
          <input
            autoComplete="off"
            id="workspace-delete-name"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            disabled={busy}
            className="mt-2 min-h-11 w-full rounded-lg border border-[#c5a7ac] bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2"
          />
          <label className="mt-4 flex items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              className="mt-1 size-4 shrink-0"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
              disabled={busy}
            />
            I understand this permanently deletes this workspace for every
            member.
          </label>
          {error && (
            <p role="alert" className="mt-4 text-sm font-medium text-[#9b303e]">
              {error}
            </p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className="min-h-11 rounded-lg border px-4 text-sm font-semibold"
            >
              Keep workspace
            </button>
            <button
              type="submit"
              disabled={busy || confirmation !== name || !acknowledged}
              className="min-h-11 rounded-lg bg-[#9b303e] px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Checking and deleting…" : "Permanently delete workspace"}
            </button>
          </div>
          <a
            className="mt-4 inline-block text-sm underline"
            href="mailto:usersupport@opryn.app?subject=Workspace%20deletion"
          >
            Get help with deletion
          </a>
        </form>
      )}
    </section>
  );
}
