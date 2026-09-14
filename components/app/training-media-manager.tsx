"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { showAppToast } from "@/lib/client-toast";

type TrainingImage = {
  id: string;
  url: string;
  caption: string;
  originalName: string;
};

export function TrainingMediaManager({
  processId,
  initialImages,
  videoUrl,
}: {
  processId: string;
  initialImages: TrainingImage[];
  videoUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [images, setImages] = useState(initialImages);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setBusy(true);
    setError("");
    let mediaId = "";
    try {
      const response = await fetch(
        `/api/processes/${processId}/training-media`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            type: file.type,
            size: file.size,
            caption,
          }),
        },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Unable to add this image.");
      mediaId = body.id;
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("training-media")
        .upload(body.storage_path, file, {
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;
      const { data } = await supabase.storage
        .from("training-media")
        .createSignedUrl(body.storage_path, 3600);
      if (!data?.signedUrl) throw new Error("Unable to display this image.");
      setImages((current) => [
        ...current,
        {
          id: body.id,
          url: data.signedUrl,
          caption: body.caption,
          originalName: body.original_name,
        },
      ]);
      setCaption("");
      if (inputRef.current) inputRef.current.value = "";
      showAppToast(
        "Training image added!",
        "Employees assigned to this process can now see it.",
      );
    } catch (caught) {
      if (mediaId)
        await fetch(`/api/processes/${processId}/training-media`, {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mediaId }),
        });
      setError(
        caught instanceof Error ? caught.message : "Unable to add this image.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(mediaId: string) {
    if (!window.confirm("Remove this image from the training process?")) return;
    setBusy(true);
    setError("");
    const response = await fetch(`/api/processes/${processId}/training-media`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mediaId }),
    });
    const body = await response.json();
    if (response.ok)
      setImages((current) => current.filter((item) => item.id !== mediaId));
    else setError(body.error ?? "Unable to remove this image.");
    setBusy(false);
  }

  return (
    <section className="mt-6 rounded-2xl border border-[#dfe5ed] bg-white p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.1em] text-[#3158d8]">
            Training media
          </p>
          <h2 className="mt-1 text-lg font-semibold">Show the work clearly</h2>
          <p className="mt-1 text-sm leading-6 text-[#718095]">
            {videoUrl
              ? "The source video is already included. Add screenshots or reference images where they help."
              : "Add screenshots or reference images employees should see while learning this process."}
          </p>
        </div>
        {videoUrl ? (
          <span className="w-fit rounded-full bg-[#eaf7f1] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.07em] text-[#177257]">
            Video included
          </span>
        ) : null}
      </div>

      {videoUrl ? (
        <video
          controls
          preload="metadata"
          src={videoUrl}
          className="mt-5 max-h-80 w-full rounded-xl bg-[#0d1729]"
        >
          Your browser does not support video playback.
        </video>
      ) : null}

      {images.length ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {images.map((image) => (
            <article
              key={image.id}
              className="overflow-hidden rounded-xl border border-[#e0e6ed] bg-[#fafbfd]"
            >
              <div className="relative aspect-video bg-[#edf0f4]">
                <Image
                  unoptimized
                  fill
                  sizes="(max-width: 640px) 100vw, 50vw"
                  src={image.url}
                  alt={image.caption || image.originalName}
                  className="object-contain"
                />
              </div>
              <div className="flex items-start gap-3 p-3">
                <p className="min-w-0 flex-1 text-xs leading-5 text-[#657286]">
                  {image.caption || image.originalName}
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(image.id)}
                  aria-label={`Remove ${image.originalName}`}
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-[#9a4650] hover:bg-[#fff0f1] disabled:opacity-50"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="text-sm font-medium text-[#455269]">
          Caption (optional)
          <input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            maxLength={500}
            placeholder="What should the employee notice?"
            className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] px-3.5 outline-none focus:border-[#7190ee] focus:ring-4 focus:ring-[#3158d8]/10"
          />
        </label>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#3158d8] px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          Add image
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-[#a83f49]">
          {error}
        </p>
      ) : null}
      <p className="mt-3 text-[11px] text-[#8792a2]">
        JPG, PNG, WEBP, or GIF · up to 5 MB
      </p>
    </section>
  );
}
