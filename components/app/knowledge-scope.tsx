"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  knowledgeScopeSchema,
  scopeDimensions,
  type KnowledgeScope,
} from "@/lib/opryn/knowledge/scope";
import { MotionRegion } from "@/components/motion/motion-region";
const labels: Record<string, string> = {
  roles: "Roles",
  departments: "Departments",
  regions: "Regions",
  locations: "Locations",
  customerTypes: "Customer types",
  plans: "Customer plans",
  products: "Products",
  channels: "Channels",
};
export function KnowledgeScopePanel({
  id,
  entity,
  canManage,
  onRevision,
}: {
  id: string;
  entity: "knowledge" | "proposal";
  canManage: boolean;
  onRevision?: () => void;
}) {
  const router = useRouter();
  const request = useRef<AbortController | null>(null);
  const [value, setValue] = useState<KnowledgeScope | null>(null),
    [fields, setFields] = useState<Record<string, string>>({}),
    [version, setVersion] = useState(0),
    [updatedAt, setUpdatedAt] = useState(""),
    [editing, setEditing] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [proposalId, setProposalId] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/knowledge-scope?entity=${entity}&id=${id}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw Error(data.error || "Scope could not be loaded.");
        if (controller.signal.aborted) return;
        const scope = knowledgeScopeSchema.parse(data.scope);
        setValue(scope);
        setFields(
          Object.fromEntries([
            ...scopeDimensions.map((d) => [d, (scope[d] ?? []).join(", ")]),
            ["effectiveFrom", scope.effectiveFrom ?? ""],
            ["effectiveUntil", scope.effectiveUntil ?? ""],
          ]),
        );
        setVersion(data.version ?? data.current_version);
        setUpdatedAt(data.updated_at ?? "");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      controller.abort();
      request.current?.abort();
    };
  }, [id, entity]);
  async function save() {
    if (request.current) return;
    const draft: Record<string, unknown> = {};
    scopeDimensions.forEach((d) => {
      if (fields[d]?.trim())
        draft[d] = fields[d]
          .split(",")
          .map((v) => v.trim())
          .filter(Boolean);
    });
    for (const d of ["effectiveFrom", "effectiveUntil"])
      if (fields[d]) draft[d] = fields[d];
    const parsed = knowledgeScopeSchema.safeParse(draft);
    if (!parsed.success) {
      setError("Check the scope values and effective dates.");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/knowledge-scope", {
        method: "POST",
        signal: controller.signal,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          entity,
          version,
          updatedAt: updatedAt || undefined,
          scope: parsed.data,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error || "Scope could not be saved.");
      if (controller.signal.aborted) return;
      if (entity === "knowledge") setProposalId(data.proposalId);
      else {
        setValue(parsed.data);
        setVersion(data.version);
        setUpdatedAt(data.updatedAt);
        onRevision?.();
      }
      setEditing(false);
      router.refresh();
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Try again.");
    } finally {
      request.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section
      className="mt-5 border-t border-[#dfe6f0] pt-5"
      aria-label="Knowledge applicability"
    >
      <h3 className="font-semibold">Applies to</h3>
      {value ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {scopeDimensions.flatMap((d) =>
            (value[d] ?? []).map((v) => (
              <span
                key={`${d}-${v}`}
                className="rounded-full bg-[#eaf4ff] px-3 py-1 text-xs"
              >
                {labels[d]}: {v}
              </span>
            )),
          )}
          {!scopeDimensions.some((d) => value[d]?.length) && (
            <p className="text-sm text-[#566279]">Global workspace scope</p>
          )}
          {value.effectiveFrom || value.effectiveUntil ? (
            <p className="w-full text-sm">
              Effective {value.effectiveFrom ?? "any start date"} →{" "}
              {value.effectiveUntil ?? "no end date"}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[#566279]">Loading applicability…</p>
      )}
      {canManage && value && !editing && !proposalId ? (
        <button
          className="opryn-button-secondary mt-3 min-h-11 px-3"
          onClick={() => setEditing(true)}
        >
          Edit applicability
        </button>
      ) : null}
      {editing ? (
        <MotionRegion variant="quiet">
          <p className="mt-3 text-sm text-[#566279]">
            Optional, comma-separated values. Empty means global. Role labels do
            not grant access.{" "}
            {entity === "knowledge"
              ? "This creates a proposal; the current approved version stays active."
              : "Saving changes the proposal revision. Review it again before approval."}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {scopeDimensions.map((d) => (
              <label key={d} className="text-sm">
                {labels[d]}
                <input
                  disabled={busy}
                  value={fields[d] ?? ""}
                  maxLength={2400}
                  onChange={(e) =>
                    setFields((p) => ({ ...p, [d]: e.target.value }))
                  }
                  className="mt-1 min-h-11 w-full rounded-xl border border-[#dfe6f0] px-3"
                />
              </label>
            ))}
            {["effectiveFrom", "effectiveUntil"].map((d) => (
              <label key={d} className="text-sm">
                {d === "effectiveFrom" ? "Effective from" : "Effective until"}
                <input
                  disabled={busy}
                  type="date"
                  value={fields[d] ?? ""}
                  onChange={(e) =>
                    setFields((p) => ({ ...p, [d]: e.target.value }))
                  }
                  className="mt-1 min-h-11 w-full rounded-xl border border-[#dfe6f0] px-3"
                />
              </label>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              disabled={busy}
              onClick={() => void save()}
              className="opryn-action min-h-11"
            >
              {busy
                ? "Saving…"
                : entity === "knowledge"
                  ? "Create scope proposal"
                  : "Save scope"}
            </button>
            <button
              disabled={busy}
              onClick={() => setEditing(false)}
              className="opryn-button-secondary px-3"
            >
              Cancel
            </button>
          </div>
        </MotionRegion>
      ) : null}
      {proposalId ? (
        <p role="status" className="mt-3 text-sm">
          Scope proposal created.{" "}
          <Link
            className="text-[#2855f9] underline"
            href={`/app/needs-you?item=proposal-${proposalId}`}
          >
            Review and approve
          </Link>
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </section>
  );
}
