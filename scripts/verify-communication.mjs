import { readFile } from "node:fs/promises";

const requiredFiles = [
  "lib/communication/bot.ts",
  "lib/communication/answer.ts",
  "lib/communication/processing.ts",
  "app/api/webhooks/slack/route.ts",
  "app/api/webhooks/teams/route.ts",
  "app/api/integrations/communication/link/route.ts",
  "supabase/migrations/20260831001000_opryn_everywhere.sql",
  "supabase/migrations/20260831001200_slack_member_knowledge_search.sql",
];

const contents = await Promise.all(
  requiredFiles.map((file) => readFile(file, "utf8")),
);
const combined = contents.join("\n");
const checks = [
  ["Slack official adapter", combined.includes("createSlackAdapter")],
  ["Teams official adapter", combined.includes("createTeamsAdapter")],
  ["Shared Opryn answer engine", combined.includes("answerCompanyQuestion")],
  ["Approved semantic search", combined.includes("match_knowledge")],
  [
    "Service member knowledge search",
    combined.includes("match_knowledge_for_communication") &&
      combined.includes("target_user_id"),
  ],
  [
    "Role-aware retrieval",
    combined.includes("knowledge.role_id = member.role_id") &&
      combined.includes("member.permission_level in ('owner', 'admin')"),
  ],
  [
    "Idempotent provider events",
    combined.includes("unique (provider, provider_event_id)"),
  ],
  ["Secure account-link hashing", combined.includes("hashCommunicationToken")],
  ["Bounded processing retries", combined.includes("attempt_count")],
];
const failed = checks.filter(([, valid]) => !valid);
for (const [name, valid] of checks)
  console.log(`${valid ? "PASS" : "FAIL"} ${name}`);
if (failed.length) process.exit(1);
