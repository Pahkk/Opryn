"use client";
import { useId, useState } from "react";
import { industries, searchIndustries } from "@/lib/onboarding/industries";
import type { CompanyProfile } from "@/lib/activation";
export function IndustryPicker({
  value,
  onChange,
  onHelp,
  helping = false,
}: {
  value: CompanyProfile;
  onChange: (v: CompanyProfile) => void;
  onHelp?: (query: string) => void;
  helping?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const matches = searchIndustries(query);
  const results = matches.length
    ? matches
    : [industries[industries.length - 1]];
  function choose(item: (typeof industries)[number]) {
    onChange({
      ...value,
      industry: item.displayName,
      normalizedIndustryId: item.id,
      customIndustryLabel: "",
    });
    setQuery("");
    setOpen(false);
  }
  return (
    <div
      className="setup-industry"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id}>Industry</label>
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        placeholder="Search or describe your industry…"
        value={open ? query : value.industry}
        maxLength={150}
        onFocus={() => {
          setOpen(true);
          setQuery("");
          setActive(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
            setActive(
              (i) =>
                (i + (e.key === "ArrowDown" ? 1 : results.length - 1)) %
                results.length,
            );
          }
          if (e.key === "Enter" && open) {
            e.preventDefault();
            choose(results[active]);
          }
        }}
      />
      {open && (
        <ul id={`${id}-options`} role="listbox" aria-label="Industries">
          {results.map((item, i) => (
            <li
              key={item.id}
              id={`${id}-${i}`}
              role="option"
              aria-selected={active === i}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(item)}
            >
              {item.displayName}
              {query && i === 0 && <small>Suggested match</small>}
            </li>
          ))}
        </ul>
      )}
      {value.normalizedIndustryId === "other" && (
        <label>
          Custom industry <small>Optional</small>
          <input
            maxLength={100}
            value={value.customIndustryLabel}
            onChange={(e) =>
              onChange({
                ...value,
                customIndustryLabel: e.target.value,
                industry: e.target.value || "Other",
              })
            }
          />
        </label>
      )}
      <small>
        Search matches a curated list. Opryn Suggestions can help with ambiguous
        descriptions.
      </small>
      {onHelp && (
        <button
          type="button"
          className="setup-field-help"
          disabled={helping}
          onClick={() => {
            setOpen(false);
            onHelp(query || value.industry);
          }}
        >
          Help me choose →
        </button>
      )}
    </div>
  );
}
