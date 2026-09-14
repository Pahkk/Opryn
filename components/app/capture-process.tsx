"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle2,
  BookOpenText,
  Cloud,
  Lock,
  Mic,
  MonitorUp,
  Pause,
  Play,
  RotateCcw,
  Square,
  Video,
} from "lucide-react";
import { hasFeature, type PlanId } from "@/lib/billing/plans";
import { UpgradeModal } from "@/components/app/upgrade-modal";
import { showAppToast } from "@/lib/client-toast";
import { createClient } from "@/lib/supabase/client";
import { TeachPipeline } from "./teach-sources";
import { SourceImport } from "@/components/onboarding/source-import";
import { CallsIcon, DocumentIcon } from "@/components/opryn-icons/opryn-icons";

type Role = { id: string; name: string };
type InitialCapture = {
  title: string;
  description: string;
  coachingPrompt: string;
  recommendationId?: string;
};
type CaptureMode =
  "text" | "drive" | "voice" | "video" | "screen" | "documents";
const textStages = [
  "Reading your explanation",
  "Finding steps and rules",
  "Preparing your process",
];

export function CaptureProcess({
  roles,
  initial,
  returnTo,
  plan,
  initialMode = "text",
  onPrepared,
}: {
  roles: Role[];
  initial?: InitialCapture;
  returnTo: string;
  plan: PlanId;
  initialMode?: "text" | "drive" | "documents";
  onPrepared?: (processId: string) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const secondaryStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const meterFrameRef = useRef<number | null>(null);
  const meterContextRef = useRef<AudioContext | null>(null);
  const mixerContextRef = useRef<AudioContext | null>(null);
  const previewUrlRef = useRef("");
  const recordingChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const [mode, setMode] = useState<CaptureMode>(initialMode);
  const [file, setFile] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [audioBars, setAudioBars] = useState<number[]>(() =>
    Array.from({ length: 36 }, () => 4),
  );
  const [stepMarkers, setStepMarkers] = useState<number[]>([]);
  const [previewUrl, setPreviewUrl] = useState("");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    roleId: "",
    explanation: "",
    driveUrl: "",
  });
  const [working, setWorking] = useState(false);
  const [stage, setStage] = useState(0);
  const [error, setError] = useState("");
  const [retryJob, setRetryJob] = useState<{
    processId: string;
    mediaId: string;
    isVideo: boolean;
    markedSeconds: number[];
  } | null>(null);

  useEffect(() => {
    return () => releaseRecorder();
  }, []);

  function releaseRecorder() {
    if (recordingTimerRef.current)
      window.clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = null;
    if (meterFrameRef.current)
      window.cancelAnimationFrame(meterFrameRef.current);
    meterFrameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    secondaryStreamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    secondaryStreamRef.current = null;
    void meterContextRef.current?.close();
    void mixerContextRef.current?.close();
    meterContextRef.current = null;
    mixerContextRef.current = null;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
  }

  function updateFile(nextFile: File | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = "";
    setPreviewUrl("");
    setFile(nextFile);
    if (nextFile?.type.startsWith("video/")) {
      const url = URL.createObjectURL(nextFile);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    }
  }

  function startTimer() {
    if (recordingTimerRef.current)
      window.clearInterval(recordingTimerRef.current);
    recordingTimerRef.current = window.setInterval(
      () => setRecordingSeconds((seconds) => seconds + 1),
      1000,
    );
  }

  async function runCountdown() {
    for (let value = 3; value > 0; value -= 1) {
      setCountdown(value);
      await new Promise((resolve) => window.setTimeout(resolve, 700));
    }
    setCountdown(0);
  }

  function startAudioMeter(stream: MediaStream) {
    if (!stream.getAudioTracks().length) return;
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const analyser = context.createAnalyser();
    const silent = context.createGain();
    analyser.fftSize = 128;
    analyser.smoothingTimeConstant = 0.72;
    silent.gain.value = 0;
    source.connect(analyser);
    analyser.connect(silent);
    silent.connect(context.destination);
    meterContextRef.current = context;
    const samples = new Uint8Array(analyser.frequencyBinCount);
    let lastPaint = 0;
    const paint = (time: number) => {
      if (time - lastPaint > 55) {
        analyser.getByteTimeDomainData(samples);
        setAudioBars(
          Array.from({ length: 36 }, (_, index) => {
            const sample = samples[Math.floor((index / 36) * samples.length)];
            return Math.max(4, Math.min(34, Math.abs(sample - 128) * 2.4));
          }),
        );
        lastPaint = time;
      }
      meterFrameRef.current = window.requestAnimationFrame(paint);
    };
    meterFrameRef.current = window.requestAnimationFrame(paint);
  }

  function mixAudio(streams: MediaStream[]) {
    const withAudio = streams.filter((stream) =>
      stream.getAudioTracks().some((track) => track.readyState === "live"),
    );
    if (!withAudio.length) return [] as MediaStreamTrack[];
    if (withAudio.length === 1) return withAudio[0].getAudioTracks();
    const context = new AudioContext();
    const destination = context.createMediaStreamDestination();
    withAudio.forEach((stream) =>
      context.createMediaStreamSource(stream).connect(destination),
    );
    mixerContextRef.current = context;
    return destination.stream.getAudioTracks();
  }

  function changeMode(nextMode: CaptureMode) {
    if (
      (nextMode === "video" && !hasFeature(plan, "videoLearning")) ||
      (nextMode === "screen" && !hasFeature(plan, "screenRecording"))
    ) {
      setUpgradeOpen(true);
      return;
    }
    if (recording) cancelVoiceRecording();
    setMode(nextMode);
    setError("");
    setRetryJob(null);
    updateFile(null);
    setRecordingSeconds(0);
    setStepMarkers([]);
  }

  async function startVoiceRecording() {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError(
        "Voice recording isn't supported in this browser. Explain the process with text instead.",
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/mp4",
        "audio/webm",
      ];
      const selectedType = preferredTypes.find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(
        stream,
        selectedType ? { mimeType: selectedType } : undefined,
      );
      streamRef.current = stream;
      recorderRef.current = recorder;
      recordingChunksRef.current = [];
      discardRecordingRef.current = false;
      updateFile(null);
      setPaused(false);
      setRecordingSeconds(0);
      setStepMarkers([]);
      startAudioMeter(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const chunks = recordingChunksRef.current;
        const discard = discardRecordingRef.current;
        releaseRecorder();
        setRecording(false);
        setPaused(false);
        if (discard || !chunks.length) return;
        const mimeType = recorder.mimeType.split(";")[0] || "audio/webm";
        const extension = mimeType === "audio/mp4" ? "m4a" : "webm";
        const blob = new Blob(chunks, { type: mimeType });
        updateFile(
          new File([blob], `voice-explanation.${extension}`, {
            type: mimeType,
            lastModified: Date.now(),
          }),
        );
      };
      recorder.onerror = () => {
        releaseRecorder();
        setRecording(false);
        setPaused(false);
        setError("Opryn couldn't finish this recording. Please try again.");
      };
      await runCountdown();
      recorder.start(250);
      setRecording(true);
      startTimer();
    } catch {
      releaseRecorder();
      setError(
        "Microphone access was blocked. Allow microphone access, then try again.",
      );
    }
  }

  async function startScreenRecording() {
    setError("");
    if (!navigator.mediaDevices?.getDisplayMedia || !window.MediaRecorder) {
      setError(
        "Screen recording isn't supported in this browser. Upload a video instead.",
      );
      return;
    }
    try {
      const display = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      let microphone: MediaStream | null = null;
      try {
        microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        display.getTracks().forEach((track) => track.stop());
        throw new Error("microphone_required");
      }
      streamRef.current = display;
      secondaryStreamRef.current = microphone;
      const combined = new MediaStream([
        ...display.getVideoTracks(),
        ...mixAudio([display, ...(microphone ? [microphone] : [])]),
      ]);
      startAudioMeter(microphone ?? display);
      const preferredTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/mp4",
        "video/webm",
      ];
      const selectedType = preferredTypes.find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(combined, {
        ...(selectedType ? { mimeType: selectedType } : {}),
        videoBitsPerSecond: 1_500_000,
        audioBitsPerSecond: 96_000,
      });
      recorderRef.current = recorder;
      recordingChunksRef.current = [];
      discardRecordingRef.current = false;
      updateFile(null);
      setPaused(false);
      setRecordingSeconds(0);
      setStepMarkers([]);
      recorder.ondataavailable = (event) => {
        if (event.data.size) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const chunks = recordingChunksRef.current;
        const discard = discardRecordingRef.current;
        releaseRecorder();
        setRecording(false);
        if (discard || !chunks.length) return;
        const mimeType = recorder.mimeType.split(";")[0] || "video/webm";
        const extension = mimeType === "video/mp4" ? "mp4" : "webm";
        updateFile(
          new File(chunks, `screen-workflow.${extension}`, {
            type: mimeType,
            lastModified: Date.now(),
          }),
        );
      };
      recorder.onerror = () => {
        releaseRecorder();
        setRecording(false);
        setError("Opryn couldn't finish this screen recording. Try again.");
      };
      display.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (recorder.state !== "inactive") recorder.stop();
      });
      await runCountdown();
      recorder.start(250);
      setRecording(true);
      startTimer();
    } catch (caught) {
      releaseRecorder();
      setError(
        caught instanceof Error && caught.message === "microphone_required"
          ? "Opryn needs microphone access so it can hear your explanation. Allow it, then try again."
          : "Screen or microphone access was canceled. Allow access, then try again.",
      );
    }
  }

  function stopVoiceRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    else if (recorderRef.current?.state === "paused")
      recorderRef.current.stop();
  }

  function toggleRecordingPause() {
    const recorder = recorderRef.current;
    if (!recorder) return;
    if (recorder.state === "recording") {
      recorder.pause();
      if (recordingTimerRef.current)
        window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
      setPaused(true);
    } else if (recorder.state === "paused") {
      recorder.resume();
      startTimer();
      setPaused(false);
    }
  }

  function cancelVoiceRecording() {
    discardRecordingRef.current = true;
    if (
      recorderRef.current?.state === "recording" ||
      recorderRef.current?.state === "paused"
    )
      recorderRef.current.stop();
    else releaseRecorder();
    setRecording(false);
    setPaused(false);
    updateFile(null);
    setRecordingSeconds(0);
  }

  function finish(processId: string) {
    if (onPrepared) {
      setWorking(false);
      onPrepared(processId);
      return;
    }
    showAppToast(
      "Process ready for review!",
      "Check the steps and approve it before your team uses it.",
    );
    router.replace(
      `/app/processes/${processId}?returnTo=${encodeURIComponent(returnTo)}`,
    );
  }

  async function learnRecording(job: {
    processId: string;
    mediaId: string;
    isVideo: boolean;
    markedSeconds: number[];
  }) {
    const jobStages = [
      "Uploading recording",
      ...(job.isVideo ? ["Extracting audio"] : []),
      "Listening to your explanation",
      ...(job.isVideo ? ["Watching the workflow"] : []),
      "Finding steps and rules",
      "Preparing your process",
    ];
    setStage(1);
    try {
      const response = await fetch(`/api/processes/${job.processId}/learn`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mediaId: job.mediaId,
          markedSeconds: job.markedSeconds,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        if (body.canRetry) setRetryJob(job);
        throw new Error(body.error ?? "Opryn could not learn this recording.");
      }
      setRetryJob(null);
      setStage(jobStages.length - 1);
      return body.processId as string;
    } finally {
      /* Actual service events, not a timed progress simulation. */
    }
  }

  async function retryProcessing() {
    if (!retryJob || working) return;
    setError("");
    setWorking(true);
    try {
      finish(await learnRecording(retryJob));
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Something went wrong.",
      );
      setWorking(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setWorking(true);
    setStage(0);
    try {
      if (!["text", "drive"].includes(mode) && !file)
        throw new Error(
          mode === "voice" || mode === "screen"
            ? "Record your explanation before continuing."
            : "Choose a recording to upload.",
        );
      const response = await fetch("/api/processes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          roleId: form.roleId || null,
          explanation: mode === "text" ? form.explanation : undefined,
          driveUrl: mode === "drive" ? form.driveUrl : undefined,
          inputType:
            mode === "text"
              ? "text"
              : mode === "drive"
                ? "google_drive"
                : "media",
          captureMethod: mode === "drive" ? "google_drive" : mode,
          recommendationId: initial?.recommendationId ?? null,
          file:
            !["text", "drive"].includes(mode) && file
              ? { name: file.name, type: file.type, size: file.size }
              : undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Unable to create process.");
      if (body.ready) {
        setStage(textStages.length - 1);
        finish(body.processId);
        return;
      }
      setStage(0);
      const { error: uploadError } = await createClient()
        .storage.from("process-media")
        .upload(body.storagePath, file!, {
          contentType: file!.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;
      finish(
        await learnRecording({
          processId: body.processId,
          mediaId: body.mediaId,
          isVideo: file!.type.startsWith("video/"),
          markedSeconds: mode === "screen" ? stepMarkers : [],
        }),
      );
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Something went wrong.",
      );
      setWorking(false);
    }
  }
  if (mode === "documents")
    return (
      <SourceImport
        onPrepared={onPrepared}
        mode="documents"
        returnTo={returnTo}
        onBack={() => changeMode("text")}
      />
    );
  if (working)
    return (
      <div className="opryn-surface mx-auto max-w-3xl overflow-hidden p-7 sm:p-10">
        <TeachPipeline />
        <h2 className="mt-5 text-center text-2xl font-semibold tracking-[-.035em] text-[var(--opryn-navy)]">
          Opryn is learning this process
        </h2>
        <p className="mt-2 text-center text-sm text-[var(--opryn-muted)]">
          Your input is moving through Opryn. You&apos;ll review everything
          before it becomes company knowledge.
        </p>
        <p role="status" className="mt-6 text-center">
          {mode === "text"
            ? "Reading your explanation and preparing findings…"
            : stage === 0
              ? "Uploading your recording…"
              : "Processing your recording and preparing findings…"}
        </p>
        <p className="mt-6 text-center text-xs text-[var(--opryn-faint)]">
          Keep this page open while Opryn prepares the review.
        </p>
      </div>
    );
  return (
    <form onSubmit={submit} className="mx-auto max-w-5xl space-y-5">
      {initial?.coachingPrompt ? (
        <section className="border-l-2 border-[var(--opryn-blue)] bg-[var(--opryn-blue-surface)] p-5 sm:p-6">
          <p className="text-xs font-semibold tracking-[.05em] text-[var(--opryn-blue)]">
            A helpful place to start
          </p>
          <p className="mt-2 text-sm leading-6 text-[#53627a]">
            {initial.coachingPrompt}
          </p>
        </section>
      ) : null}
      <section className="opryn-surface flex flex-col overflow-hidden">
        <div className="order-1 border-b border-[#edf0f4] p-5 sm:p-7">
          <div className="flex items-center gap-3">
            <BookOpenText size={21} className="text-[var(--opryn-blue)]" />
            <h2 className="text-xl font-semibold tracking-[-.03em] text-[var(--opryn-navy)]">
              What should Opryn learn?
            </h2>
          </div>
          <p className="mt-1 text-sm text-[#718095]">
            Explain one process, rule, or answer. Opryn will organize it for
            you.
          </p>
          <Field
            label="Give it a clear name"
            value={form.title}
            onChange={(title) => setForm({ ...form, title })}
            placeholder="New Customer Intake"
            className="mt-5"
          />
        </div>
        <div className="order-3 border-t border-[var(--opryn-line)] bg-[#fafbfd] p-4 sm:px-6">
          <p className="mb-3 text-[11px] font-semibold text-[#7a8698]">
            Or teach Opryn another way
          </p>
          <div className="flex flex-wrap gap-2">
            <ModeButton
              active={mode === "voice"}
              onClick={() => changeMode("voice")}
              icon={<Mic className="size-4" />}
              title="Voice"
              note="Talk naturally"
            />
            <ModeButton
              active={mode === "text"}
              onClick={() => changeMode("text")}
              icon={<DocumentIcon size={16} />}
              title="Type"
              note="Type an answer"
            />
            <ModeButton
              active={false}
              onClick={() => changeMode("documents")}
              icon={<DocumentIcon size={16} />}
              title="Images & documents"
              note="Upload PNG, JPEG, PDF, or Word files"
            />
            <ModeButton
              active={mode === "video"}
              onClick={() => changeMode("video")}
              icon={<Video className="size-4" />}
              title="Video"
              note="Upload video"
              premium
              locked={!hasFeature(plan, "videoLearning")}
            />
            <ModeButton
              active={mode === "screen"}
              onClick={() => changeMode("screen")}
              icon={<MonitorUp className="size-4" />}
              title="Screen"
              note="Record workflow"
              premium
              locked={!hasFeature(plan, "screenRecording")}
            />
            {!onPrepared && (
              <Link
                href="/app/calls"
                className="relative inline-flex min-h-11 items-center gap-2 rounded-[9px] border border-[var(--opryn-line)] bg-white px-3.5 text-xs font-semibold text-[#56647a] hover:border-[#9eb5d4] hover:text-[var(--opryn-blue)]"
              >
                <CallsIcon size={16} /> Calls
                <span className="opryn-premium-label">Premium</span>
              </Link>
            )}
          </div>
        </div>
        {mode === "drive" ? (
          <div className="order-2 m-5 rounded-2xl border border-[#dfe5ed] bg-[#f8fafd] p-5 sm:m-7 sm:p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#3158d8] shadow-sm">
                <Cloud className="size-[18px]" />
              </span>
              <div>
                <h3 className="text-sm font-semibold">
                  Import from Google Drive
                </h3>
                <p className="mt-1 text-xs leading-5 text-[#718095]">
                  Paste an already shareable document link. Keep private company
                  files private: download a copy and upload it instead.
                </p>
              </div>
            </div>
            <label className="mt-5 block text-sm font-medium text-[#354157]">
              Google Drive sharing link
              <input
                required
                type="url"
                value={form.driveUrl}
                onChange={(event) =>
                  setForm({ ...form, driveUrl: event.target.value })
                }
                placeholder="https://docs.google.com/document/d/..."
                className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] bg-white px-3.5 outline-none placeholder:text-[#a7afbb] focus:border-[#7190ee] focus:ring-4 focus:ring-[#3158d8]/10"
              />
            </label>
            <p className="mt-3 text-[11px] leading-5 text-[#7a8698]">
              Supported now: Google Docs, Google Sheets, TXT, CSV, and JSON
              files up to 10 MB. Opryn only reads the file you share.
            </p>
          </div>
        ) : mode === "video" ? (
          <div className="order-2 p-5 sm:p-7">
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept=".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm"
              onChange={(event) => {
                updateFile(event.target.files?.[0] ?? null);
                setRetryJob(null);
                setError("");
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex min-h-40 w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#bcc8d7] bg-[#fafbfd] px-5 text-center hover:border-[#7893e5] hover:bg-[#f7f9ff]"
            >
              <Video className="size-6 text-[#3158d8]" />
              <span className="mt-3 text-sm font-semibold">
                {file ? file.name : "Choose a process video"}
              </span>
              <span className="mt-1 text-xs text-[#7a8698]">
                MP4, MOV, or WEBM · up to 100 MB
              </span>
              {file ? (
                <span className="mt-2 text-xs font-medium text-[#3158d8]">
                  {(file.size / 1024 / 1024).toFixed(1)} MB · Choose another
                </span>
              ) : null}
            </button>
          </div>
        ) : mode === "text" ? (
          <label className="order-2 block p-5 text-sm font-medium text-[#354157] sm:p-7">
            Explain it naturally
            <textarea
              required
              value={form.explanation}
              onChange={(event) =>
                setForm({ ...form, explanation: event.target.value })
              }
              rows={12}
              placeholder="Type the answer exactly as you would explain it to an employee. Include the steps, rules, exceptions, and who needs to approve anything."
              className="mt-2 w-full resize-y rounded-2xl border border-[#d9e0e9] bg-[#fbfcfe] p-4 text-base leading-7 outline-none placeholder:text-[#a0a9b6] focus:border-[#7190ee] focus:bg-white focus:ring-4 focus:ring-[#3158d8]/10"
            />
          </label>
        ) : (
          <div className="order-2 m-5 overflow-hidden rounded-2xl border border-[#dfe5ed] bg-[#f8fafd] sm:m-7">
            <div className="flex flex-col items-center px-5 py-7 text-center sm:px-8">
              {previewUrl && mode === "screen" && !recording ? (
                <video
                  controls
                  preload="metadata"
                  src={previewUrl}
                  className="mb-6 max-h-72 w-full rounded-xl bg-[#0d1729]"
                >
                  Your browser does not support video playback.
                </video>
              ) : null}
              {countdown ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="mb-5 grid size-20 place-items-center rounded-full bg-[#3158d8] text-3xl font-semibold text-white shadow-[0_16px_35px_rgba(49,88,216,.25)]"
                >
                  {countdown}
                </div>
              ) : null}
              <button
                type="button"
                disabled={Boolean(countdown)}
                onClick={() =>
                  recording
                    ? stopVoiceRecording()
                    : mode === "screen"
                      ? void startScreenRecording()
                      : void startVoiceRecording()
                }
                aria-label={
                  recording
                    ? "Stop recording"
                    : countdown
                      ? "Recording starts soon"
                      : mode === "screen"
                        ? "Start screen recording"
                        : "Start recording"
                }
                className={`grid size-16 place-items-center rounded-full text-white shadow-[0_12px_28px_rgba(49,88,216,.24)] transition hover:scale-105 active:scale-95 disabled:cursor-wait disabled:opacity-50 ${recording ? "bg-[#c14c55]" : "bg-[#3158d8]"}`}
              >
                {recording ? (
                  <Square className="size-5" fill="currentColor" />
                ) : mode === "screen" ? (
                  <MonitorUp className="size-6" />
                ) : (
                  <Mic className="size-6" />
                )}
              </button>
              <p className="mt-4 text-sm font-semibold text-[#334055]">
                {recording
                  ? paused
                    ? "Recording paused"
                    : "Explain the process as if you were showing a teammate"
                  : countdown
                    ? "Get ready to explain what you are doing"
                    : file
                      ? mode === "screen"
                        ? "Your screen recording is ready"
                        : "Your voice explanation is ready"
                      : mode === "screen"
                        ? "Share a screen or browser tab"
                        : "Tap to start explaining"}
              </p>
              <p className="mt-1 text-xs text-[#7a8698]">
                {recording
                  ? "Include the steps, decisions, exceptions, and approvals."
                  : file
                    ? "Opryn will transcribe this and prepare a process for review."
                    : mode === "screen"
                      ? "Explain what you are doing while Opryn watches the workflow."
                      : "Speak naturally. You do not need a script."}
              </p>
              <div
                aria-label="Live microphone level"
                className="mt-6 flex h-12 w-full max-w-lg items-center justify-center gap-[3px] overflow-hidden rounded-xl bg-white px-4 shadow-sm"
              >
                {audioBars.map((height, index) => (
                  <i
                    key={index}
                    className={`w-[2px] rounded-full transition-[height] duration-75 ${recording && !paused ? "bg-[#5674dd]" : file ? "bg-[#9aace4]" : "bg-[#d8dee8]"}`}
                    style={{
                      height: `${recording && !paused ? height : file ? Math.max(height, 7) : 4}px`,
                    }}
                  />
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span
                  className={`font-mono text-xs font-semibold ${recording ? "text-[#c14c55]" : "text-[#687487]"}`}
                >
                  {formatDuration(recordingSeconds)}
                </span>
                {recording ? (
                  <>
                    <button
                      type="button"
                      onClick={toggleRecordingPause}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[#dce2ea] bg-white px-3 text-xs font-semibold text-[#526075] hover:border-[#aebbd0]"
                    >
                      {paused ? (
                        <Play className="size-3.5" />
                      ) : (
                        <Pause className="size-3.5" />
                      )}
                      {paused ? "Resume" : "Pause"}
                    </button>
                    {mode === "screen" ? (
                      <button
                        type="button"
                        disabled={paused}
                        onClick={() =>
                          setStepMarkers((current) => [
                            ...current,
                            recordingSeconds,
                          ])
                        }
                        className="inline-flex min-h-9 items-center rounded-lg border border-[#dce2ea] bg-white px-3 text-xs font-semibold text-[#526075] hover:border-[#aebbd0] disabled:opacity-50"
                      >
                        Mark step
                        {stepMarkers.length ? ` · ${stepMarkers.length}` : ""}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={cancelVoiceRecording}
                      className="text-xs font-semibold text-[#718095] hover:text-[#344052]"
                    >
                      Cancel
                    </button>
                  </>
                ) : file ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#177257]">
                      <CheckCircle2 className="size-3.5" /> Recorded
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        mode === "screen"
                          ? void startScreenRecording()
                          : void startVoiceRecording()
                      }
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#718095] hover:text-[#344052]"
                    >
                      <RotateCcw className="size-3.5" /> Record again
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </section>
      <details className="group rounded-2xl border border-[#dfe5ed] bg-white">
        <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-[#455269] marker:content-none sm:px-6">
          <span className="flex items-center justify-between gap-4">
            Add optional details
            <span className="text-xs font-normal text-[#8792a2] group-open:hidden">
              Description · role
            </span>
            <span className="hidden text-xs font-normal text-[#8792a2] group-open:inline">
              Hide
            </span>
          </span>
        </summary>
        <div className="grid gap-5 border-t border-[#edf0f4] p-5 sm:grid-cols-2 sm:p-6">
          <Field
            label="Description (optional)"
            value={form.description}
            onChange={(description) => setForm({ ...form, description })}
            placeholder="What this process covers"
            className="sm:col-span-2"
          />
          <label className="block text-sm font-medium text-[#354157] sm:col-span-2">
            Who needs this? (optional)
            <select
              value={form.roleId}
              onChange={(event) =>
                setForm({ ...form, roleId: event.target.value })
              }
              className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] bg-white px-3.5 outline-none focus:border-[#7190ee]"
            >
              <option value="">Everyone</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
      {error ? (
        <div
          role="alert"
          className="rounded-xl bg-[#fff0f1] p-4 text-sm text-[#a83f49]"
        >
          <p>{error}</p>
          {retryJob ? (
            <button
              type="button"
              onClick={() => void retryProcessing()}
              className="mt-3 rounded-lg bg-[#a83f49] px-3.5 py-2 text-xs font-semibold text-white"
            >
              Retry processing
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="flex justify-end">
        <button
          disabled={recording}
          className="opryn-action min-h-12 px-6 disabled:cursor-not-allowed disabled:bg-[#aeb9d7]"
        >
          {recording ? "Finish recording first" : "Teach Opryn"}
        </button>
      </div>
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </form>
  );
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function ModeButton({
  active,
  onClick,
  icon,
  title,
  note,
  premium = false,
  locked = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  note: string;
  premium?: boolean;
  locked?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={note}
      aria-pressed={active}
      className={`inline-flex min-h-11 items-center gap-2 rounded-[9px] border px-3.5 text-xs font-semibold ${active ? "border-[var(--opryn-blue)] bg-[var(--opryn-blue-surface)] text-[var(--opryn-blue)] shadow-[inset_0_-2px_0_var(--opryn-blue)]" : "border-[var(--opryn-line)] bg-white text-[#56647a] hover:border-[#9eb5d4] hover:text-[var(--opryn-blue)]"}`}
    >
      <span aria-hidden="true">
        {locked ? <Lock className="size-4" /> : icon}
      </span>
      <span>{title}</span>
      {premium ? <span className="opryn-premium-label">Premium</span> : null}
      <span className="sr-only">{note}</span>
    </button>
  );
}
function Field({
  label,
  value,
  onChange,
  placeholder,
  className = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={`block text-sm font-medium text-[#354157] ${className}`}>
      {label}
      <input
        required={label === "Process title" || label === "Give it a clear name"}
        className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] px-3.5 outline-none placeholder:text-[#a7afbb] focus:border-[#7190ee] focus:ring-4 focus:ring-[#3158d8]/10"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
