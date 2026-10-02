import assert from "node:assert/strict";
import { access } from "node:fs/promises";

const base = process.env.OPRYN_AUDIT_URL || "http://localhost:3000";
const assets = [
  "opryn_business_answer_pipeline.png",
  "one_source_two_uses.png",
  "opryn_three_step_knowledge_flow.png",
  "opryn_integrations_connection_page.png",
  "from_question_to_trusted_answer.png",
];
let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks++;
}

async function page(path) {
  const response = await fetch(new URL(path, base));
  check(response.ok, `${path} responds successfully`);
  return response.text();
}

const home = await page("/");
check((home.match(/<h1\b/g) || []).length === 1, "Homepage has one H1");
check(home.includes("opryn-public-dark"), "Homepage uses the dark public theme");
check(home.includes("Example knowledge flow:"), "Existing hero knowledge flow remains");
for (const line of [
  "Bring in",
  "You decide",
  "Ask your",
  "Know where",
  "One source.",
  "When Opryn",
  "Answer it once.",
  "Choose what",
]) check(home.includes(line), `Homepage contains story scene: ${line}`);
for (const file of assets) {
  await access(`public/opryn-marketing/${file}`);
  check(home.includes(file), `Homepage reuses ${file}`);
  await page(`/opryn-marketing/${file}`);
}
for (const id of ["how-it-works", "review", "answer-everywhere", "knowledge-loop", "integrations", "pricing"])
  check(home.includes(`id="${id}"`), `${id} anchor exists`);
for (const destination of ["/signup", "/integrations", "/pricing"])
  check(home.includes(`href="${destination}"`), `${destination} CTA remains`);
check(!home.includes("pin-spacer"), "No scroll hijacking spacer");

const ai = await page("/ai");
check(ai.includes("opryn-public-dark"), "AI page uses the same dark theme");
check(ai.includes("compatible connected AI"), "AI claim remains qualified");
check(ai.includes("Illustrative selections"), "Permission example is clearly illustrative");

const pricing = await page("/pricing");
const pricingText = pricing.replace(/<!--.*?-->/g, "").replace(/<[^>]+>/g, "");
check(pricing.includes("opryn-public-dark"), "Pricing page uses the same dark theme");
check(pricingText.includes("$49"), "Starter price is displayed");
check(pricingText.includes("$129"), "Pro price is displayed");
check(pricing.includes("not a trial"), "Current checkout disclosure remains truthful");

console.log(`${checks} public story, asset, CTA, AI and pricing checks passed.`);
