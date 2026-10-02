"use client";
import { useState } from "react";
import { ProviderLogo } from "@/components/connections/provider-logo";
import { marketingIntegrations } from "@/lib/marketing/integrations";
import { StaggerList } from "@/components/motion/motion-region";
import { MotionTabs, ActiveIndicator } from "@/components/motion/motion-tabs";
import { MotionPanel } from "@/components/motion/motion-panel";
import { PublicAction } from "./public-motion";
export function HomeIntegrations() {
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const items = marketingIntegrations.filter(
    (p) =>
      [
        "google_drive",
        "files",
        "slack",
        "teams",
        "chatgpt",
        "custom_agent",
      ].includes(p.id) &&
      (filter === "all" || p.direction === filter),
  );
  return (
    <div className="integration-ledger">
      <MotionTabs>
        <div
          className="home-integration-filters"
          role="group"
          aria-label="Connection purpose"
        >
          {[
            ["all", "All"],
            ["learn", "Learn from"],
            ["use", "Use Opryn in"],
          ].map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-pressed={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
              {filter === id && <ActiveIndicator />}
            </button>
          ))}
        </div>
      </MotionTabs>
      <StaggerList changeKey={filter}>
        {items.map((p) => (
          <div key={p.id} className="home-integration-item">
            <button
              type="button"
              className="integration-ledger-row"
              aria-expanded={open === p.id}
              aria-controls={`home-integration-${p.id}`}
              onClick={() => setOpen(open === p.id ? null : p.id)}
            >
              <ProviderLogo id={p.id} name={p.name} />
              <span>
                <strong>{p.name}</strong>
                <span className="home-integration-purpose">{p.purpose}</span>
              </span>
              <span className="integration-status">
                {p.status}
                <span aria-hidden="true"> {open === p.id ? "−" : "+"}</span>
              </span>
            </button>
            <MotionPanel open={open === p.id}>
              <div
                id={`home-integration-${p.id}`}
                className="home-integration-detail"
              >
                <p>{p.detail}</p>
                <PublicAction href={p.href} variant="text">
                  Explore {p.name}
                </PublicAction>
              </div>
            </MotionPanel>
          </div>
        ))}
      </StaggerList>
      <PublicAction href="/integrations" variant="text" rolling>
        Explore integrations
      </PublicAction>
    </div>
  );
}
