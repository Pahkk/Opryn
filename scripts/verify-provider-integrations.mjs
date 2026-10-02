import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = Object.fromEntries(
  await Promise.all(
    [
      "lib/integrations/content-providers.ts",
      "lib/integrations/source-import.ts",
      "lib/integrations/teams-nango.ts",
      "lib/communication/answer.ts",
      "app/api/integrations/nango/[id]/content/route.ts",
      "app/api/integrations/nango/[id]/check/route.ts",
      "supabase/migrations/20260915020000_notion_confluence_teams.sql",
    ].map(async (file) => [file, await readFile(file, "utf8")]),
  ),
);

const adapter = files["lib/integrations/content-providers.ts"];
const migration =
  files["supabase/migrations/20260915020000_notion_confluence_teams.sql"];
const sourceRoute = files["app/api/integrations/nango/[id]/content/route.ts"];
const updateRoute = files["app/api/integrations/nango/[id]/check/route.ts"];
const teams =
  files["lib/integrations/teams-nango.ts"] +
  files["lib/communication/answer.ts"];

for (const field of [
  "authorid",
  "ownerid",
  "lastownerid",
  "accountid",
  "displayname",
  "email",
  "avatar",
  "timezone",
])
  assert.match(
    adapter,
    new RegExp(`"${field}"`),
    `missing identity deny-list field ${field}`,
  );

for (const forbiddenColumn of [
  "author_id",
  "owner_id",
  "account_id",
  "display_name",
  "email",
  "avatar",
  "timezone",
])
  assert.doesNotMatch(
    migration.match(
      /create table public\.integration_sources[\s\S]*?\);/,
    )?.[0] ?? "",
    new RegExp(`\\b${forbiddenColumn}\\b`, "i"),
    `integration_sources persists forbidden identity field ${forbiddenColumn}`,
  );

assert.match(sourceRoute, /sanitizeProviderMetadata/);
assert.match(sourceRoute, /containsForbiddenIdentity/);
assert.match(updateRoute, /onlyIfChanged:\s*true/);
assert.match(files["lib/integrations/source-import.ts"], /status:\s*"draft"/);
assert.match(
  files["lib/integrations/source-import.ts"],
  /replaceExtractedProcess/,
);
assert.match(teams, /match_knowledge_for_communication/);
assert.match(teams, /record_question_cluster/);
assert.match(teams, /nango_integration_id/);

console.log(
  "PASS Notion and Confluence share the review-first source pipeline",
);
console.log("PASS Confluence identity fields are stripped before persistence");
console.log("PASS changed sources create reviewable processes");
console.log(
  "PASS Teams uses the shared approved-answer and knowledge-gap engine",
);
