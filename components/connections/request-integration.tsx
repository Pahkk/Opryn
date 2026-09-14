"use client";
import { DialogSurface } from "@/components/app/dialog-surface";

import { useState } from "react";
import { Check, X } from "lucide-react";

export function RequestIntegration({
  defaultProviderName = "",
  buttonLabel = "Request Integration",
}: {
  defaultProviderName?: string;
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [providerName, setProviderName] = useState(defaultProviderName);
  const [useCase, setUseCase] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  function show() {
    setProviderName(defaultProviderName);
    setError("");
    setSent(false);
    setOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/integrations/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ providerName, useCase, followUpEmail: email }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(body.error || "Opryn couldn't save this request.");
      return;
    }
    setSent(true);
  }

  return (
    <>
      <button type="button" onClick={show} className="opryn-secondary-action">
        {buttonLabel}
      </button>
      {open ? (
        <DialogSurface
          onClose={() => setOpen(false)}
          labelledBy="request-integration-title"
          busy={busy}
        >
          <div className="dialog-content w-full rounded-[24px] border border-[var(--opryn-line)] bg-white p-6 shadow-[var(--opryn-shadow-lg)] sm:max-w-xl sm:p-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-bold text-[var(--opryn-blue)]">
                  Request an integration
                </p>
                <h2
                  id="request-integration-title"
                  className="mt-2 text-2xl font-semibold tracking-[-.04em] text-[var(--opryn-navy)]"
                >
                  What should Opryn connect to?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-11 shrink-0 place-items-center rounded-[11px] text-[var(--opryn-muted)] hover:bg-[var(--opryn-neutral)]"
                aria-label="Close integration request"
              >
                <X size={18} />
              </button>
            </div>

            {sent ? (
              <div className="py-10 text-center" role="status">
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-[#e9f2ff] text-[var(--opryn-blue)]">
                  <Check size={21} strokeWidth={2.5} />
                </span>
                <h3 className="mt-4 text-xl font-semibold text-[var(--opryn-navy)]">
                  Request received.
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--opryn-muted)]">
                  We&apos;ll use this to prioritize the connections businesses
                  actually need.
                </p>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="opryn-action mt-6"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={submit} className="mt-7 space-y-5">
                <label className="block text-sm font-semibold text-[var(--opryn-navy)]">
                  Software name
                  <input
                    value={providerName}
                    onChange={(event) => setProviderName(event.target.value)}
                    className="onboarding-input mt-2"
                    placeholder="ServiceTitan"
                    required
                  />
                </label>
                <label className="block text-sm font-semibold text-[var(--opryn-navy)]">
                  What would you want Opryn to do with it?
                  <textarea
                    value={useCase}
                    onChange={(event) => setUseCase(event.target.value)}
                    className="onboarding-input mt-2 min-h-28 resize-y"
                    placeholder="Bring in the procedures attached to our jobs…"
                    required
                  />
                </label>
                <label className="block text-sm font-semibold text-[var(--opryn-navy)]">
                  Follow-up email
                  <span className="ml-2 font-normal text-[var(--opryn-faint)]">
                    Optional
                  </span>
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="onboarding-input mt-2"
                    type="email"
                    autoComplete="email"
                  />
                </label>
                {error ? (
                  <p
                    className="text-sm font-medium text-[var(--opryn-coral)]"
                    role="alert"
                  >
                    {error}
                  </p>
                ) : null}
                <div className="flex justify-end gap-3 border-t border-[var(--opryn-line)] pt-5">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="min-h-11 px-4 text-sm font-semibold text-[var(--opryn-muted)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={
                      busy ||
                      providerName.trim().length < 2 ||
                      useCase.trim().length < 8
                    }
                    className="opryn-action disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "Sending…" : "Request Integration"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </DialogSurface>
      ) : null}
    </>
  );
}
