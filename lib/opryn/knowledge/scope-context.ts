import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { scopeContextSchema, type ScopeContext } from "./scope";

/** Role applicability comes from actual membership, not client-selected privilege. */
export async function memberScopeContext(
  service: SupabaseClient,
  organizationId: string,
  userId: string,
  channel: string,
  supplied: ScopeContext = {},
) {
  const { data: member, error } = await service
    .from("organization_members")
    .select("role_id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!member) throw new Error("Workspace membership is required.");
  const role = member.role_id
    ? await service
        .from("roles")
        .select("name")
        .eq("organization_id", organizationId)
        .eq("id", member.role_id)
        .maybeSingle()
    : { data: null, error: null };
  if (role.error) throw role.error;
  return {
    ...scopeContextSchema.parse(supplied),
    roles: member.role_id
      ? [member.role_id, ...(role.data?.name ? [role.data.name] : [])]
      : [],
    channels: [channel],
  } satisfies ScopeContext;
}
