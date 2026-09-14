import { AppShell } from "@/components/app/app-shell";
import { requireAppContext } from "@/lib/app-context";
import { getOrganizationPlan } from "@/lib/billing/subscription";
import { createClient } from "@/lib/supabase/server";
import type { Metadata } from "next";
import type { AppNotification } from "@/components/app/notification-bell";
import { getNeedsYouItems } from "@/lib/opryn/needs-you";
import { getAccountSettings } from "@/lib/account-settings-server";
import {
  shouldShowNotification,
  isQuestionTaskNotification,
} from "@/lib/account-settings";

export const metadata: Metadata = {
  title: "Opryn Workspace",
  robots: { index: false, follow: false },
};

export default async function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireAppContext();
  const accountSettings = await getAccountSettings(context.user.id);
  const supabase = await createClient();
  const storedNotificationsRequest = supabase
    .from("notifications")
    .select(
      "id,type,title,body,link,target_url,entity_type,entity_id,read,created_at",
    )
    .eq("organization_id", context.organization.id)
    .eq("user_id", context.user.id)
    .order("created_at", { ascending: false })
    .limit(20);
  let unansweredQuestionsRequest = supabase
    .from("employee_questions")
    .select("id,question,created_at")
    .eq("organization_id", context.organization.id)
    .eq("status", "needs_owner")
    .eq("escalated", true);
  if (!context.isAdmin)
    unansweredQuestionsRequest = unansweredQuestionsRequest.eq(
      "assigned_expert_id",
      context.user.id,
    );
  unansweredQuestionsRequest = unansweredQuestionsRequest
    .order("created_at", { ascending: false })
    .limit(20);
  const pendingInvitesRequest = context.isAdmin
    ? supabase
        .from("organization_invites")
        .select("id,email,created_at")
        .eq("organization_id", context.organization.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(20)
    : Promise.resolve({ data: [] });
  const pendingApprovalsRequest = context.isAdmin
    ? Promise.all([
        supabase
          .from("processes")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", context.organization.id)
          .eq("status", "needs_review"),
        supabase
          .from("knowledge_proposals")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", context.organization.id)
          .in("status", ["pending_approval", "needs_review"]),
      ])
    : Promise.resolve([{ count: 0 }, { count: 0 }]);
  const needsYouRequest = getNeedsYouItems({
    service: supabase,
    organizationId: context.organization.id,
    userId: context.user.id,
    isAdmin: context.isAdmin,
  });

  const [
    { data: storedNotifications },
    subscription,
    { data: unansweredQuestions },
    { data: pendingInvites },
    pendingApprovals,
    needsYouItems,
  ] = await Promise.all([
    storedNotificationsRequest,
    getOrganizationPlan(supabase, context.organization.id),
    unansweredQuestionsRequest,
    pendingInvitesRequest,
    pendingApprovalsRequest,
    needsYouRequest,
  ]);

  const storedItems: AppNotification[] = (storedNotifications ?? [])
    .filter(
      (item) =>
        !isQuestionTaskNotification(item.type) &&
        shouldShowNotification(item.type, accountSettings),
    )
    .map((item) => ({
      id: `notification-${item.id}`,
      notificationId: item.id,
      title: item.title,
      body: item.body,
      href:
        exactNotificationTarget(item.entity_type, item.entity_id) ||
        item.target_url ||
        item.link ||
        "/app",
      unread: !item.read,
      kind: "update",
      createdAt: item.created_at,
    }));
  const questionItems: AppNotification[] = (
    accountSettings.notify_questions ? (unansweredQuestions ?? []) : []
  ).map((question) => ({
    id: `question-${question.id}`,
    title: context.isAdmin
      ? "A teammate needs your answer"
      : "Opryn matched a question to you",
    body: question.question,
    href: `/app/needs-you?item=question-${question.id}`,
    unread: true,
    kind: "question",
    createdAt: question.created_at,
  }));
  const inviteItems: AppNotification[] = (pendingInvites ?? []).map(
    (invite) => ({
      id: `invite-${invite.id}`,
      title: "Company invitation pending",
      body: `${invite.email} has not joined your team yet.`,
      href: "/app/team",
      unread: true,
      kind: "invite",
      createdAt: invite.created_at,
    }),
  );
  const uniqueStoredItems = storedItems.filter(
    (item, index, all) =>
      all.findIndex(
        (other) => other.href === item.href && other.title === item.title,
      ) === index,
  );
  const notifications = [...questionItems, ...inviteItems, ...uniqueStoredItems]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    )
    .slice(0, 20);
  const notificationCount =
    questionItems.length +
    (pendingInvites?.length ?? 0) +
    uniqueStoredItems.filter((item) => item.unread).length;
  return (
    <AppShell
      key={context.organization.id}
      organizationId={context.organization.id}
      organizations={context.organizations}
      organization={context.organization}
      user={context.user}
      preferences={{
        density: accountSettings.density,
        motion: accountSettings.motion,
      }}
      isAdmin={context.isAdmin}
      plan={subscription.plan}
      notifications={notifications}
      notificationCount={notificationCount}
      pendingApprovalCount={
        (pendingApprovals[0].count ?? 0) + (pendingApprovals[1].count ?? 0)
      }
      needsYouCount={needsYouItems.length}
    >
      {children}
    </AppShell>
  );
}

function exactNotificationTarget(
  entityType: string | null,
  entityId: string | null,
) {
  if (!entityId) return null;
  if (entityType === "process")
    return `/app/processes/${entityId}?review=true&returnTo=%2Fapp%2Fprocesses`;
  if (entityType === "question")
    return `/app/needs-you?item=question-${entityId}`;
  if (entityType === "knowledge_proposal")
    return `/app/needs-you?item=${entityId}`;
  return null;
}
