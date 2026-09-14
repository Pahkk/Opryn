"use client";
import "./picker.css";

import { useEffect, useRef, useState } from "react";

type PickerDocument = { id?: string };
type PickerInstance = { setVisible(value: boolean): void; dispose(): void };
type PickerBuilder = {
  addView(view: unknown): PickerBuilder;
  enableFeature(feature: string): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setOrigin(origin: string): PickerBuilder;
  setCallback(callback: (data: Record<string, unknown>) => void): PickerBuilder;
  build(): PickerInstance;
};
type GooglePickerNamespace = {
  Action: { PICKED: string; CANCEL: string };
  Response: { ACTION: string; DOCUMENTS: string };
  ViewId: { DOCS: string };
  Feature: { MULTISELECT_ENABLED: string; SUPPORT_DRIVES: string };
  DocsView: new (viewId: string) => {
    setIncludeFolders(value: boolean): unknown;
    setSelectFolderEnabled(value: boolean): unknown;
    setMimeTypes(value: string): unknown;
  };
  PickerBuilder: new () => PickerBuilder;
};

declare global {
  interface Window {
    gapi?: { load(name: string, callback: () => void): void };
    google?: { picker: GooglePickerNamespace };
  }
}

let pickerLoader: Promise<void> | null = null;
function loadPicker() {
  if (window.google?.picker) return Promise.resolve();
  if (pickerLoader) return pickerLoader;
  pickerLoader = new Promise((resolve, reject) => {
    const timeout = window.setTimeout(
      () =>
        reject(
          new Error("Google file selection took too long to open. Try again."),
        ),
      15000,
    );
    const ready = () => {
      if (!window.gapi) return reject(new Error("Google Picker did not load."));
      window.gapi.load("picker", () => {
        window.clearTimeout(timeout);
        resolve();
      });
    };
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-opryn-google-picker="true"]',
    );
    if (existing) {
      if (window.gapi) ready();
      else existing.addEventListener("load", ready, { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.async = true;
    script.dataset.oprynGooglePicker = "true";
    script.onload = ready;
    script.onerror = () => reject(new Error("Google Picker did not load."));
    document.head.appendChild(script);
  });
  return pickerLoader;
}

export function GoogleWorkspacePicker({
  connectionId,
  onSelected,
  label = "Choose files",
  className = "opryn-action",
  autoOpen = false,
}: {
  connectionId: string;
  onSelected: (fileIds: string[]) => void | Promise<void>;
  label?: string;
  className?: string;
  autoOpen?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const opening = useRef(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const hostDialog = useRef<HTMLDialogElement | null>(null);
  const instance = useRef<PickerInstance | null>(null);
  const started = useRef(false);
  const mounted = useRef(true);
  const scrollPosition = useRef(0);

  function hideHostDialog() {
    const dialog = buttonRef.current?.closest("dialog");
    if (!dialog?.open) return;
    hostDialog.current = dialog;
    scrollPosition.current = window.scrollY;
    dialog.close();
    window.scrollTo({ top: scrollPosition.current, behavior: "instant" });
  }

  function restoreHostDialog() {
    const dialog = hostDialog.current;
    hostDialog.current = null;
    if (!dialog?.isConnected || dialog.open) return;
    dialog.showModal();
    buttonRef.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    mounted.current = true;
    // Load the Picker SDK while the user reads the sheet so selection can open
    // immediately after the credential request completes.
    void loadPicker().catch(() => {
      pickerLoader = null;
    });
    return () => {
      mounted.current = false;
      instance.current?.dispose();
      instance.current = null;
      restoreHostDialog();
    };
  }, []);

  useEffect(() => {
    if (autoOpen && !started.current) {
      started.current = true;
      buttonRef.current?.click();
    }
  }, [autoOpen]);

  async function open() {
    if (opening.current) return;
    opening.current = true;
    setBusy(true);
    setError("");
    try {
      const [response] = await Promise.all([
        fetch(`/api/integrations/nango/${connectionId}/picker`, {
          cache: "no-store",
          signal: AbortSignal.timeout(15000),
        }),
        loadPicker(),
      ]);
      const credential = await response.json();
      if (!mounted.current) return;
      if (!response.ok)
        throw new Error(
          credential.error ?? "Google file selection could not start.",
        );
      const picker = window.google?.picker;
      if (!picker) throw new Error("Google file selection could not start.");
      const view = new picker.DocsView(picker.ViewId.DOCS);
      view.setIncludeFolders(false);
      view.setSelectFolderEnabled(false);
      view.setMimeTypes(
        [
          "application/vnd.google-apps.document",
          "application/vnd.google-apps.spreadsheet",
          "application/vnd.google-apps.presentation",
        ].join(","),
      );
      const built = new picker.PickerBuilder()
        .addView(view)
        .enableFeature(picker.Feature.MULTISELECT_ENABLED)
        .enableFeature(picker.Feature.SUPPORT_DRIVES)
        .setOAuthToken(credential.accessToken)
        .setDeveloperKey(credential.developerKey)
        .setAppId(credential.appId)
        .setOrigin(window.location.origin)
        .setCallback(async (data: Record<string, unknown>) => {
          const action = data[picker.Response.ACTION];
          if (action === picker.Action.CANCEL) {
            instance.current?.setVisible(false);
            restoreHostDialog();
            buttonRef.current?.focus({ preventScroll: true });
            opening.current = false;
            setBusy(false);
            return;
          }
          if (action !== picker.Action.PICKED) return;
          instance.current?.setVisible(false);
          restoreHostDialog();
          buttonRef.current?.focus({ preventScroll: true });
          try {
            const documents = (data[picker.Response.DOCUMENTS] ??
              []) as PickerDocument[];
            const fileIds = documents.flatMap((document) =>
              document.id ? [document.id] : [],
            );
            if (!fileIds.length)
              throw new Error("Choose at least one Google file.");
            const save = await fetch(
              `/api/integrations/nango/${connectionId}/files`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileIds }),
              },
            );
            const result = await save.json();
            if (!save.ok)
              throw new Error(
                result.error ?? "Those files could not be selected.",
              );
            await onSelected(fileIds);
          } catch (selectionError) {
            setError(
              selectionError instanceof Error
                ? selectionError.message
                : "Those files could not be selected.",
            );
          } finally {
            restoreHostDialog();
            opening.current = false;
            setBusy(false);
          }
        })
        .build();
      // A native modal dialog always renders above Picker's iframe regardless
      // of z-index. Yield the top layer only once Picker is ready to display.
      hideHostDialog();
      instance.current?.dispose();
      instance.current = built;
      built.setVisible(true);
    } catch (pickerError) {
      restoreHostDialog();
      opening.current = false;
      setBusy(false);
      setError(
        pickerError instanceof Error
          ? pickerError.message
          : "Google file selection could not start.",
      );
    }
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={className}
        onClick={open}
        disabled={busy}
      >
        {busy ? "Opening Google…" : label}
      </button>
      {error ? (
        <p role="alert" className="connection-error">
          {error}
        </p>
      ) : null}
    </>
  );
}
