import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(
  new URL("../lib/setup-checklist.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const exports = {};
vm.runInNewContext(compiled, { exports });
const { buildSetupChecklist, setupChecklistProgress } = exports;

for (const hasApprovedKnowledge of [false, true]) {
  for (const hasSuccessfulAnswer of [false, true]) {
    for (const hasAiConnection of [false, true]) {
      for (const teamInvited of [false, true]) {
        const items = buildSetupChecklist({
          hasApprovedKnowledge,
          hasSuccessfulAnswer,
          hasAiConnection,
          teamInvited,
        });
        assert.equal(items.length, 3);
        assert.equal(
          items[0].complete,
          hasApprovedKnowledge && hasSuccessfulAnswer,
        );
        assert.equal(
          items[0].href,
          hasApprovedKnowledge ? "/app/ask" : "/onboarding?step=teach",
        );
        assert.equal(items[1].complete, hasAiConnection);
        assert.equal(items[2].optional, true);
        assert.equal(items[2].complete, teamInvited);
        const progress = setupChecklistProgress(items);
        assert.equal(progress.total, 2);
        assert.equal(
          progress.completed,
          Number(hasApprovedKnowledge && hasSuccessfulAnswer) +
            Number(hasAiConnection),
        );
        assert.ok(items.every((item) => !/slack|drive/i.test(item.label)));
      }
    }
  }
}

// Guard against reintroducing onboarding-form-only or time-window completion.
const dashboard = readFileSync(
  new URL("../app/app/page.tsx", import.meta.url),
  "utf8",
);
assert.match(
  dashboard,
  /hasApprovedKnowledge = Boolean\(approvedKnowledge\.data\?\.length\)/,
);
assert.match(
  dashboard,
  /hasSuccessfulAnswer = Boolean\(successfulAnswer\.data\?\.length\)/,
);
assert.match(
  dashboard,
  /\.from\("employee_questions"\)\s*\.select\("id"\)\s*\.eq\("organization_id", organizationId\)\s*\.eq\("answered_by_opryn", true\)\s*\.eq\("status", "answered"\)\s*\.limit\(1\)/,
);
assert.match(
  dashboard,
  /\.from\("knowledge_chunks"\)\s*\.select\("id"\)\s*\.eq\("organization_id", organizationId\)\s*\.eq\("approved", true\)\s*\.limit\(1\)/,
);
console.log(
  "Passed all 16 setup states: source-neutral learning, successful-answer requirement, optional invites, and no Slack/Drive requirements.",
);
