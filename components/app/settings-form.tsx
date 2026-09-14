"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  ImagePlus,
  LoaderCircle,
  Trash2,
} from "lucide-react";
type Props = {
  initial: {
    name: string;
    industry: string;
    employeeCount: number;
    employeesCanAsk: boolean;
    allowEscalations: boolean;
    confidenceThreshold: number;
    estimatedInterruptionMinutes: number;
    expertAnswersRequireAdminApproval: boolean;
    aiProcessCreation: "always_ask" | "auto_draft";
    aiProcessApprovalPrompt: "ask_immediately" | "add_to_needs_approval";
  };
  initialLogoUrl: string | null;
  isOwner: boolean;
};
export function SettingsForm({ initial, initialLogoUrl, isOwner }: Props) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setError("");
    setMessage("");
    setUploadingLogo(true);
    const form = new FormData();
    form.set("logo", file);
    const response = await fetch("/api/settings/logo", {
      method: "POST",
      body: form,
    });
    const body = await response.json();
    setUploadingLogo(false);
    if (!response.ok) {
      setError(body.error ?? "Unable to upload the business logo.");
      return;
    }
    setLogoUrl(body.logoUrl);
    setMessage("Business logo updated.");
    router.refresh();
  }

  async function removeLogo() {
    setError("");
    setMessage("");
    setUploadingLogo(true);
    const response = await fetch("/api/settings/logo", { method: "DELETE" });
    const body = await response.json();
    setUploadingLogo(false);
    if (!response.ok) {
      setError(body.error ?? "Unable to remove the business logo.");
      return;
    }
    setLogoUrl(null);
    setMessage("Business logo removed.");
    router.refresh();
  }
  async function save() {
    if (saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(
          body.error || "Your settings weren't saved. Please try again.",
        );
        return;
      }
      setMessage("Settings saved.");
      router.refresh();
    } catch {
      setError(
        "Your settings weren't saved. Your changes are still here. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }
  async function remove() {
    const response = await fetch("/api/settings", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error);
      return;
    }
    router.replace("/onboarding");
    router.refresh();
  }
  return (
    <div className="space-y-5">
      <Section
        title="Business"
        note="The basic details shown across your Opryn workspace."
      >
        <div className="mb-6 flex flex-col gap-4 border-b border-[#edf0f4] pb-6 sm:flex-row sm:items-center">
          {logoUrl ? (
            <span
              role="img"
              aria-label={`${data.name} logo`}
              className="block size-20 shrink-0 rounded-2xl border border-[#d9e2ee] bg-white bg-cover bg-center bg-no-repeat shadow-sm"
              style={{ backgroundImage: `url(${JSON.stringify(logoUrl)})` }}
            />
          ) : (
            <span className="grid size-20 shrink-0 place-items-center rounded-2xl border border-[#d9e2ee] bg-[#f3f7ff] text-[#3158d8]">
              <Building2 className="size-7" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-[#253148]">Company logo</p>
            <p className="mt-1 text-xs leading-5 text-[#718095]">
              Add a PNG, JPG, or WebP image. It will appear in your Opryn
              workspace.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-[#cfd9e8] bg-white px-3.5 text-xs font-semibold text-[#3158d8] transition hover:border-[#9fb7df] hover:bg-[#f7faff]">
                {uploadingLogo ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-4" />
                )}
                {logoUrl ? "Replace logo" : "Upload logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={uploadingLogo}
                  onChange={(event) => {
                    void uploadLogo(event.target.files?.[0]);
                    event.currentTarget.value = "";
                  }}
                  className="sr-only"
                />
              </label>
              {logoUrl ? (
                <button
                  type="button"
                  disabled={uploadingLogo}
                  onClick={() => void removeLogo()}
                  className="min-h-10 rounded-lg px-3.5 text-xs font-semibold text-[#66758a] hover:bg-[#f3f5f8] disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Business name"
            value={data.name}
            onChange={(name) => setData({ ...data, name })}
            className="sm:col-span-2"
          />
          <Field
            label="Industry"
            value={data.industry}
            onChange={(industry) => setData({ ...data, industry })}
          />
          <label className="block text-sm font-medium">
            Business size
            <input
              type="number"
              min="0"
              value={data.employeeCount}
              onChange={(e) =>
                setData({ ...data, employeeCount: Number(e.target.value) })
              }
              className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] px-3.5"
            />
          </label>
        </div>
      </Section>
      <Section
        title="Opryn Learning"
        note="Control how employees get answers and when you are interrupted."
      >
        <Toggle
          label="Employees may ask Opryn"
          note="Allow workspace members to ask questions from approved company knowledge."
          checked={data.employeesCanAsk}
          onChange={(employeesCanAsk) => setData({ ...data, employeesCanAsk })}
        />
        <Toggle
          label="Escalate unanswered questions"
          note="Let employees send unknown questions to owners and admins."
          checked={data.allowEscalations}
          onChange={(allowEscalations) =>
            setData({ ...data, allowEscalations })
          }
        />
        <details className="mt-5 rounded-xl border border-[#e3e8ef] bg-[#fafbfd] p-4">
          <summary className="cursor-pointer text-sm font-semibold text-[#53627a]">
            Advanced answer behavior
          </summary>
          <label className="mt-4 block text-sm font-medium">
            When should Opryn ask instead of answer?
            <input
              type="range"
              min="0.5"
              max="0.95"
              step="0.01"
              value={data.confidenceThreshold}
              onChange={(e) =>
                setData({
                  ...data,
                  confidenceThreshold: Number(e.target.value),
                })
              }
              className="mt-3 w-full accent-[#3158d8]"
            />
            <span className="mt-1 block text-xs font-normal text-[#7b8798]">
              Move right to make Opryn ask the owner more often when the answer
              is unclear.
            </span>
          </label>
          <label className="mt-5 block text-sm font-medium">
            Estimated time for one avoided interruption
            <select
              value={data.estimatedInterruptionMinutes}
              onChange={(event) =>
                setData({
                  ...data,
                  estimatedInterruptionMinutes: Number(event.target.value),
                })
              }
              className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] bg-white px-3.5"
            >
              {[1, 2, 3, 5, 10].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-[#7b8798]">
              Opryn uses this transparent estimate when showing time saved.
            </span>
          </label>
        </details>
        <Toggle
          label="Owner approves expert answers before Opryn remembers them"
          note="Experts can still answer teammates immediately. Turn this off only if assigned experts may approve reusable company guidance."
          checked={data.expertAnswersRequireAdminApproval}
          onChange={(expertAnswersRequireAdminApproval) =>
            setData({ ...data, expertAnswersRequireAdminApproval })
          }
        />
        <div className="mt-5 grid gap-4 rounded-xl border border-[#e3e8ef] bg-[#fafbfd] p-4 sm:grid-cols-2">
          <label className="text-sm font-medium">
            AI-created processes
            <select
              value={data.aiProcessCreation}
              onChange={(event) =>
                setData({
                  ...data,
                  aiProcessCreation: event.target.value as
                    "always_ask" | "auto_draft",
                })
              }
              className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] bg-white px-3.5 text-base sm:text-sm"
            >
              <option value="auto_draft">Create as draft automatically</option>
              <option value="always_ask">Always ask before creating</option>
            </select>
          </label>
          <label className="text-sm font-medium">
            After AI creates a process
            <select
              value={data.aiProcessApprovalPrompt}
              onChange={(event) =>
                setData({
                  ...data,
                  aiProcessApprovalPrompt: event.target.value as
                    "ask_immediately" | "add_to_needs_approval",
                })
              }
              className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] bg-white px-3.5 text-base sm:text-sm"
            >
              <option value="ask_immediately">
                Ask me to approve immediately
              </option>
              <option value="add_to_needs_approval">
                Add it to Needs Approval
              </option>
            </select>
          </label>
          <p className="text-xs leading-5 text-[#718095] sm:col-span-2">
            Connected AI can prepare a draft, but it never becomes official
            without the normal Opryn approval rules.
          </p>
        </div>
      </Section>
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
      <div className="flex justify-end">
        <button
          disabled={saving}
          onClick={() => void save()}
          className="min-h-11 rounded-xl bg-[#3158d8] px-5 text-sm font-semibold text-white"
        >
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </div>
      {isOwner ? (
        <Section
          title="Danger Zone"
          note="Deleting a workspace permanently removes its processes, rules, questions, and connected business data."
        >
          <button
            onClick={() => setConfirming(!confirming)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#e3bdc1] px-4 text-sm font-semibold text-[#a13e47]"
          >
            <Trash2 className="size-4" />
            Delete workspace
          </button>
          {confirming ? (
            <div className="mt-4 rounded-xl bg-[#fff4f5] p-4">
              <p className="text-sm text-[#783e44]">
                Type <strong>{data.name}</strong> to confirm.
              </p>
              <input
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                className="mt-3 h-10 w-full rounded-lg border border-[#e0bdc0] px-3 text-sm"
              />
              <button
                disabled={confirmation !== data.name}
                onClick={() => void remove()}
                className="mt-3 min-h-10 rounded-lg bg-[#a9434c] px-4 text-sm font-semibold text-white disabled:opacity-40"
              >
                Permanently delete
              </button>
            </div>
          ) : null}
        </Section>
      ) : null}
    </div>
  );
}
function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  const id =
    title === "Business"
      ? "business"
      : title === "Opryn Learning"
        ? "learning"
        : title === "Danger Zone"
          ? "danger"
          : undefined;
  return (
    <section
      id={id}
      className="scroll-mt-24 rounded-2xl border border-[#dfe5ed] bg-white p-5 sm:p-7"
    >
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-[#718095]">{note}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}
function Field({
  label,
  value,
  onChange,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-medium ${className}`}>
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] px-3.5"
      />
    </label>
  );
}
function Toggle({
  label,
  note,
  checked,
  onChange,
}: {
  label: string;
  note: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 border-b border-[#edf0f4] py-4 first:pt-0">
      <span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-[#7b8798]">
          {note}
        </span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-5 accent-[#3158d8]"
      />
    </label>
  );
}
