"use client";
import { useState } from "react";
import { CompanyProfileFields } from "@/components/onboarding/company-profile";
import { emptyCompany, type CompanyProfile } from "@/lib/activation";
import { useUnsavedChanges } from "./form-state";
import "@/components/onboarding/activation.css";
export function CompanyProfileForm({
  initial,
  revision: initialRevision,
  organizationId,
}: {
  initial: CompanyProfile;
  revision: number;
  organizationId: string;
}) {
  const [value, setValue] = useState({ ...emptyCompany, ...initial }),
    [saved, setSaved] = useState(value),
    [revision, setRevision] = useState(initialRevision);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  useUnsavedChanges(JSON.stringify(saved) !== JSON.stringify(value));
  return (
    <form
      className="settings-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError("");
        setMessage("");
        try {
          const r = await fetch("/api/onboarding/activation", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-opryn-organization": organizationId,
            },
            body: JSON.stringify({
              action: "company",
              revision,
              profile: value,
            }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          setRevision(d.revision);
          setSaved(value);
          setMessage("Company profile saved.");
        } catch (e) {
          setError(
            e instanceof Error ? e.message : "Could not save. Try again.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <CompanyProfileFields
          value={value}
          onChange={setValue}
          organizationId={organizationId}
        />
        <button
          className="settings-button primary"
          disabled={JSON.stringify(saved) === JSON.stringify(value)}
        >
          {busy ? "Saving…" : "Save company profile"}
        </button>
      </fieldset>
      {error && <p role="alert">{error}</p>}
      {message && <p role="status">{message}</p>}
    </form>
  );
}
