"use client";

import { useState } from "react";

export function CommunicationAccountLink({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState("");
  async function connect() {
    setState("loading");
    const response = await fetch("/api/integrations/communication/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    if (!response.ok) {
      setError(body.error || "Opryn couldn't connect this account.");
      setState("error");
      return;
    }
    setState("done");
  }
  if (state === "done")
    return (
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-[-.04em] text-[var(--opryn-navy)]">
          You&apos;re connected.
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--opryn-muted)]">
          Return to Slack and ask Opryn your question again.
        </p>
      </div>
    );
  return (
    <div className="text-center">
      <p className="opryn-section-label justify-center">Opryn Everywhere</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-[var(--opryn-navy)]">
        Connect this chat account?
      </h1>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[var(--opryn-muted)]">
        Opryn will use your existing team role and permissions. It will only
        process messages sent directly to Opryn or mentions of Opryn.
      </p>
      {error ? (
        <p role="alert" className="mt-4 text-sm text-[var(--opryn-coral)]">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={state === "loading"}
        onClick={connect}
        className="opryn-action mt-6"
      >
        {state === "loading" ? "Connecting…" : "Connect Account"}
      </button>
    </div>
  );
}
