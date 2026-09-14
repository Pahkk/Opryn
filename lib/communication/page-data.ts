import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CommunicationProvider } from "@/lib/communication/types";

export async function getCommunicationIntegrationPageData(
  organizationId: string,
  provider: CommunicationProvider,
) {
  const supabase = await createClient();
  const [
    { data: integration },
    { count: totalMembers },
    { data: roles },
    { data: memberships },
  ] = await Promise.all([
    supabase
      .from("communication_integrations")
      .select(
        "id,external_workspace_name,status,settings,last_used_at,created_at",
      )
      .eq("organization_id", organizationId)
      .eq("provider", provider)
      .neq("status", "disconnected")
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId),
    supabase
      .from("roles")
      .select("id,name")
      .eq("organization_id", organizationId)
      .order("name"),
    supabase
      .from("organization_members")
      .select(
        "user_id,profiles!organization_members_user_id_fkey(full_name,email)",
      )
      .eq("organization_id", organizationId),
  ]);
  let mappedUsers = 0;
  if (integration) {
    const { count } = await supabase
      .from("communication_user_mappings")
      .select("id", { count: "exact", head: true })
      .eq("integration_id", integration.id);
    mappedUsers = count ?? 0;
  }
  const settings =
    integration?.settings && typeof integration.settings === "object"
      ? (integration.settings as Record<string, unknown>)
      : {};
  const mode = settings.access_mode;
  const accessMode: "all_members" | "selected_roles" | "selected_users" =
    mode === "selected_roles" || mode === "selected_users"
      ? mode
      : "all_members";
  return {
    integration,
    mappedUsers,
    totalMembers: totalMembers ?? 0,
    accessMode,
    selectedRoleIds: Array.isArray(settings.role_ids)
      ? settings.role_ids.filter((id): id is string => typeof id === "string")
      : [],
    selectedUserIds: Array.isArray(settings.user_ids)
      ? settings.user_ids.filter((id): id is string => typeof id === "string")
      : [],
    roles: roles ?? [],
    members: (memberships ?? []).map((membership) => {
      const raw = membership.profiles as unknown;
      const profile = (Array.isArray(raw) ? raw[0] : raw) as {
        full_name: string | null;
        email: string | null;
      } | null;
      return {
        id: membership.user_id,
        name: profile?.full_name || profile?.email || "Team member",
      };
    }),
  };
}
