"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  FileAudio,
  LoaderCircle,
  LockKeyhole,
  PhoneCall,
  Upload,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { UpgradeModal } from "@/components/app/upgrade-modal";

export function CallsLocked() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <section className="overflow-hidden rounded-3xl border border-[#dfe5ed] bg-white">
        <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_.75fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-[#eaf7f1] px-3 py-1 text-xs font-bold text-[#177257]">
              <LockKeyhole className="size-3.5" /> Premium
            </span>
            <h2 className="mt-5 text-3xl font-semibold tracking-[-.04em]">
              Learn from the conversations already happening.
            </h2>
            <p className="mt-4 max-w-xl text-base leading-7 text-[#657286]">
              Turn authorized customer and sales calls into reusable answers,
              useful examples, and possible company rules—after you review them.
            </p>
            <button
              onClick={() => setOpen(true)}
              className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#3158d8] px-5 text-sm font-semibold text-white"
            >
              Upgrade to Premium <ArrowRight className="size-4" />
            </button>
          </div>
          <div className="rounded-2xl bg-[#111d34] p-6 text-white">
            <p className="text-xs font-bold uppercase tracking-[.12em] text-[#9fb0cc]">
              From one call
            </p>
            {[
              "Customer questions",
              "Sales objections",
              "Successful responses",
              "Helpful examples",
            ].map((item) => (
              <div
                key={item}
                className="mt-4 flex items-center gap-3 rounded-xl bg-white/7 p-3 text-sm"
              >
                <span className="grid size-7 place-items-center rounded-full bg-[#2b9a76]/20 text-[#65d1ad]">
                  <Check className="size-4" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
      <UpgradeModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function CallPrivacy({ acknowledged }: { acknowledged: boolean }) {
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(acknowledged);
  async function confirm() {
    setSaving(true);
    const response = await fetch("/api/calls/privacy", { method: "POST" });
    if (response.ok) {
      setDone(true);
      window.location.reload();
    } else setSaving(false);
  }
  if (done) return null;
  return (
    <div className="mobile-sheet-overlay fixed inset-0 z-[130] grid place-items-center bg-[#0b1426]/55 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="call-privacy-title"
        className="mobile-sheet-panel w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <span className="grid size-11 place-items-center rounded-xl bg-[#edf2ff] text-[#3158d8]">
          <LockKeyhole className="size-5" />
        </span>
        <h2 id="call-privacy-title" className="mt-5 text-2xl font-semibold">
          Call Recording &amp; Privacy
        </h2>
        <p className="mt-3 text-sm leading-6 text-[#657286]">
          Only upload calls that your business is legally permitted to record
          and analyze. Recording and consent requirements vary by location.
        </p>
        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-xl border border-[#dfe5ed] p-4 text-sm leading-6">
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
            className="mt-1 size-5 accent-[#3158d8]"
          />
          <span>
            I understand that my business is responsible for obtaining any
            required consent.
          </span>
        </label>
        <button
          disabled={!checked || saving}
          onClick={() => void confirm()}
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#3158d8] px-5 text-sm font-semibold text-white disabled:opacity-45"
        >
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : null}
          Continue
        </button>
      </section>
    </div>
  );
}

export function CallUploader({ organizationId }: { organizationId: string }) {
  void organizationId;
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [callType, setCallType] = useState("customer");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!file || !title.trim())
      return setError("Add a title and choose a recording.");
    setError("");
    setStage("Preparing secure upload");
    try {
      const create = await fetch("/api/calls", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          callType,
          originalName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });
      const created = await create.json();
      if (!create.ok) throw new Error(created.error);
      setStage("Uploading recording");
      const { error: uploadError } = await createClient()
        .storage.from("call-recordings")
        .upload(created.storage_path, file, {
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;
      setStage(
        file.type.startsWith("video/")
          ? "Extracting audio"
          : "Transcribing conversation",
      );
      const learn = await fetch(`/api/calls/${created.id}/learn`, {
        method: "POST",
      });
      const learned = await learn.json();
      if (!learn.ok) throw new Error(learned.error);
      setStage("Preparing review");
      router.push(`/app/calls/${created.id}`);
      router.refresh();
    } catch (caught) {
      setStage("");
      setError(
        caught instanceof Error
          ? caught.message
          : "The call could not be analyzed.",
      );
    }
  }
  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-[#dfe5ed] bg-white p-5 sm:p-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Analyze a Call</h2>
          <p className="mt-1 text-sm text-[#718095]">
            Upload an authorized customer, sales, or team recording.
          </p>
        </div>
        <span className="rounded-full bg-[#eaf7f1] px-3 py-1 text-[10px] font-bold uppercase text-[#177257]">
          Premium
        </span>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Call title
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Estimate follow-up call"
            className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] px-3.5"
          />
        </label>
        <label className="text-sm font-medium">
          Conversation type
          <select
            value={callType}
            onChange={(event) => setCallType(event.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] bg-white px-3.5"
          >
            <option value="customer">Customer call</option>
            <option value="sales">Sales call</option>
            <option value="team">Team call</option>
            <option value="other">Other business call</option>
          </select>
        </label>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".mp3,.wav,.m4a,.mp4,.mov,.webm,audio/*,video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="mt-4 flex min-h-24 w-full items-center justify-center gap-3 rounded-xl border border-dashed border-[#cdd6e2] bg-[#f9fbfd] text-sm font-medium text-[#526174] hover:border-[#3158d8]"
      >
        <Upload className="size-5 text-[#3158d8]" />
        {file ? file.name : "Choose MP3, WAV, M4A, MP4, MOV, or WEBM"}
      </button>
      {error ? (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-[#fff0f1] p-3 text-sm text-[#a83f49]"
        >
          {error}
        </p>
      ) : null}
      <button
        disabled={Boolean(stage)}
        className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#3158d8] px-5 text-sm font-semibold text-white disabled:opacity-60"
      >
        {stage ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <FileAudio className="size-4" />
        )}
        {stage || "Upload & analyze"}
      </button>
      <p className="mt-4 text-xs leading-5 text-[#8490a1]">
        Opryn removes common sensitive identifiers before detecting reusable
        knowledge. Review is required before anything becomes official.
      </p>
    </form>
  );
}

export function CallRow({
  call,
}: {
  call: {
    id: string;
    title: string;
    call_type: string;
    status: string;
    created_at: string;
    provider?: string;
  };
}) {
  return (
    <Link
      href={`/app/calls/${call.id}`}
      className="flex items-center gap-3 border-b border-[#edf0f4] py-4 last:border-0"
    >
      <span className="grid size-10 place-items-center rounded-xl bg-[#edf2ff] text-[#3158d8]">
        <PhoneCall className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {call.title}
        </span>
        <span className="mt-1 block text-xs capitalize text-[#7a8798]">
          {call.provider === "twilio" ? "Twilio" : "Uploaded"} ·{" "}
          {call.call_type} · {new Date(call.created_at).toLocaleDateString()}
        </span>
      </span>
      <span className="rounded-full bg-[#f0f3f7] px-2.5 py-1 text-[10px] font-bold capitalize text-[#667286]">
        {call.status.replace("_", " ")}
      </span>
    </Link>
  );
}
