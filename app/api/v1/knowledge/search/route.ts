import { z } from "zod";
import { scopeContextSchema } from "@/lib/opryn/knowledge/scope";
import {
  authenticateExternalAI,
  externalAIError,
  externalJSON,
} from "@/lib/external-ai/auth";
import {
  logExternalActivity,
  searchExternalKnowledgeWithEmbedding,
} from "@/lib/external-ai/service";

const schema = z.object({
  query: z.string().trim().min(2).max(2000),
  limit: z.number().int().min(1).max(20).default(5),
  scope_context: scopeContextSchema.optional(),
});

export async function POST(request: Request) {
  const startedAt = Date.now();
  try {
    const auth = await authenticateExternalAI(request, "knowledge:read");
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success)
      return externalJSON({ error: "invalid_request" }, { status: 400 });
    const lookup = await searchExternalKnowledgeWithEmbedding(
      auth.service,
      auth.connection.id,
      auth.connection.organization_id,
      parsed.data.query,
      parsed.data.limit,
      auth.scopes,
      parsed.data.scope_context,
    );
    const results = lookup.knowledge;
    await logExternalActivity(auth.service, {
      organizationId: auth.connection.organization_id,
      connectionId: auth.connection.id,
      endpoint: "knowledge_search",
      resultStatus: results.length ? "answered" : "unknown",
      startedAt,
      sourceCount: results.length,
      knowledgeVersions: lookup.versions.filter((v) =>
        results.some((k) => k.id === v.id),
      ),
    });
    return externalJSON({
      results: results.map((item) => ({
        id: item.source_id,
        title: item.content.split(/[.:]/)[0].slice(0, 100),
        content: item.content,
        source_type: item.source_type,
      })),
    });
  } catch (error) {
    return externalAIError(error);
  }
}
