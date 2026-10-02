// Release gate: enable only after distributed voice rate limiting and real
// microphone/provider QA. Shared by the UI and server; hiding a button alone
// must never leave the paid transcription endpoint available.
export const ASK_VOICE_ENABLED = false;
