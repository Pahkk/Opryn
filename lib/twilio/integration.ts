import "server-only";

import twilio from "twilio";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import {
  decryptTwilioAuthToken,
  encryptTwilioAuthToken,
} from "@/lib/twilio/credentials";

export const twilioConnectionSchema = z.object({
  accountSid: z
    .string()
    .trim()
    .regex(/^AC[a-fA-F0-9]{32}$/),
  authToken: z.string().trim().min(16).max(200),
  consentAcknowledged: z.literal(true),
});

export const callLearningSettingsSchema = z.object({
  analyzeSales: z.boolean(),
  analyzeSupport: z.boolean(),
  analyzeIncoming: z.boolean(),
  analyzeOutgoing: z.boolean(),
  analyzeVoicemail: z.boolean(),
  minimumDurationSeconds: z.number().int().min(0).max(14400),
  automaticProcessing: z.boolean(),
  retentionDays: z.union([
    z.literal(0),
    z.literal(7),
    z.literal(30),
    z.literal(90),
  ]),
});

export const defaultCallLearningSettings = {
  analyzeSales: true,
  analyzeSupport: true,
  analyzeIncoming: true,
  analyzeOutgoing: true,
  analyzeVoicemail: false,
  minimumDurationSeconds: 120,
  automaticProcessing: true,
  retentionDays: 7 as const,
};

export async function connectTwilio(input: {
  organizationId: string;
  userId: string;
  accountSid: string;
  authToken: string;
}) {
  const client = twilio(input.accountSid, input.authToken, {
    accountSid: input.accountSid,
  });
  const [account, phoneNumbers] = await Promise.all([
    client.api.accounts(input.accountSid).fetch(),
    client.incomingPhoneNumbers.list({ limit: 100 }),
  ]);
  if (account.status !== "active")
    throw new Error("This Twilio account is not active.");

  const service = createServiceClient();
  const { data: integration, error } = await service
    .from("phone_integrations")
    .upsert(
      {
        organization_id: input.organizationId,
        provider: "twilio",
        account_identifier: input.accountSid,
        encrypted_credentials: encryptTwilioAuthToken(input.authToken),
        status: "active",
        created_by: input.userId,
        error_message: null,
      },
      { onConflict: "organization_id,provider" },
    )
    .select("id")
    .single();
  if (error) throw error;

  if (phoneNumbers.length) {
    const { error: numbersError } = await service
      .from("twilio_number_mappings")
      .upsert(
        phoneNumbers.map((number) => ({
          organization_id: input.organizationId,
          integration_id: integration.id,
          phone_number: number.phoneNumber,
          friendly_name: number.friendlyName,
        })),
        { onConflict: "integration_id,phone_number" },
      );
    if (numbersError) throw numbersError;
  }
  return {
    integrationId: integration.id,
    phoneNumberCount: phoneNumbers.length,
  };
}

export async function getActiveTwilioIntegration(accountSid: string) {
  const service = createServiceClient();
  const { data, error } = await service
    .from("phone_integrations")
    .select("*")
    .eq("provider", "twilio")
    .eq("account_identifier", accountSid)
    .eq("status", "active")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export function getTwilioClient(integration: {
  account_identifier: string;
  encrypted_credentials: string;
}) {
  const authToken = decryptTwilioAuthToken(integration.encrypted_credentials);
  return {
    authToken,
    client: twilio(integration.account_identifier, authToken, {
      accountSid: integration.account_identifier,
    }),
  };
}
