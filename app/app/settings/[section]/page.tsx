import Link from "next/link";
import { DeleteWorkspace } from "@/components/app/settings/delete-workspace";
import { CompanyProfileForm } from "@/components/app/settings/company-profile-form";
import { emptyCompany } from "@/lib/activation";
import { notFound, redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { requireAppContext } from "@/lib/app-context";
import { createClient } from "@/lib/supabase/server";
import { SETTINGS_SECTIONS } from "@/lib/settings-navigation";
import { getAccountSettings } from "@/lib/account-settings-server";
import {
  AccountForm,
  AccountSecurity,
} from "@/components/app/settings/account-forms";
import {
  WorkspaceForm,
  type WorkspaceValues,
} from "@/components/app/settings/workspace-form";
import {
  SettingsHeading,
  SettingsSection,
} from "@/components/app/settings/primitives";
import { BillingSettings } from "@/components/app/billing-settings";
import { billingConfigured } from "@/lib/billing/stripe";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { getTeamLimit } from "@/lib/billing/plans";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<{ billing?: string; page?: string }>;
}) {
  const { section } = await params;
  const definition = SETTINGS_SECTIONS.find((item) => item.id === section);
  if (!definition) notFound();
  const context = await requireAppContext();
  if (definition.group === "workspace" && !context.isAdmin)
    return (
      <SettingsHeading
        title="Workspace administrator access required"
        description="You can manage your personal account settings. Ask an owner or admin to change workspace settings."
      />
    );
  if (section === "members") redirect("/app/team");
  if (section === "connections") redirect("/app/integrations");
  const supabase = await createClient();
  const account = await getAccountSettings(context.user.id);
  const heading = (
    <SettingsHeading
      title={definition.title}
      description={definition.description}
      scope={
        definition.group === "workspace"
          ? `Workspace · ${context.organization.name}`
          : "Only affects your account"
      }
    />
  );
  if (
    section === "profile" ||
    section === "preferences" ||
    section === "notifications"
  ) {
    const { data: role, error } = context.membership.roleId
      ? await supabase
          .from("roles")
          .select("name")
          .eq("id", context.membership.roleId)
          .eq("organization_id", context.organization.id)
          .maybeSingle()
      : { data: null, error: null };
    if (error) throw new Error("Your membership details could not be loaded.");
    return (
      <>
        {heading}
        <AccountForm
          key={section}
          section={section}
          initial={account}
          fullName={context.user.fullName}
          email={context.user.email}
          emailVerified={Boolean(context.authUser.email_confirmed_at)}
          avatarUrl={context.user.avatarUrl}
          workspace={context.organization.name}
          permission={context.membership.permissionLevel}
          jobTitle={role?.name ?? null}
        />
      </>
    );
  }
  let activityTimezone = account.timezone;
  if (section === "activity" && !account.timezone_overridden) {
    const { data, error } = await supabase
      .from("organizations")
      .select("default_timezone")
      .eq("id", context.organization.id)
      .single();
    if (error) throw new Error("Workspace timezone could not be loaded.");
    activityTimezone = data.default_timezone;
  }
  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(account.locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: activityTimezone,
    }).format(new Date(date));
  if (section === "security")
    return (
      <>
        {heading}
        <AccountSecurity
          providers={[
            ...new Set(
              context.authUser.identities?.map(
                (identity) => identity.provider,
              ) ?? [],
            ),
          ]}
          email={context.user.email}
          lastSignIn={
            context.authUser.last_sign_in_at
              ? formatDate(context.authUser.last_sign_in_at)
              : null
          }
        />
      </>
    );
  if (section === "company") {
    const [company, settings] = await Promise.all([
      supabase
        .from("organizations")
        .select("name,industry,employee_count,description,company_profile")
        .eq("id", context.organization.id)
        .single(),
      supabase
        .from("organization_settings")
        .select("settings_revision")
        .eq("organization_id", context.organization.id)
        .single(),
    ]);
    if (company.error || settings.error)
      throw new Error("Company profile could not load. Try again.");
    return (
      <>
        {heading}
        <CompanyProfileForm
          organizationId={context.organization.id}
          revision={settings.data.settings_revision}
          initial={{
            ...emptyCompany,
            ...company.data,
            ...company.data.company_profile,
          }}
        />
      </>
    );
  }
  if (section === "general" || section === "knowledge") {
    const [orgResult, settingsResult, ownerResult] = await Promise.all([
      supabase
        .from("organizations")
        .select("name,industry,employee_count,description,default_timezone")
        .eq("id", context.organization.id)
        .single(),
      supabase
        .from("organization_settings")
        .select(
          "employees_can_ask,allow_escalations,confidence_threshold,estimated_interruption_minutes,expert_answers_require_admin_approval,ai_process_creation,ai_process_approval_prompt,settings_revision",
        )
        .eq("organization_id", context.organization.id)
        .single(),
      supabase
        .from("organization_members")
        .select("profiles!organization_members_user_id_fkey(full_name)")
        .eq("organization_id", context.organization.id)
        .eq("permission_level", "owner"),
    ]);
    if (orgResult.error || settingsResult.error || ownerResult.error)
      throw new Error(
        "Workspace settings could not be loaded. Please try again.",
      );
    const owners = (ownerResult.data ?? []).map((item) => {
      const profile = (
        Array.isArray(item.profiles) ? item.profiles[0] : item.profiles
      ) as { full_name: string | null };
      return profile?.full_name || "Workspace owner";
    });
    return (
      <>
        {heading}
        <WorkspaceForm
          section={section}
          initial={
            { ...orgResult.data, ...settingsResult.data } as WorkspaceValues
          }
          revision={settingsResult.data.settings_revision}
          organizationId={context.organization.id}
          logoUrl={context.organization.logoUrl}
        />
        {section === "general" ? (
          <section className="settings-section mt-8">
            <h3>Ownership & workspace address</h3>
            <p>{owners.join(", ")}</p>
            <p className="mt-2">
              Workspace names are display labels. Renaming does not change
              sign-in links, ownership, or connected credentials. Opryn uses the
              workspace switcher rather than a custom workspace URL.
            </p>
          </section>
        ) : (
          <Link className="settings-quiet-link mt-6" href="/app/team">
            Manage experts & permissions <ArrowRight size={16} />
          </Link>
        )}
      </>
    );
  }
  if (section === "billing") {
    const [subscription, members, invites, query] = await Promise.all([
      getOrganizationPlan(supabase, context.organization.id),
      supabase
        .from("organization_members")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", context.organization.id),
      supabase
        .from("organization_invites")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", context.organization.id)
        .eq("status", "pending"),
      searchParams,
    ]);
    if (members.error || invites.error)
      throw new Error("Workspace usage could not be loaded.");
    return (
      <>
        {heading}
        <BillingSettings
          plan={subscription.plan}
          interval={subscription.billingInterval}
          status={subscription.status}
          periodEnd={subscription.currentPeriodEnd}
          trialEnd={subscription.trialEnd}
          cancelAtPeriodEnd={subscription.cancelAtPeriodEnd}
          hasStripeCustomer={Boolean(subscription.stripeCustomerId)}
          hasSubscription={Boolean(subscription.stripeSubscriptionId)}
          billingReady={billingConfigured()}
          success={query.billing === "success"}
        />
        <section className="settings-section mt-6">
          <h3>Employee seats</h3>
          <p>
            {Math.max(0, (members.count ?? 1) - 1)} employees joined ·{" "}
            {invites.count ?? 0} pending invitations ·{" "}
            {getTeamLimit(subscription.plan)} included employee seats.
          </p>
          <p>
            The owner is not counted as an employee seat. Pending invitations
            reserve a seat. Adding a teammate does not automatically purchase
            more seats.
          </p>
          <Link href="/app/team" className="settings-quiet-link">
            Manage employees <ArrowRight size={16} />
          </Link>
        </section>
        <SettingsSection title="Cancellation is not deletion">
          <p>
            The billing portal controls payment methods, invoices, and
            subscription cancellation. Cancellation does not delete your
            workspace or personal account. The subscription’s confirmed end date
            appears above when available.
          </p>
        </SettingsSection>
      </>
    );
  }
  if (section === "activity") {
    const query = await searchParams;
    const page = Math.max(
      1,
      Math.min(1000, Math.floor(Number(query.page)) || 1),
    );
    const [settingsEvents, knowledgeEvents] = await Promise.all([
      supabase
        .from("workspace_settings_events")
        .select("id,changed_fields,created_at,actor_id")
        .eq("organization_id", context.organization.id)
        .order("created_at", { ascending: false })
        .range((page - 1) * 20, page * 20),
      supabase
        .from("knowledge_events")
        .select("id,event_type,created_at")
        .eq("organization_id", context.organization.id)
        .order("created_at", { ascending: false })
        .range((page - 1) * 20, page * 20),
    ]);
    if (settingsEvents.error || knowledgeEvents.error)
      throw new Error("Recorded activity could not be loaded. Try again.");
    return (
      <>
        {heading}
        <p className="text-sm text-[var(--opryn-muted)] mb-6">
          Recorded settings and knowledge events only—not a complete security
          audit or a record of every sign-in.
        </p>
        <SettingsSection title="Workspace settings">
          {settingsEvents.data.slice(0, 20).map((event) => (
            <div key={event.id} className="settings-row">
              <span>
                <strong>Settings updated</strong>
                <small>
                  {event.changed_fields
                    .map((field: string) => field.replaceAll("_", " "))
                    .join(", ")}
                </small>
                <small>
                  {formatDate(event.created_at)}
                  {event.actor_id === context.user.id
                    ? " · You"
                    : " · Workspace administrator"}
                </small>
              </span>
            </div>
          ))}
          {!settingsEvents.data.length ? (
            <p>No recorded settings changes on this page.</p>
          ) : null}
        </SettingsSection>
        <SettingsSection title="Knowledge activity">
          {knowledgeEvents.data.slice(0, 20).map((event) => (
            <div key={event.id} className="settings-row">
              <span>
                <strong>{event.event_type.replaceAll("_", " ")}</strong>
                <small>{formatDate(event.created_at)}</small>
              </span>
            </div>
          ))}
          {!knowledgeEvents.data.length ? (
            <p>No recorded knowledge events on this page.</p>
          ) : null}
        </SettingsSection>
        <nav className="settings-actions" aria-label="Activity pages">
          {page > 1 ? (
            <Link
              href={`/app/settings/activity?page=${page - 1}`}
              className="settings-button"
            >
              Previous
            </Link>
          ) : null}
          {settingsEvents.data.length > 20 ||
          knowledgeEvents.data.length > 20 ? (
            <Link
              href={`/app/settings/activity?page=${page + 1}`}
              className="settings-button"
            >
              Next
            </Link>
          ) : null}
        </nav>
      </>
    );
  }
  return (
    <>
      {heading}
      <SettingsSection title="Access stays with the workspace">
        <p>
          People and external AI use Opryn through their authorized workspace
          and the access rules configured for them. Manage those permissions in
          their existing controls.
        </p>
        <Link href="/app/team" className="settings-quiet-link">
          Members & access <ArrowRight size={16} />
        </Link>
        <br />
        <Link href="/app/ai-connections" className="settings-quiet-link">
          External AI access <ArrowRight size={16} />
        </Link>
      </SettingsSection>
      <SettingsSection title="Connected sources & recordings">
        <p>
          A connection is separate from learning and approval. Disconnecting a
          source does not automatically delete knowledge already approved in
          Opryn. Call and media removal follows the source’s existing controls;
          no universal automatic retention period is configured.
        </p>
        <Link className="settings-quiet-link" href="/app/integrations">
          Manage connections <ArrowRight size={16} />
        </Link>
        <br />
        <Link className="settings-quiet-link" href="/app/calls">
          Manage call learning <ArrowRight size={16} />
        </Link>
      </SettingsSection>
      <SettingsSection title="Export or remove business data">
        <p>
          Workspace owners can delete their workspace below. Contact support for
          a permission-verified export or personal account deletion. Export
          scope and retained source media must be reviewed; credentials must
          never be included. Self-service bulk export and account/ownership
          transfer are not yet available.
        </p>
        <a
          className="settings-quiet-link"
          href="mailto:usersupport@opryn.app?subject=Opryn%20data%20request"
        >
          Request data assistance <ArrowRight size={16} />
        </a>
        <p className="mt-3">
          Cancelling billing, leaving a workspace, deleting an account, and
          deleting a workspace are different actions. An owner must resolve
          billing, access, and ownership before deletion.
        </p>
      </SettingsSection>
      {context.membership.permissionLevel === "owner" && (
        <DeleteWorkspace
          organizationId={context.organization.id}
          name={context.organization.name}
        />
      )}
      <Link className="settings-quiet-link" href="/security">
        How Opryn handles your data <ArrowRight size={16} />
      </Link>
    </>
  );
}
