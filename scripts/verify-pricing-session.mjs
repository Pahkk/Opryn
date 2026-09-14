import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pricingRoute = readFileSync(
  new URL("../app/pricing/page.tsx", import.meta.url),
  "utf8",
);
const pricingUi = readFileSync(
  new URL("../components/pricing-page.tsx", import.meta.url),
  "utf8",
);
const context = readFileSync(
  new URL("../lib/app-context.ts", import.meta.url),
  "utf8",
);

assert.doesNotMatch(
  pricingRoute,
  /createClient|auth\.getUser/,
  "Pricing must not race a second Supabase session read",
);
assert.match(
  pricingRoute,
  /<AuthProvider initialUser=\{context\?\.authUser \?\? null\}>/,
  "Pricing and its navbar must share the authenticated server result",
);
assert.match(context, /authUser: User/);
assert.match(context, /return \{\s*authUser,/);
assert.match(pricingUi, /href="\/app"[\s\S]*?Back to Home/);

console.log(
  "Pricing uses one authenticated session read and gives signed-in users a direct route back Home.",
);
