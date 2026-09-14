import "server-only";

export const TWILIO_RECORDING_WEBHOOK_PATH = "/api/webhooks/twilio/recording";

export function getPublicSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") ||
    "https://www.opryn.app"
  );
}

export function getTwilioRecordingWebhookUrl() {
  return (
    process.env.TWILIO_RECORDING_WEBHOOK_URL?.trim() ||
    `${getPublicSiteUrl()}${TWILIO_RECORDING_WEBHOOK_PATH}`
  );
}

export function maskTwilioAccountSid(accountSid: string) {
  if (accountSid.length < 10) return "••••••••";
  return `${accountSid.slice(0, 4)}••••••••${accountSid.slice(-4)}`;
}
