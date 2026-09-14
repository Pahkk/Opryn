# Twilio Call Learning setup

Opryn is the learning layer after a call. Twilio still handles the phone call
and recording consent configuration.

## Production environment

Set these server-only variables in Vercel:

- `TWILIO_CREDENTIALS_ENCRYPTION_KEY`: a 32-byte key. Generate one with
  `openssl rand -base64 32`.
- `TWILIO_RECORDING_WEBHOOK_URL`: normally
  `https://www.opryn.app/api/webhooks/twilio/recording`.
- `CRON_SECRET`: a long random value used by the retry and retention endpoint.

Never prefix these variables with `NEXT_PUBLIC_`.

## Connect a workspace

1. Upgrade the Opryn workspace to Premium.
2. Open **Settings → Integrations → Twilio**.
3. Enter the Twilio Account SID and Auth Token.
4. Confirm the recording-consent responsibility notice.
5. Map Twilio numbers to Opryn employees or a team when known.

Credentials are validated against Twilio, encrypted with AES-256-GCM, and
stored per organization. The Auth Token is never returned to the browser.

## Recording callback

Configure the Twilio recording status callback to use POST and this exact URL:

```text
https://www.opryn.app/api/webhooks/twilio/recording
```

Subscribe to `completed` and `absent`. For two-party calls, prefer dual-channel
recording with both tracks. When creating an outbound call through Twilio, the
relevant options are:

```text
Record=true
RecordingChannels=dual
RecordingStatusCallback=https://www.opryn.app/api/webhooks/twilio/recording
RecordingStatusCallbackMethod=POST
RecordingStatusCallbackEvent=completed absent
```

Opryn validates `X-Twilio-Signature` with Twilio's official Node SDK before it
persists or processes a recording.

## Retry and retention maintenance

Vercel calls this endpoint daily using the schedule in `vercel.json`:

```text
GET /api/cron/call-learning
Authorization: Bearer $CRON_SECRET
```

The endpoint retries up to three failed imports and deletes Opryn's copy of
recording audio after its retention date. It does not delete Twilio's original
recording. Transcripts, reviewed findings, and approved knowledge remain.
