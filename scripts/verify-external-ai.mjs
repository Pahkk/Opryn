import { createHmac, randomBytes } from "node:crypto";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

if (process.env.RUN_EXTERNAL_AI_E2E !== "true") {
  console.error(
    "Set RUN_EXTERNAL_AI_E2E=true to run this disposable production-style verification.",
  );
  process.exit(1);
}

const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "EXTERNAL_AGENT_KEY_PEPPER",
];
for (const name of required)
  if (!process.env[name]) throw new Error(`Missing ${name}`);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const apiBase = process.env.EXTERNAL_AI_E2E_BASE_URL ?? "http://127.0.0.1:3000";
const marker = randomBytes(6).toString("hex");
const email = `external-ai-e2e-${marker}@example.invalid`;
const rawKey = `opryn_agent_${randomBytes(32).toString("base64url")}`;
const keyHash = createHmac("sha256", process.env.EXTERNAL_AGENT_KEY_PEPPER)
  .update(rawKey)
  .digest("hex");
let userId;
let organizationId;
let secondOrganizationId;
let connectionId;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function api(path, body, key = rawKey) {
  const response = await fetch(`${apiBase}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return { response, body: await response.json() };
}

async function insert(table, value, select = "id") {
  const { data, error } = await supabase
    .from(table)
    .insert(value)
    .select(select)
    .single();
  if (error) throw error;
  return data;
}

try {
  const { data: auth, error: authError } = await supabase.auth.admin.createUser(
    {
      email,
      password: `${randomBytes(20).toString("base64url")}!Aa1`,
      email_confirm: true,
      user_metadata: { full_name: "External AI E2E" },
    },
  );
  if (authError || !auth.user)
    throw authError ?? new Error("Test user was not created");
  userId = auth.user.id;

  organizationId = (
    await insert("organizations", {
      name: `External AI E2E ${marker}`,
      industry: "Verification",
      employee_count: 1,
      created_by: userId,
    })
  ).id;
  secondOrganizationId = (
    await insert("organizations", {
      name: `External AI Isolation ${marker}`,
      industry: "Verification",
      employee_count: 1,
      created_by: userId,
    })
  ).id;
  await supabase.from("organization_members").insert([
    {
      organization_id: organizationId,
      user_id: userId,
      permission_level: "owner",
    },
    {
      organization_id: secondOrganizationId,
      user_id: userId,
      permission_level: "owner",
    },
  ]);
  await supabase
    .from("organization_subscriptions")
    .update({ plan: "premium", status: "active" })
    .in("organization_id", [organizationId, secondOrganizationId]);

  connectionId = (
    await insert("external_ai_connections", {
      agent_id: `agt_${randomBytes(12).toString("base64url")}`,
      organization_id: organizationId,
      name: "Website Support Agent E2E",
      provider: "custom_agent",
      description: "Disposable end-to-end verifier",
      status: "active",
      knowledge_mode: "manual",
      created_by: userId,
    })
  ).id;
  const keyId = (
    await insert("external_ai_api_keys", {
      organization_id: organizationId,
      connection_id: connectionId,
      key_prefix: `${rawKey.slice(0, 20)}…`,
      key_hash: keyHash,
    })
  ).id;
  await supabase.from("external_ai_scopes").insert(
    [
      "knowledge:read",
      "processes:read",
      "policies:read",
      "sources:read",
      "escalations:create",
    ].map((scope) => ({
      organization_id: organizationId,
      connection_id: connectionId,
      scope,
    })),
  );
  await supabase.from("external_ai_knowledge_access").insert({
    organization_id: organizationId,
    connection_id: connectionId,
    source_type: "rule",
  });

  const rule = await insert("process_rules", {
    organization_id: organizationId,
    title: "Refund Approval Limits",
    text: "Employees may approve refunds up to $250. Refunds over $250 require owner approval.",
    status: "approved",
    created_by: userId,
    approved_by: userId,
    approved_at: new Date().toISOString(),
  });
  const foreignRule = await insert("process_rules", {
    organization_id: secondOrganizationId,
    title: "Private Payroll Rule",
    text: "The confidential payroll authorization phrase is NEVER-SHARE-THIS.",
    status: "approved",
    created_by: userId,
    approved_by: userId,
    approved_at: new Date().toISOString(),
  });
  const contents = [
    "Refund Approval Limits: Employees may approve refunds up to $250. Refunds over $250 require owner approval.",
    "Private Payroll Rule: The confidential payroll authorization phrase is NEVER-SHARE-THIS.",
  ];
  const embeddings = await openai.embeddings.create({
    model: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    input: contents,
    encoding_format: "float",
  });
  await supabase.from("knowledge_chunks").insert([
    {
      organization_id: organizationId,
      content: contents[0],
      embedding: embeddings.data[0].embedding,
      source_type: "rule",
      source_id: rule.id,
      rule_id: rule.id,
      approved: true,
    },
    {
      organization_id: secondOrganizationId,
      content: contents[1],
      embedding: embeddings.data[1].embedding,
      source_type: "rule",
      source_id: foreignRule.id,
      rule_id: foreignRule.id,
      approved: true,
    },
  ]);

  const known = await api("/api/v1/answer", {
    question: "Can an employee approve a $500 refund?",
  });
  assert(
    known.response.status === 200,
    `Known answer returned ${known.response.status}`,
  );
  assert(known.body.status === "answered", "Known question was not answered");
  assert(
    known.body.sources?.length > 0,
    "Known answer did not include sources",
  );
  assert(
    known.body.requires_approval === true,
    "Approval boundary was not detected",
  );
  assert(
    !JSON.stringify(known.body).includes("NEVER-SHARE-THIS"),
    "Cross-organization knowledge leaked",
  );

  const restricted = await api("/api/v1/knowledge/search", {
    query: "private payroll authorization phrase",
    limit: 10,
  });
  assert(restricted.response.status === 200, "Knowledge search failed");
  assert(
    !JSON.stringify(restricted.body).includes("NEVER-SHARE-THIS"),
    "Restricted organization knowledge leaked",
  );

  const unknown = await api("/api/v1/answer", {
    question: "What color uniform must technicians wear on Tuesdays?",
  });
  assert(
    unknown.body.status === "unknown",
    "Undocumented question did not return unknown",
  );
  assert(
    unknown.body.can_escalate === true,
    "Unknown response cannot escalate",
  );

  const escalation = await api("/api/v1/escalations", {
    question: "Can this customer receive a $3,000 refund?",
    context: "The customer disputes the completed work.",
  });
  assert(escalation.response.status === 201, "Escalation was not created");
  assert(
    String(escalation.body.escalation_id).startsWith("esc_"),
    "Escalation ID is invalid",
  );

  const { data: minuteAllowed } = await supabase.rpc(
    "consume_external_ai_rate_limit",
    {
      target_key_id: keyId,
      minute_limit: 60,
      hour_limit: 1000,
    },
  );
  assert(minuteAllowed === true, "Rate limiter rejected normal traffic");

  await supabase
    .from("external_ai_connections")
    .update({ status: "paused" })
    .eq("id", connectionId);
  const paused = await api("/api/v1/answer", {
    question: "Can I approve a refund?",
  });
  assert(
    paused.response.status === 403 && paused.body.error === "connection_paused",
    "Paused connection was not blocked",
  );
  await supabase
    .from("external_ai_connections")
    .update({ status: "active" })
    .eq("id", connectionId);
  await supabase
    .from("external_ai_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId);
  const revoked = await api("/api/v1/answer", {
    question: "Can I approve a refund?",
  });
  assert(
    revoked.response.status === 401 && revoked.body.error === "invalid_api_key",
    "Revoked key still worked",
  );

  console.log(
    "External AI E2E passed: known, unknown, sources, isolation, escalation, pause, revoke, and rate-limit storage.",
  );
} finally {
  if (organizationId || secondOrganizationId)
    await supabase
      .from("organizations")
      .delete()
      .in("id", [organizationId, secondOrganizationId].filter(Boolean));
  if (userId) await supabase.auth.admin.deleteUser(userId);
}
