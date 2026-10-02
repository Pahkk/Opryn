import { after } from "next/server";
import { z } from "zod";
import {
  authenticateExternalAI,
  externalAIError,
  externalJSON,
} from "@/lib/external-ai/auth";
import { processTrainingEvaluations } from "@/lib/training/evaluations";
export const maxDuration = 300;
const schema = z
  .object({
    test_id: z.uuid(),
    request_id: z.uuid(),
    answer: z.string().trim().min(1).max(12000),
    sources: z
      .array(
        z
          .object({ id: z.uuid(), version: z.number().int().positive() })
          .strict(),
      )
      .max(20),
  })
  .strict();
export async function POST(request: Request) {
  try {
    const auth = await authenticateExternalAI(request, "evaluations:create");
    if (!auth.scopes.has("knowledge:read"))
      return externalJSON({ error: "insufficient_scope" }, { status: 403 });
    const p = schema.safeParse(await request.json().catch(() => null));
    if (!p.success)
      return externalJSON(
        { error: "invalid_observable_response" },
        { status: 400 },
      );
    const r = await auth.service.rpc("submit_agent_training_response", {
      target_org: auth.connection.organization_id,
      target_connection: auth.connection.id,
      target_key: auth.keyId,
      target_test: p.data.test_id,
      request_id: p.data.request_id,
      response_value: { answer: p.data.answer, sources: p.data.sources },
    });
    if (r.error) {
      if (r.error.code === "23505")
        return externalJSON(
          { error: "evaluation_already_pending" },
          { status: 409 },
        );
      if (r.error.code === "42501")
        return externalJSON(
          { error: "evaluation_access_changed" },
          { status: 403 },
        );
      throw r.error;
    }
    after(() => processTrainingEvaluations(auth.service, 1));
    return externalJSON(
      { status: "queued", run_id: r.data, execution_mode: "agent_response" },
      { status: 202 },
    );
  } catch (e) {
    return externalAIError(e);
  }
}

export async function GET(request: Request) {
  try {
    const auth = await authenticateExternalAI(request, "evaluations:create");
    const id = z
      .uuid()
      .safeParse(new URL(request.url).searchParams.get("run_id"));
    if (!id.success)
      return externalJSON({ error: "invalid_run_id" }, { status: 400 });
    const result = await auth.service.rpc("read_agent_training_run", {
      target_org: auth.connection.organization_id,
      target_connection: auth.connection.id,
      target_key: auth.keyId,
      target_run: id.data,
    });
    if (result.error?.code === "42501")
      return externalJSON(
        { error: "evaluation_access_changed" },
        { status: 403 },
      );
    if (result.error) throw result.error;
    if (!result.data)
      return externalJSON({ error: "run_not_found" }, { status: 404 });
    return externalJSON(result.data);
  } catch (e) {
    return externalAIError(e);
  }
}
