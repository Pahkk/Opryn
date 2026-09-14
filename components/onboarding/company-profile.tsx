"use client";
import { useRef, useState } from "react";
import { knowledgeAreas, type CompanyProfile } from "@/lib/activation";
import { industries } from "@/lib/onboarding/industries";
import {
  setupSuggestionSchema,
  type SetupSuggestion,
} from "@/lib/onboarding/suggestions";
import { IndustryPicker } from "./industry-picker";
import { MotionRegion } from "@/components/motion/motion-region";

export function CompanyProfileFields({
  value,
  onChange,
  organizationId,
  goal = "",
}: {
  value: CompanyProfile;
  onChange: (value: CompanyProfile) => void;
  organizationId?: string;
  goal?: string;
}) {
  const [suggestion, setSuggestion] = useState<SetupSuggestion | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const pending = useRef(false);
  async function suggest(industryQuery = "") {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setAccepted(false);
    try {
      const response = await fetch("/api/onboarding/suggestions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(organizationId ? { "x-opryn-organization": organizationId } : {}),
        },
        body: JSON.stringify({
          description: value.description || industryQuery,
          goal,
          industryQuery,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSuggestion(setupSuggestionSchema.parse(data.suggestion));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Suggestions unavailable. Continue manually.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="activation-company-grid">
      <div className="activation-company-fields">
        <h2>Your company</h2>
        <label>
          Company name
          <input
            required
            maxLength={160}
            autoComplete="organization"
            value={value.name}
            onChange={(e) => onChange({ ...value, name: e.target.value })}
          />
        </label>
        <label>
          What does your company do?
          <textarea
            required
            placeholder="We build websites and marketing systems for small businesses."
            maxLength={2000}
            rows={3}
            value={value.description}
            onChange={(e) =>
              onChange({ ...value, description: e.target.value })
            }
          />
        </label>
        <div className="setup-assist-action">
          <button
            type="button"
            disabled={busy || value.description.trim().length < 5}
            onClick={() => void suggest()}
          >
            {busy ? "Preparing suggestions…" : "Help me set this up →"}
          </button>
          <small>
            Suggest an industry, clearer description and useful starting points.
            You decide what to use.
          </small>
          {error && (
            <p role="alert" className="activation-error">
              {error}
            </p>
          )}
        </div>
        <div className="activation-field-pair">
          <IndustryPicker
            value={value}
            onChange={onChange}
            helping={busy}
            onHelp={(query) => void suggest(query)}
          />
          <label>
            Company size
            <input
              type="number"
              required
              min={1}
              max={100000}
              value={value.employee_count}
              onChange={(e) =>
                onChange({ ...value, employee_count: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <label>
          Website <small>Optional</small>
          <input
            type="url"
            placeholder="https://"
            maxLength={2000}
            value={value.website}
            onChange={(e) => onChange({ ...value, website: e.target.value })}
          />
        </label>
        <label>
          Teams / departments <small>Optional</small>
          <input
            maxLength={500}
            placeholder="Operations, sales, support"
            value={value.departments}
            onChange={(e) =>
              onChange({ ...value, departments: e.target.value })
            }
          />
        </label>
        <h2>What should Opryn understand?</h2>
        <div className="activation-areas" aria-label="Knowledge areas">
          {knowledgeAreas.map((area) => (
            <button
              type="button"
              key={area}
              aria-pressed={value.knowledge_areas.includes(area)}
              onClick={() =>
                onChange({
                  ...value,
                  knowledge_areas: value.knowledge_areas.includes(area)
                    ? value.knowledge_areas.filter((a) => a !== area)
                    : [...value.knowledge_areas, area],
                })
              }
            >
              {area}
            </button>
          ))}
        </div>
        <p className="activation-note">
          <strong>Who approves company knowledge?</strong>
          <br />
          Workspace owners and admins. Expertise alone does not grant approval
          permission. Manage scoped expert permissions in Settings → Knowledge &
          Approvals.
        </p>
        <label>
          Anything else Opryn should know? <small>Optional</small>
          <textarea
            rows={2}
            maxLength={2000}
            value={value.notes}
            onChange={(e) => onChange({ ...value, notes: e.target.value })}
          />
        </label>
      </div>
      <aside
        className="activation-company-preview"
        aria-label="Company profile preview"
        data-suggested={!!suggestion}
        data-applied={accepted}
      >
        <p className="activation-eyebrow">Opryn suggestions</p>
        {suggestion ? (
          <MotionRegion variant="quiet">
            <h2>A useful place to start.</h2>
            <div className="setup-suggestion-copy">
              <p>{suggestion.explanation}</p>
              <small>DESCRIPTION · EDITABLE SUGGESTION</small>
              <p>{suggestion.description}</p>
              <small>INDUSTRY</small>
              <p>
                {
                  industries.find((i) => i.id === suggestion.industryId)
                    ?.displayName
                }
              </p>
              <small>KNOWLEDGE TO START WITH</small>
              <p>{suggestion.knowledgeAreas.join(" · ")}</p>
              <small>TEACH THIS FIRST</small>
              <p>{suggestion.firstQuestion}</p>
              <small>GOOD FIRST SOURCE</small>
              <p>
                {suggestion.firstSource === "google_workspace"
                  ? "Google Workspace"
                  : suggestion.firstSource === "upload"
                    ? "Upload"
                    : "Explain it"}{" "}
                — {suggestion.sourceReason}
              </p>
            </div>
            <button
              type="button"
              className="activation-primary"
              onClick={() => {
                onChange({
                  ...value,
                  description: suggestion.description,
                  industry: industries.find(
                    (i) => i.id === suggestion.industryId,
                  )!.displayName,
                  normalizedIndustryId: suggestion.industryId,
                  customIndustryLabel: "",
                  departments: suggestion.departments.join(", "),
                  knowledge_areas: suggestion.knowledgeAreas,
                  firstTeachQuestion: suggestion.firstQuestion,
                  recommendedSource: suggestion.firstSource,
                  sourceReason: suggestion.sourceReason,
                });
                setAccepted(true);
              }}
            >
              {accepted ? "Apply suggestions again" : "Use these suggestions"}
            </button>
            {accepted && (
              <p role="status">
                Applied to the form. Edit anything before saving.
              </p>
            )}
          </MotionRegion>
        ) : (
          <>
            <h2>Let’s make this yours.</h2>
            <p>
              Describe your business, then ask Opryn for a starting point. No
              policies or permissions change.
            </p>
            <div className="setup-suggestion-outline">
              <span>01 Industry & description</span>
              <span>02 Knowledge areas</span>
              <span>03 Your first useful question</span>
            </div>
          </>
        )}
        <div className="setup-profile-preview-content">
          <hr />
          <p className="activation-eyebrow">Company profile</p>
          <h2>{value.name || "Your company"}</h2>
          <p>{value.industry || "Your industry"}</p>
          <hr />
          <small>KNOWLEDGE AREAS</small>
          <p>
            {value.knowledge_areas.join(" · ") || "Choose what matters first"}
          </p>
          <small>REVIEW</small>
          <p>Workspace owners & admins</p>
          <hr />
          <p className="activation-note">
            Company context, not approved policy.
            <br />
            Edit later in Settings → Workspace → Company Profile.
          </p>
        </div>
      </aside>
    </div>
  );
}
