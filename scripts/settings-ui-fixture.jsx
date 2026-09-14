// Local browser fixture: real components, synthetic identity and explicit API doubles.
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "../components/app/app-shell";
import { SettingsLayout } from "../components/app/settings/settings-layout";
import {
  AccountForm,
  AccountSecurity,
} from "../components/app/settings/account-forms";
import { WorkspaceForm } from "../components/app/settings/workspace-form";
import { SettingsHeading } from "../components/app/settings/primitives";
import { BillingSettings } from "../components/app/billing-settings";
import { SETTINGS_SECTIONS } from "../lib/settings-navigation";
const org = "20000000-0000-4000-8000-000000000001";
const initialWorkspace = {
  name: "Example workspace",
  industry: "Professional services",
  employee_count: 5,
  description: "A fixture business for component testing.",
  default_timezone: "UTC",
  employees_can_ask: true,
  allow_escalations: true,
  confidence_threshold: 0.72,
  estimated_interruption_minutes: 3,
  expert_answers_require_admin_approval: true,
  ai_process_creation: "auto_draft",
  ai_process_approval_prompt: "ask_immediately",
};
function Fixture() {
  const [account, setAccount] = useState(null);
  const section =
    location.pathname.replace(/\/$/, "").split("/").at(-1) || "settings";
  const isAdmin = !new URLSearchParams(location.search).has("employee");
  useEffect(() => {
    const load = () =>
      fetch("/__fixture/account")
        .then((r) => r.json())
        .then(setAccount);
    load();
    window.addEventListener("fixture-refresh", load);
    return () => window.removeEventListener("fixture-refresh", load);
  }, []);
  if (!account) return <p>Loading fixture</p>;
  const definition = SETTINGS_SECTIONS.find((item) => item.id === section);
  return (
    <AppShell
      organizationId={org}
      organizations={[
        { id: org, name: "Example workspace" },
        { id: "20000000-0000-4000-8000-000000000002", name: "Other workspace" },
      ]}
      organization={{ name: "Example workspace", logoUrl: null }}
      user={{
        fullName: account.display_name ?? "Alex Example",
        email: "alex@example.test",
        avatarUrl: null,
      }}
      preferences={account}
      isAdmin={isAdmin}
      plan="premium"
      notifications={[]}
      notificationCount={0}
      pendingApprovalCount={2}
      needsYouCount={2}
    >
      <SettingsLayout workspace="Example workspace" isAdmin={isAdmin}>
        {definition ? (
          <SettingsHeading
            title={definition.title}
            description={definition.description}
            scope={
              definition.group === "account"
                ? "Only affects your account"
                : "Workspace · Example workspace"
            }
          />
        ) : null}
        {["profile", "preferences", "notifications"].includes(section) ? (
          <AccountForm
            section={section}
            initial={account}
            fullName="Alex Example"
            email="alex@example.test"
            emailVerified
            avatarUrl={null}
            workspace="Example workspace"
            permission={isAdmin ? "owner" : "employee"}
            jobTitle="Operations lead"
          />
        ) : null}
        {["general", "knowledge"].includes(section) ? (
          <WorkspaceForm
            section={section}
            initial={initialWorkspace}
            revision={1}
            organizationId={org}
            logoUrl={null}
          />
        ) : null}
        {section === "security" ? (
          <AccountSecurity
            providers={
              new URLSearchParams(location.search).has("google")
                ? ["google"]
                : ["email"]
            }
            email="alex@example.test"
            lastSignIn="Sep 12, 2026, 9:30 AM"
          />
        ) : null}
        {section === "billing" ? (
          <BillingSettings
            plan="premium"
            interval="month"
            status="active"
            hasSubscription
            hasStripeCustomer
            billingReady
            periodEnd="2026-10-12T00:00:00Z"
            cancelAtPeriodEnd={false}
          />
        ) : null}
        {section === "settings"
          ? SETTINGS_SECTIONS.filter(
              (item) => isAdmin || item.group === "account",
            ).map((item) => (
              <a
                className="settings-index-link"
                key={item.id}
                href={`/app/settings/${item.id}`}
              >
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>
              </a>
            ))
          : null}
      </SettingsLayout>
    </AppShell>
  );
}
createRoot(document.getElementById("root")).render(<Fixture />);
