"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import { settingsSections, searchSettings } from "@/lib/settings-navigation";
import "./settings.css";

export function SettingsLayout({
  children,
  workspace,
  isAdmin,
}: {
  children: React.ReactNode;
  workspace: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const atIndex = pathname === "/app/settings";
  const sections = settingsSections(isAdmin);
  return (
    <div className="settings-shell">
      <header className="settings-header">
        <div>
          <h1>Settings</h1>
          <p>Your account, your preferences, and your workspace.</p>
        </div>
      </header>
      <label className="settings-search">
        <Search size={18} aria-hidden="true" />
        <span className="sr-only">Search settings</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search settings"
          type="search"
        />
      </label>
      {query.trim() ? (
        <section
          className="settings-results"
          aria-label="Settings search results"
        >
          <p className="settings-caption">Available to your account</p>
          {searchSettings(query, isAdmin).map((item) => (
            <Link
              key={item.id}
              href={`/app/settings/${item.id}`}
              onClick={() => setQuery("")}
            >
              <span>
                <strong>{item.title}</strong>
                <small>{item.description}</small>
              </span>
              <ArrowRight size={17} />
            </Link>
          ))}
          {!searchSettings(query, isAdmin).length ? (
            <p>No matching settings. Try “password”, “invite”, or “billing”.</p>
          ) : null}
        </section>
      ) : null}
      <div
        className={`settings-columns ${atIndex ? "settings-is-index" : ""}`}
        style={query.trim() ? { display: "none" } : undefined}
      >
        <nav className="settings-nav" aria-label="Settings sections">
          {["account", "workspace"].map((group) => {
            const items = sections.filter((item) => item.group === group);
            return items.length ? (
              <div key={group}>
                <p>
                  {group === "account"
                    ? "Your account"
                    : `Workspace · ${workspace}`}
                </p>
                {items.map((item) => (
                  <Link
                    key={item.id}
                    href={`/app/settings/${item.id}`}
                    aria-current={
                      pathname === `/app/settings/${item.id}`
                        ? "page"
                        : undefined
                    }
                  >
                    {item.title}
                  </Link>
                ))}
              </div>
            ) : null;
          })}
        </nav>
        <div
          className="settings-pane"
          data-guide={
            pathname === "/app/settings/profile"
              ? "settings.profile"
              : pathname === "/app/settings/notifications"
                ? "settings.notifications"
                : undefined
          }
        >
          {!atIndex ? (
            <Link className="settings-mobile-back" href="/app/settings">
              <ArrowLeft size={16} /> All settings
            </Link>
          ) : null}
          {children}
        </div>
      </div>
    </div>
  );
}
