"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import type { AccountSettings } from "@/lib/account-settings";
import { createClient } from "@/lib/supabase/client";
import { DialogSurface } from "@/components/app/dialog-surface";
import { SettingsFeedback, SettingsToggle } from "./primitives";
import { useSaveFeedback, useUnsavedChanges } from "./form-state";

export function AccountForm({
  section,
  initial,
  fullName,
  email,
  emailVerified,
  avatarUrl,
  workspace,
  permission,
  jobTitle,
}: {
  section: "profile" | "preferences" | "notifications";
  initial: AccountSettings;
  fullName: string;
  email: string;
  emailVerified: boolean;
  avatarUrl: string | null;
  workspace: string;
  permission: string;
  jobTitle: string | null;
}) {
  const router = useRouter();
  const feedback = useSaveFeedback();
  const busy = useRef(false);
  const initialValues = {
    ...initial,
    display_name: initial.display_name ?? fullName,
  };
  const [saved, setSaved] = useState(initialValues),
    [values, setValues] = useState(initialValues),
    [revision, setRevision] = useState(initial.revision);
  const dirty = JSON.stringify(saved) !== JSON.stringify(values);
  useUnsavedChanges(dirty);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    feedback.setSaving(true);
    feedback.setError("");
    feedback.setMessage("");
    const changes =
      section === "profile"
        ? { display_name: values.display_name }
        : section === "preferences"
          ? {
              timezone: values.timezone,
              locale: values.locale,
              density: values.density,
              motion: values.motion,
            }
          : {
              notify_questions: values.notify_questions,
              notify_reviews: values.notify_reviews,
              notify_answers: values.notify_answers,
            };
    try {
      const response = await fetch("/api/account", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revision, changes }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to save.");
      setRevision(body.settings.revision);
      setSaved(values);
      feedback.setMessage("Your changes are saved.");
      router.refresh();
    } catch (error) {
      feedback.setError(
        error instanceof Error
          ? error.message
          : "Your changes are still here. Check your connection and try again.",
      );
    } finally {
      busy.current = false;
      feedback.setSaving(false);
    }
  }
  return (
    <>
      {section === "profile" ? (
        <AvatarEditor
          initialUrl={avatarUrl}
          name={values.display_name}
          revision={revision}
          onSaved={setRevision}
          disabled={feedback.saving}
        />
      ) : null}
      <form className="settings-form" onSubmit={save}>
        {section === "profile" ? (
          <>
            <label className="settings-field">
              Display name
              <input
                aria-label="Display name"
                autoComplete="name"
                value={values.display_name}
                required
                maxLength={120}
                onChange={(e) =>
                  setValues({ ...values, display_name: e.target.value })
                }
              />
              <small>
                Used on your expert responses and reviews. This does not change
                your permissions.
              </small>
            </label>
            <div className="settings-row">
              <span>
                <strong>Account email</strong>
                <small>{email}</small>
              </span>
              <span className="text-xs">
                {emailVerified ? "Verified" : "Not verified"}
              </span>
            </div>
            <dl className="settings-dl">
              <dt>Current workspace</dt>
              <dd>{workspace}</dd>
              <dt>Access role</dt>
              <dd className="capitalize">{permission}</dd>
              <dt>Job role</dt>
              <dd>{jobTitle || "Not assigned"}</dd>
            </dl>
            <Link className="settings-quiet-link" href="/app/settings/security">
              Manage sign-in & security <ArrowRight size={16} />
            </Link>
          </>
        ) : null}
        {section === "preferences" ? (
          <>
            <div className="settings-form-grid">
              <label className="settings-field">
                Timezone
                <input
                  aria-label="Timezone"
                  list="account-timezones"
                  value={values.timezone}
                  onChange={(e) =>
                    setValues({ ...values, timezone: e.target.value })
                  }
                />
                <datalist id="account-timezones">
                  {[
                    "UTC",
                    "America/Los_Angeles",
                    "America/New_York",
                    "America/Chicago",
                    "Europe/London",
                    "Europe/Paris",
                    "Asia/Tokyo",
                    "Asia/Kolkata",
                    "Australia/Sydney",
                  ].map((zone) => (
                    <option key={zone} value={zone} />
                  ))}
                </datalist>
                <small>
                  Used for dated activity in Settings and your account preview.
                </small>
              </label>
              <label className="settings-field">
                Date & number format
                <select
                  aria-label="Date & number format"
                  value={values.locale}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      locale: e.target.value as AccountSettings["locale"],
                    })
                  }
                >
                  {["en-US", "en-GB", "en-CA", "en-AU"].map((locale) => (
                    <option key={locale} value={locale}>
                      {locale === "en-US"
                        ? "United States"
                        : locale === "en-GB"
                          ? "United Kingdom"
                          : locale === "en-CA"
                            ? "Canada"
                            : "Australia"}
                    </option>
                  ))}
                </select>
                <small>The interface language remains English.</small>
              </label>
            </div>
            <label className="settings-field">
              Information density
              <select
                aria-label="Information density"
                value={values.density}
                onChange={(e) =>
                  setValues({
                    ...values,
                    density: e.target.value as AccountSettings["density"],
                  })
                }
              >
                <option value="comfortable">Comfortable</option>
                <option value="compact">Compact</option>
              </select>
              <small>
                Adjusts Knowledge rows and Settings spacing for your account
                only.
              </small>
            </label>
            <SettingsToggle
              label="Reduce interface motion"
              note="Use quieter transitions throughout the app. Your device’s reduced-motion setting is always respected."
              checked={values.motion === "reduced"}
              onChange={(checked) =>
                setValues({ ...values, motion: checked ? "reduced" : "system" })
              }
            />
            <div className="settings-preview">
              <p>Date preview</p>
              <strong>{previewDate(values)}</strong>
            </div>
          </>
        ) : null}
        {section === "notifications" ? (
          <>
            <p className="text-sm leading-6 text-[var(--opryn-muted)]">
              These preferences control your in-app notification bell across
              your workspaces. They do not hide tasks in Needs You or change who
              is responsible for them.
            </p>
            <SettingsToggle
              label="Questions needing my answer"
              note="Reminders for questions assigned to you, or questions awaiting an owner when you manage the workspace."
              checked={values.notify_questions}
              onChange={(notify_questions) =>
                setValues({ ...values, notify_questions })
              }
            />
            <SettingsToggle
              label="Knowledge awaiting review"
              note="Notifications about proposals and source changes that need a decision."
              checked={values.notify_reviews}
              onChange={(notify_reviews) =>
                setValues({ ...values, notify_reviews })
              }
            />
            <SettingsToggle
              label="Answers to my questions"
              note="When an owner or expert responds to a question you asked."
              checked={values.notify_answers}
              onChange={(notify_answers) =>
                setValues({ ...values, notify_answers })
              }
            />
            <p className="text-sm leading-6 text-[var(--opryn-muted)]">
              Security, access, and connection alerts remain on. Invitation and
              sign-in emails are handled separately. Weekly summaries and
              configurable email digests are not currently available.
            </p>
          </>
        ) : null}
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
              Unsaved changes
            </span>
          ) : null}
        </div>
      </form>
      {section === "profile" ? (
        <section className="settings-preview" aria-label="Profile preview">
          <p>How your name appears on a review</p>
          <strong>{saved.display_name}</strong>
          <p>
            {jobTitle || "Team member"} · {workspace}
          </p>
          <p className="mt-2">
            Your access role—not this profile—determines whether you can approve
            knowledge.
          </p>
        </section>
      ) : null}
    </>
  );
}
function previewDate(settings: AccountSettings) {
  try {
    return new Intl.DateTimeFormat(settings.locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: settings.timezone,
    }).format(new Date("2026-09-12T16:30:00Z"));
  } catch {
    return "Choose a valid timezone.";
  }
}

function AvatarEditor({
  initialUrl,
  name,
  revision,
  onSaved,
  disabled,
}: {
  initialUrl: string | null;
  name: string;
  revision: number;
  onSaved: (revision: number) => void;
  disabled: boolean;
}) {
  const router = useRouter(),
    input = useRef<HTMLInputElement>(null),
    busy = useRef(false);
  const feedback = useSaveFeedback();
  const [url, setUrl] = useState(initialUrl),
    [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [zoom, setZoom] = useState(1),
    [x, setX] = useState(0.5),
    [y, setY] = useState(0.5);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);
  async function upload() {
    if (!file || busy.current) return;
    busy.current = true;
    feedback.setSaving(true);
    feedback.setError("");
    try {
      const form = new FormData();
      form.set("avatar", file);
      form.set("revision", String(revision));
      form.set("zoom", String(zoom));
      form.set("x", String(x));
      form.set("y", String(y));
      const response = await fetch("/api/account/avatar", {
        method: "POST",
        body: form,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setUrl(body.avatarUrl);
      onSaved(body.revision);
      setFile(null);
      feedback.setMessage("Photo saved.");
      router.refresh();
    } catch (error) {
      feedback.setError(
        error instanceof Error
          ? error.message
          : "Your photo could not be saved. Try again.",
      );
    } finally {
      feedback.setSaving(false);
      busy.current = false;
    }
  }
  async function remove() {
    if (busy.current) return;
    busy.current = true;
    feedback.setSaving(true);
    feedback.setError("");
    try {
      const response = await fetch("/api/account/avatar", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ revision }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setUrl(null);
      onSaved(body.revision);
      feedback.setMessage("Photo removed.");
      router.refresh();
    } catch (error) {
      feedback.setError(
        error instanceof Error ? error.message : "Could not remove photo.",
      );
    } finally {
      feedback.setSaving(false);
      busy.current = false;
    }
  }
  return (
    <>
      <div className="settings-avatar-row">
        <span className="settings-avatar">
          {url ? (
            <Image
              src={url}
              alt="Your profile photo"
              width={80}
              height={80}
              unoptimized
            />
          ) : (
            name.slice(0, 1).toUpperCase()
          )}
        </span>
        <div>
          <div className="settings-actions">
            <button
              className="settings-button"
              disabled={disabled || feedback.saving}
              onClick={() => input.current?.click()}
            >
              {url ? "Replace photo" : "Upload photo"}
            </button>
            {url ? (
              <button
                className="settings-button"
                disabled={disabled || feedback.saving}
                onClick={() => void remove()}
              >
                Remove
              </button>
            ) : null}
          </div>
          <p className="settings-caption mt-2">
            PNG, JPEG, or WebP. Up to 3 MB.
          </p>
          <input
            ref={input}
            aria-label="Choose profile photo"
            className="sr-only"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const next = e.target.files?.[0];
              e.target.value = "";
              feedback.setError("");
              if (!next) return;
              if (
                next.size > 3 * 1024 * 1024 ||
                !["image/png", "image/jpeg", "image/webp"].includes(next.type)
              ) {
                feedback.setError("Choose a PNG, JPEG, or WebP under 3 MB.");
                return;
              }
              setZoom(1);
              setX(0.5);
              setY(0.5);
              setFile(next);
              setPreview(URL.createObjectURL(next));
            }}
          />
        </div>
      </div>
      {!file ? (
        <SettingsFeedback error={feedback.error} message={feedback.message} />
      ) : null}
      {file ? (
        <DialogSurface
          label="Adjust profile photo"
          onClose={() => {
            if (!feedback.saving) setFile(null);
          }}
          className="dialog-review"
        >
          <section className="dialog-content w-full max-w-md bg-white p-6">
            <h2 className="text-lg font-semibold">Adjust your photo</h2>
            <p className="text-sm text-[var(--opryn-muted)] mt-1">
              Choose the part you want to show.
            </p>
            <div className="settings-crop">
              {preview ? (
                <Image
                  src={preview}
                  alt="Photo crop preview"
                  width={280}
                  height={280}
                  unoptimized
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: `${x * 100}% ${y * 100}%`,
                    objectPosition: `${x * 100}% ${y * 100}%`,
                  }}
                />
              ) : null}
            </div>
            <div className="settings-crop-controls">
              {[
                ["Zoom", zoom, setZoom, 1, 3],
                ["Horizontal position", x, setX, 0, 1],
                ["Vertical position", y, setY, 0, 1],
              ].map(([label, value, set, min, max]) => (
                <label key={String(label)} className="settings-field">
                  {String(label)}
                  <input
                    type="range"
                    min={Number(min)}
                    max={Number(max)}
                    step="0.01"
                    value={Number(value)}
                    onChange={(e) =>
                      (set as (v: number) => void)(Number(e.target.value))
                    }
                  />
                </label>
              ))}
            </div>
            <SettingsFeedback error={feedback.error} message="" />
            <div className="settings-actions mt-5">
              <button
                className="settings-button primary"
                disabled={feedback.saving}
                onClick={() => void upload()}
              >
                {feedback.saving ? "Saving…" : "Save photo"}
              </button>
              <button
                className="settings-button"
                disabled={feedback.saving}
                onClick={() => setFile(null)}
              >
                Cancel
              </button>
            </div>
          </section>
        </DialogSurface>
      ) : null}
    </>
  );
}

export function AccountSecurity({
  providers,
  email,
  lastSignIn,
}: {
  providers: string[];
  email: string;
  lastSignIn: string | null;
}) {
  const feedback = useSaveFeedback();
  async function signOutOthers() {
    if (
      feedback.saving ||
      !window.confirm(
        "Sign out your other Opryn sessions? This session will stay open.",
      )
    )
      return;
    feedback.setSaving(true);
    feedback.setError("");
    try {
      const { error } = await createClient().auth.signOut({ scope: "others" });
      if (error) throw error;
      feedback.setMessage(
        "Other sessions can no longer refresh. Existing access may continue until their current session token expires.",
      );
    } catch {
      feedback.setError("Other sessions could not be signed out. Try again.");
    } finally {
      feedback.setSaving(false);
    }
  }
  return (
    <div className="settings-form">
      <dl className="settings-dl">
        <dt>Account email</dt>
        <dd>{email}</dd>
        <dt>Connected sign-in methods</dt>
        <dd>
          {providers
            .map((p) =>
              p === "email" ? "Email" : p.charAt(0).toUpperCase() + p.slice(1),
            )
            .join(", ") || "Your account provider"}
        </dd>
        <dt>Last sign-in</dt>
        <dd>{lastSignIn || "Not available"}</dd>
      </dl>
      <section className="settings-section">
        <h3>Sign-in details</h3>
        <p>
          {providers.includes("email")
            ? "Use the verified email recovery flow to reset your password."
            : "Sign-in security is managed by your connected identity provider. This account does not have an Opryn email/password sign-in method."}
        </p>
        {providers.includes("email") ? (
          <Link href="/forgot-password" className="settings-quiet-link">
            Reset password <ArrowRight size={16} />
          </Link>
        ) : null}
        <p className="mt-3">
          Need to change your account email or sign-in method? Contact support
          for help with the verified account flow.
        </p>
        <a href="mailto:usersupport@opryn.app" className="settings-quiet-link">
          Contact account support <ArrowRight size={16} />
        </a>
      </section>
      <section className="settings-section">
        <h3>Other sessions</h3>
        <p>
          Keep this session open and revoke refresh access from your other Opryn
          sessions. Opryn does not currently show a device-by-device session
          inventory.
        </p>
        <button
          className="settings-button mt-4"
          disabled={feedback.saving}
          onClick={() => void signOutOthers()}
        >
          {feedback.saving ? "Signing out…" : "Sign out other sessions"}
        </button>
      </section>
      <SettingsFeedback error={feedback.error} message={feedback.message} />
    </div>
  );
}
