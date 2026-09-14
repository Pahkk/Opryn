import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { RetrievedKnowledge } from "@/lib/ai/services";
import { OPRYN_MCP_ORIGIN } from "@/lib/opryn/mcp/config";

export type OprynSource = {
  id: string;
  title: string;
  section: string;
  source_type: string;
  knowledge_id: string;
  url: string;
  origin?: string;
};

export async function resolveKnowledgeSources(
  service: SupabaseClient,
  items: RetrievedKnowledge[],
): Promise<OprynSource[]> {
  const processIds = unique(
    items.flatMap((item) => (item.process_id ? [item.process_id] : [])),
  );
  const sourceIds = unique(items.map((item) => item.source_id));
  const ruleIds = unique(
    items.flatMap((item) => (item.rule_id ? [item.rule_id] : [])),
  );
  const [processes, steps, rules] = await Promise.all([
    processIds.length
      ? service
          .from("processes")
          .select("id,title,source_provider,source_title")
          .in("id", processIds)
      : Promise.resolve({ data: [] }),
    sourceIds.length
      ? service.from("process_steps").select("id,title").in("id", sourceIds)
      : Promise.resolve({ data: [] }),
    unique([...sourceIds, ...ruleIds]).length
      ? service
          .from("process_rules")
          .select("id,title")
          .in("id", unique([...sourceIds, ...ruleIds]))
      : Promise.resolve({ data: [] }),
  ]);
  const processNames = new Map(
    (processes.data ?? []).map((row) => [row.id, row.title]),
  );
  const processSources = new Map(
    (processes.data ?? []).map((row) => [
      row.id,
      {
        provider: row.source_provider as string | null,
        title: row.source_title as string | null,
      },
    ]),
  );
  const stepNames = new Map(
    (steps.data ?? []).map((row) => [row.id, row.title]),
  );
  const ruleNames = new Map(
    (rules.data ?? []).map((row) => [row.id, row.title]),
  );
  return items.map((item) => {
    const ruleId = item.rule_id ?? item.source_id;
    const processTitle = item.process_id
      ? processNames.get(item.process_id) || "Company process"
      : sourceTypeTitle(item.source_type);
    const section =
      ruleNames.get(ruleId) ||
      stepNames.get(item.source_id) ||
      processSources.get(item.process_id || "")?.title ||
      sourceTypeSection(item.source_type);
    const anchor = ruleNames.has(ruleId)
      ? `#rule-${ruleId}`
      : stepNames.has(item.source_id)
        ? `#step-${item.source_id}`
        : "";
    const path = item.process_id
      ? `/app/processes/${item.process_id}${anchor}`
      : `/app/processes?knowledge=${item.id}`;
    return {
      id: item.source_id,
      title: processTitle,
      section,
      source_type: item.source_type,
      knowledge_id: item.id,
      url: `${OPRYN_MCP_ORIGIN}${path}`,
      origin: sourceOrigin(processSources.get(item.process_id || "")),
    };
  });
}

function sourceOrigin(
  source: { provider: string | null; title: string | null } | undefined,
) {
  if (!source?.provider) return undefined;
  if (source.title) return source.title;
  if (source.provider === "chatgpt") return "ChatGPT conversation";
  if (source.provider === "claude") return "Claude conversation";
  return "Selected AI conversation";
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function sourceTypeTitle(type: string) {
  return (
    (
      {
        rule: "Company rule",
        owner_answer: "Approved owner answer",
        faq: "Company FAQ",
        role_instruction: "Role knowledge",
        call_finding: "Approved call knowledge",
        google_drive: "Approved Google Drive knowledge",
        video_finding: "Approved video knowledge",
        chatgpt: "ChatGPT conversation",
        claude: "Claude conversation",
        external_ai: "AI conversation",
      } as Record<string, string>
    )[type] || "Company knowledge"
  );
}

function sourceTypeSection(type: string) {
  return (
    (
      {
        process_summary: "Overview",
        process_step: "Process step",
        rule: "Policy",
        exception: "Exception",
        owner_answer: "Owner guidance",
        role_instruction: "Role guidance",
        call_finding: "Call learning",
        faq: "Approved answer",
        google_drive: "Imported document",
        video_finding: "Video learning",
        chatgpt: "ChatGPT conversation",
        claude: "Claude conversation",
        external_ai: "AI conversation",
      } as Record<string, string>
    )[type] || "Approved company knowledge"
  );
}
