"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { SettingsFeedback, SettingsToggle } from "./primitives";
import { useSaveFeedback, useUnsavedChanges } from "./form-state";

export type WorkspaceValues = {
  name: string;
  industry: string;
  employee_count: number;
  description: string;
  default_timezone: string;
  employees_can_ask: boolean;
  allow_escalations: boolean;
  confidence_threshold: number;
  estimated_interruption_minutes: number;
  expert_answers_require_admin_approval: boolean;
  ai_process_creation: "always_ask" | "auto_draft";
  ai_process_approval_prompt: "ask_immediately" | "add_to_needs_approval";
};
export function WorkspaceForm({
  section,
  initial,
  revision: initialRevision,
  organizationId,
  logoUrl,
}: {
  section: "general" | "knowledge";
  initial: WorkspaceValues;
  revision: number;
  organizationId: string;
  logoUrl: string | null;
}) {
  const router = useRouter(),
    busy = useRef(false),
    feedback = useSaveFeedback();
  const [values, setValues] = useState(initial),
    [saved, setSaved] = useState(initial),
    [revision, setRevision] = useState(initialRevision);
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  useUnsavedChanges(dirty);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    feedback.setSaving(true);
    feedback.setError("");
    feedback.setMessage("");
    const changes =
      section === "general"
        ? {
            default_timezone: values.default_timezone,
          }
        : {
            employees_can_ask: values.employees_can_ask,
            allow_escalations: values.allow_escalations,
            confidence_threshold: values.confidence_threshold,
            estimated_interruption_minutes:
              values.estimated_interruption_minutes,
            expert_answers_require_admin_approval:
              values.expert_answers_require_admin_approval,
            ai_process_creation: values.ai_process_creation,
            ai_process_approval_prompt: values.ai_process_approval_prompt,
          };
    try {
      const response = await fetch("/api/settings/workspace", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, revision, changes }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setRevision(body.revision);
      setSaved(values);
      feedback.setMessage("Workspace settings saved.");
      router.refresh();
    } catch (error) {
      feedback.setError(
        error instanceof Error
          ? error.message
          : "Your changes are still here. Check your connection and retry.",
      );
    } finally {
      busy.current = false;
      feedback.setSaving(false);
    }
  }
  return (
    <>
      {section === "general" ? (
        <WorkspaceLogo initialUrl={logoUrl} organizationId={organizationId} />
      ) : null}
      <form onSubmit={save} className="settings-form">
        {section === "general" ? (
          <>
            <p className="settings-preview">
              Company details are managed in one place.{" "}
              <Link className="settings-button" href="/app/settings/company">
                Edit Company Profile →
              </Link>
            </p>
            <label className="settings-field">
              Workspace timezone
              <input
                value={values.default_timezone}
                onChange={(e) =>
                  setValues({ ...values, default_timezone: e.target.value })
                }
              />
              <small>
                Used for workspace activity timestamps unless you choose a
                personal timezone. For example: America/Los_Angeles.
              </small>
            </label>
          </>
        ) : (
          <>
            <section className="settings-preview">
              <strong>Review before publishing</strong>
              <p>
                Imported information and AI-created drafts still require the
                existing approval flow. A job title or expertise assignment
                alone does not grant approval permission.
              </p>
            </section>
            <SettingsToggle
              label="Employees may ask Opryn"
              note="Allow employees to ask questions using knowledge their role can access."
              checked={values.employees_can_ask}
              onChange={(employees_can_ask) =>
                setValues({ ...values, employees_can_ask })
              }
            />
            <SettingsToggle
              label="Escalate unanswered questions"
              note="Let employees route unknown questions to an owner or assigned expert."
              checked={values.allow_escalations}
              onChange={(allow_escalations) =>
                setValues({ ...values, allow_escalations })
              }
            />
            <SettingsToggle
              label="Require admin review of expert answers"
              note="Experts may answer teammates, but their reusable guidance needs owner/admin approval. Turning this off permits explicitly authorized experts to approve guidance in their assigned scope."
              checked={values.expert_answers_require_admin_approval}
              onChange={(expert_answers_require_admin_approval) =>
                setValues({ ...values, expert_answers_require_admin_approval })
              }
            />
            <label className="settings-field">
              When connected AI prepares a process
              <select
                value={values.ai_process_creation}
                onChange={(e) =>
                  setValues({
                    ...values,
                    ai_process_creation: e.target
                      .value as WorkspaceValues["ai_process_creation"],
                  })
                }
              >
                <option value="auto_draft">Create a reviewable draft</option>
                <option value="always_ask">Ask before creating a draft</option>
              </select>
            </label>
            <label className="settings-field">
              Where to review AI-created processes
              <select
                value={values.ai_process_approval_prompt}
                onChange={(e) =>
                  setValues({
                    ...values,
                    ai_process_approval_prompt: e.target
                      .value as WorkspaceValues["ai_process_approval_prompt"],
                  })
                }
              >
                <option value="ask_immediately">
                  Ask me to review immediately
                </option>
                <option value="add_to_needs_approval">
                  Add to Needs Approval
                </option>
              </select>
            </label>
            <details>
              <summary className="min-h-11 cursor-pointer text-sm font-semibold">
                Advanced answer behavior
              </summary>
              <div className="settings-form mt-4">
                <label className="settings-field">
                  Answer confidence threshold
                  <input
                    type="range"
                    min={0.5}
                    max={0.95}
                    step={0.01}
                    value={values.confidence_threshold}
                    onChange={(e) =>
                      setValues({
                        ...values,
                        confidence_threshold: Number(e.target.value),
                      })
                    }
                  />
                  <small>
                    Higher values ask for guidance more often when an answer is
                    uncertain. Current threshold:{" "}
                    {values.confidence_threshold.toFixed(2)}.
                  </small>
                </label>
                <label className="settings-field">
                  Estimated minutes per avoided interruption
                  <input
                    type="number"
                    min={0.5}
                    max={30}
                    step={0.5}
                    value={values.estimated_interruption_minutes}
                    onChange={(e) =>
                      setValues({
                        ...values,
                        estimated_interruption_minutes: Number(e.target.value),
                      })
                    }
                  />
                  <small>
                    Used for the time-returned estimate, not a measured
                    productivity score.
                  </small>
                </label>
              </div>
            </details>
          </>
        )}
        <SettingsFeedback error={feedback.error} message={feedback.message} />
        <div className="settings-actions">
          <button
            className="settings-button primary"
            disabled={!dirty || feedback.saving}
          >
            {feedback.saving ? "Saving…" : "Save changes"}
          </button>
          {dirty ? (
            <span className="text-xs text-[var(--opryn-muted)]">
              Unsaved changes · {initial.name}
            </span>
          ) : null}
        </div>
      </form>
    </>
  );
}
function WorkspaceLogo({
  initialUrl,
  organizationId,
}: {
  initialUrl: string | null;
  organizationId: string;
}) {
  const [url, setUrl] = useState(initialUrl);
  const input = useRef<HTMLInputElement>(null),
    feedback = useSaveFeedback(),
    router = useRouter();
  async function update(file?: File) {
    if (feedback.saving) return;
    if (
      file &&
      (file.size > 3 * 1024 * 1024 ||
        !["image/png", "image/jpeg", "image/webp"].includes(file.type))
    ) {
      feedback.setError("Choose a PNG, JPEG, or WebP image under 3 MB.");
      return;
    }
    feedback.setSaving(true);
    feedback.setError("");
    feedback.setMessage("");
    try {
      const form = new FormData();
      if (file) form.set("logo", file);
      form.set("organizationId", organizationId);
      const response = await fetch("/api/settings/logo", {
        method: file ? "POST" : "DELETE",
        headers: { "x-opryn-organization": organizationId },
        ...(file ? { body: form } : {}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setUrl(body.logoUrl ?? null);
      feedback.setMessage(
        file ? "Workspace logo saved." : "Workspace logo removed.",
      );
      router.refresh();
    } catch (error) {
      feedback.setError(
        error instanceof Error
          ? error.message
          : "Logo could not be saved. Please retry.",
      );
    } finally {
      feedback.setSaving(false);
    }
  }
  return (
    <section className="settings-section">
      <div className="settings-avatar-row">
        {url ? (
          <Image
            src={url}
            alt="Workspace logo"
            width={64}
            height={64}
            unoptimized
            className="rounded-lg object-contain"
          />
        ) : null}
        <div>
          <h3>Workspace logo</h3>
          <p>PNG, JPEG, or WebP. Up to 3 MB.</p>
          <div className="settings-actions">
            <button
              disabled={feedback.saving}
              className="settings-button"
              onClick={() => input.current?.click()}
            >
              {url ? "Replace logo" : "Upload logo"}
            </button>
            {url ? (
              <button
                className="settings-button"
                disabled={feedback.saving}
                onClick={() => void update()}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <input
        ref={input}
        className="sr-only"
        aria-label="Choose workspace logo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void update(file);
        }}
      />
      <SettingsFeedback error={feedback.error} message={feedback.message} />
    </section>
  );
}
