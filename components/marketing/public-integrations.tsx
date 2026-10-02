"use client";
import { useState } from "react";
import Link from "next/link";
import { ProviderLogo } from "@/components/connections/provider-logo";
import { marketingIntegrations } from "@/lib/marketing/integrations";
import { MotionTabs, ActiveIndicator } from "@/components/motion/motion-tabs";
import { StaggerList } from "@/components/motion/motion-region";

export function PublicIntegrations() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const matches = marketingIntegrations.filter(
    (p) =>
      (filter === "All" || p.category === filter) &&
      `${p.name} ${p.category} ${p.purpose} ${p.detail}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <div className="public-integrations-browser">
      <label className="public-search">
        <span>Search integrations</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search integrations"
        />
      </label>
      <MotionTabs>
        <div
          className="public-tabs"
          role="group"
          aria-label="Filter integrations"
        >
          {["All", "Knowledge", "Communication", "AI", "Calls"].map((name) => (
            <button
              key={name}
              aria-pressed={filter === name}
              onClick={() => setFilter(name)}
              style={{ position: "relative" }}
            >
              {name}
              {filter === name && <ActiveIndicator />}
            </button>
          ))}
          <Link href="/app/integrations">Your connections ↗</Link>
        </div>
      </MotionTabs>
      <p className="catalog-count" role="status">
        {matches.length} supported{" "}
        {matches.length === 1 ? "integration" : "integrations"}
      </p>
      {[
        ["learn", "Learn from", "Knowledge comes into Opryn."],
        ["use", "Use Opryn in", "Approved guidance is available elsewhere."],
      ].map(([direction, title, copy]) => {
        const items = matches.filter((p) => p.direction === direction);
        if (!items.length) return null;
        return (
          <section key={direction} className="integration-group">
            <header>
              <h2>{title}</h2>
              <p>{copy}</p>
            </header>
            <StaggerList changeKey={items.map((p) => p.id).join(",")}>
              {items.map((p) => (
                <div key={p.id} data-motion-row={p.id}>
                  <details className="public-provider" key={p.id} id={p.id}>
                    <summary>
                      <ProviderLogo id={p.id} name={p.name} />
                      <span className="provider-summary">
                        <strong>{p.name}</strong>
                        <span>{p.purpose}</span>
                        <small>
                          {p.category}
                          {direction === "learn" ? " source" : " access"}
                        </small>
                      </span>
                      <span className="provider-action">
                        <span>{p.status}</span>
                        <span className="provider-more">
                          Learn more <span aria-hidden>↘</span>
                        </span>
                      </span>
                    </summary>
                    <div className="provider-detail">
                      <p>{p.detail}</p>
                      <Link href={p.href}>
                        {p.href === "/signup"
                          ? "Get started"
                          : p.href === "/pricing"
                            ? "See Pro"
                            : p.href.startsWith("/contact")
                              ? "Talk about setup"
                              : p.href.startsWith("/docs")
                                ? "Read developer documentation"
                                : "Explore AI access"}{" "}
                        →
                      </Link>
                      <Link href="/security">Data handling →</Link>
                    </div>
                  </details>
                </div>
              ))}
            </StaggerList>
          </section>
        );
      })}
      {!matches.length && (
        <div className="catalog-empty">
          <h2>No integration found for “{query || filter}”.</h2>
          <p>Tell us what you use and what you want Opryn to do with it.</p>
        </div>
      )}
      <div className="public-callout">
        <h2>Can’t find what you use?</h2>
        <p>
          We add connections around useful workflows—not just authorization
          buttons.
        </p>
        <Link href="/contact?topic=Integration%20request">
          Request an integration →
        </Link>
      </div>
    </div>
  );
}
