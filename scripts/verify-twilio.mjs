import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import twilio from "twilio";

const webhookUrl = "https://www.opryn.app/api/webhooks/twilio/recording";
const authToken = "test_auth_token_for_signature_validation";
const params = {
  AccountSid: "AC00000000000000000000000000000000",
  CallSid: "CA00000000000000000000000000000000",
  RecordingSid: "RE00000000000000000000000000000000",
  RecordingStatus: "completed",
};
const signature = twilio.getExpectedTwilioSignature(
  authToken,
  webhookUrl,
  params,
);
assert.equal(
  twilio.validateRequest(authToken, signature, webhookUrl, params),
  true,
  "Twilio's official SDK should accept a correctly signed form payload.",
);
assert.equal(
  twilio.validateRequest(authToken, "invalid", webhookUrl, params),
  false,
  "Twilio's official SDK should reject an invalid signature.",
);

const [webhookSource, migration, captureSource] = await Promise.all([
  readFile("app/api/webhooks/twilio/recording/route.ts", "utf8"),
  readFile(
    "supabase/migrations/20260827001000_twilio_call_learning.sql",
    "utf8",
  ),
  readFile("components/app/capture-process.tsx", "utf8"),
]);
assert.match(webhookSource, /twilio\.validateRequest/);
assert.match(webhookSource, /provider_recording_id/);
assert.match(migration, /unique index call_recordings_provider_recording_uidx/);
assert.match(migration, /phone_integrations_service_only/);
assert.doesNotMatch(captureSource, /title="Upload audio"/);

console.log("Twilio security and integration checks passed.");
