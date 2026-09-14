import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const dashboard = readFileSync(
  new URL("../app/app/page.tsx", import.meta.url),
  "utf8",
);

assert.match(
  dashboard,
  /\.from\("external_learning_jobs"\)[\s\S]*?\.eq\("organization_id", organizationId\)[\s\S]*?\.in\("status", \[[\s\S]*?"needs_review",[\s\S]*?\]\)[\s\S]*?\.order\("created_at"/,
  "Home must fetch only active or unreviewed external learning jobs",
);
assert.match(
  dashboard,
  /if \(\["complete", "failed"\]\.includes\(learning\.status\)\) return null/,
  "Completed learning must not render as a new review action",
);
assert.doesNotMatch(
  dashboard,
  /const ready = \["needs_review", "complete"\]/,
  "Complete must never be treated as New knowledge ready",
);

console.log(
  "External learning banner persists only while processing or awaiting review; completed jobs stay dismissed after refresh.",
);
