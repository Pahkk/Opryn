"use client";
import { DialogSurface } from "@/components/app/dialog-surface";
import { WorkspaceNotice } from "@/components/app/workspace-context";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ExternalLink, X } from "lucide-react";
import { getCredentialGuide } from "@/lib/integrations/guides";
import type { IntegrationCatalogItem } from "@/lib/integrations/types";

export function CredentialConnectionButton({
  provider,
  connected = false,
  onConnected,
  label,
  className = "",
}: {
  provider: Pick<
    IntegrationCatalogItem,
    "id" | "name" | "description" | "permissions"
  >;
  connected?: boolean;
  onConnected?: (providerId: string) => void;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const guide = getCredentialGuide(provider);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [credentials, setCredentials] = useState<Record<string, string>>({});

  async function save() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/integrations/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ provider: provider.id, credentials }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(body.error || "Opryn couldn't save this connection.");
      setSuccess(true);
      setCredentials({});
      onConnected?.(provider.id);
      window.setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        router.refresh();
      }, 900);
    } catch (connectionError) {
      setError(
        connectionError instanceof Error
          ? connectionError.message
          : "Opryn couldn't save this connection.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`opryn-secondary-action whitespace-nowrap ${className}`}
      >
        {label ?? (connected ? "Update setup" : "Setup guide")}
      </button>
      {open ? (
        <DialogSurface
          onClose={() => setOpen(false)}
          labelledBy={`connect-${provider.id}-title`}
          busy={busy}
        >
          <div className="dialog-content w-full rounded-[24px] bg-white p-6 shadow-[var(--opryn-shadow-lg)] sm:max-w-[680px] sm:p-8">
            <WorkspaceNotice action="Connecting to" />
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold text-[#146bff]">
                  Owner-managed connection
                </p>
                <h2
                  id={`connect-${provider.id}-title`}
                  className="mt-2 text-3xl font-semibold tracking-[-.045em]"
                >
                  {guide.title}
                </h2>
                <p className="mt-3 text-sm leading-6 text-[#65748a]">
                  {guide.intro}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-[#edf1f6]"
                aria-label="Close connection guide"
              >
                <X size={18} />
              </button>
            </div>
            {success ? (
              <div
                className="mt-8 border-y border-[#dfe5ed] py-8 text-center"
                role="status"
              >
                <span className="mx-auto grid size-11 place-items-center rounded-full bg-[#146bff] text-white">
                  <Check size={20} />
                </span>
                <h3 className="mt-4 text-xl font-semibold">Connection saved</h3>
                <p className="mt-2 text-sm text-[#65748a]">
                  Opryn stored these details securely for this business.
                </p>
              </div>
            ) : (
              <>
                <div className="mt-7 border-y border-[#dfe5ed] py-6">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold">How to connect</h3>
                    <a
                      href={guide.portalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#cbd5e2] px-3 text-xs font-semibold hover:border-[#146bff]"
                    >
                      {guide.portalLabel}
                      <ExternalLink size={14} />
                    </a>
                  </div>
                  <ol className="mt-5 space-y-3 text-sm leading-6 text-[#526176]">
                    {guide.steps.map((step, index) => (
                      <li
                        key={step}
                        className="grid grid-cols-[24px_1fr] gap-3"
                      >
                        <span className="font-semibold text-[#146bff]">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <form
                  className="mt-6 space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void save();
                  }}
                >
                  <h3 className="font-semibold">Add your connection details</h3>
                  {guide.fields.map((field) => (
                    <label
                      key={field.key}
                      className="block text-sm font-medium text-[#243750]"
                    >
                      {field.label}
                      {field.required ? " *" : ""}
                      {field.type === "textarea" ? (
                        <textarea
                          value={credentials[field.key] ?? ""}
                          onChange={(event) =>
                            setCredentials((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                          placeholder={field.placeholder}
                          required={field.required}
                          rows={6}
                          autoComplete="off"
                          className="mt-2 w-full rounded-[8px] border border-[#cbd5e2] bg-white px-3 py-3 font-mono text-xs outline-none focus:border-[#146bff]"
                        />
                      ) : field.type === "select" ? (
                        <select
                          value={credentials[field.key] ?? ""}
                          onChange={(event) =>
                            setCredentials((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                          required={field.required}
                          className="mt-2 min-h-11 w-full rounded-[8px] border border-[#cbd5e2] bg-white px-3 outline-none focus:border-[#146bff]"
                        >
                          <option value="">Choose one</option>
                          {field.options?.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type ?? "text"}
                          value={credentials[field.key] ?? ""}
                          onChange={(event) =>
                            setCredentials((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                          placeholder={field.placeholder}
                          required={field.required}
                          autoComplete="off"
                          className="mt-2 min-h-11 w-full rounded-[8px] border border-[#cbd5e2] bg-white px-3 outline-none focus:border-[#146bff]"
                        />
                      )}
                      {field.help ? (
                        <span className="mt-1 block text-xs font-normal leading-5 text-[#7b8799]">
                          {field.help}
                        </span>
                      ) : null}
                    </label>
                  ))}
                  <p className="text-xs leading-5 text-[#65748a]">
                    Credentials are encrypted before storage, never returned to
                    the browser, and can be removed by disconnecting.
                  </p>
                  {error ? (
                    <p
                      className="text-sm font-medium text-[#a53943]"
                      role="alert"
                    >
                      {error}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="min-h-11 px-4 text-sm font-semibold text-[#65748a]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={busy}
                      className="min-h-11 rounded-[8px] bg-[#146bff] px-5 text-sm font-semibold text-white disabled:opacity-55"
                    >
                      {busy ? "Saving securely…" : "Save connection"}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </DialogSurface>
      ) : null}
    </>
  );
}

export function DisconnectCredentialConnection({
  integrationId,
  providerName,
}: {
  integrationId: string;
  providerName: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function disconnect() {
    setBusy(true);
    const response = await fetch(`/api/integrations/auth/${integrationId}`, {
      method: "DELETE",
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok)
      return setError(body.error || "Opryn couldn't disconnect this account.");
    setConfirming(false);
    router.refresh();
  }
  return confirming ? (
    <div className="flex flex-col items-end gap-2">
      <p className="max-w-xs text-right text-xs text-[#65748a]">
        Disconnect {providerName}? Existing Opryn knowledge will remain.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="min-h-9 px-3 text-xs font-semibold"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void disconnect()}
          disabled={busy}
          className="min-h-9 rounded-[7px] bg-[#9f3741] px-3 text-xs font-semibold text-white"
        >
          {busy ? "Disconnecting…" : "Disconnect"}
        </button>
      </div>
      {error ? <p className="text-xs text-[#a53943]">{error}</p> : null}
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="min-h-10 px-3 text-xs font-semibold text-[#7b8799]"
    >
      Disconnect
    </button>
  );
}

export function AddSoftwareConnection() {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const id = `custom_${trimmed
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60)}`;
  const provider = {
    id,
    name: trimmed || "Your software",
    description:
      "Add a restricted API credential for software that is not listed above.",
    permissions: {
      can: ["Use only the account and credential you provide"],
      cannot: ["Change company policy", "Access another Opryn organization"],
      privacy:
        "Opryn encrypts this credential and keeps it scoped to this business.",
    },
  };
  return (
    <div className="mt-5 flex max-w-xl flex-col gap-3 sm:flex-row">
      <label className="sr-only" htmlFor="custom-software-name">
        Software name
      </label>
      <input
        id="custom-software-name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Enter software name"
        className="min-h-11 flex-1 rounded-[8px] border border-[#cbd5e2] bg-white px-3 outline-none focus:border-[#146bff]"
      />
      {trimmed && id !== "custom_" ? (
        <CredentialConnectionButton provider={provider} />
      ) : (
        <button
          type="button"
          disabled
          className="opryn-secondary-action opacity-50"
        >
          Setup guide
        </button>
      )}
    </div>
  );
}
