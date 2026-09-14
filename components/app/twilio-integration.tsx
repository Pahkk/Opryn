"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clipboard,
  LoaderCircle,
  PhoneCall,
  PlugZap,
  ShieldCheck,
  Unplug,
} from "lucide-react";

type Settings = {
  analyzeSales: boolean;
  analyzeSupport: boolean;
  analyzeIncoming: boolean;
  analyzeOutgoing: boolean;
  analyzeVoicemail: boolean;
  minimumDurationSeconds: number;
  automaticProcessing: boolean;
  retentionDays: 0 | 7 | 30 | 90;
};

type NumberMapping = {
  id: string;
  phoneNumber: string;
  friendlyName: string;
  assignedUserId: string | null;
  assignedLabel: string;
  enabled: boolean;
};

export function TwilioIntegration({
  integration,
  initialSettings,
  initialMappings,
  members,
  webhookUrl,
}: {
  integration: null | {
    maskedAccount: string;
    status: string;
    lastWebhookAt: string | null;
    lastImportAt: string | null;
  };
  initialSettings: Settings;
  initialMappings: NumberMapping[];
  members: Array<{ id: string; name: string }>;
  webhookUrl: string;
}) {
  const router = useRouter();
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [consent, setConsent] = useState(false);
  const [settings, setSettings] = useState(initialSettings);
  const [mappings, setMappings] = useState(initialMappings);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function connect() {
    setBusy("connect");
    setError("");
    const response = await fetch("/api/integrations/twilio", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountSid,
        authToken,
        consentAcknowledged: consent,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok)
      return setError(body.error ?? "Opryn couldn't connect Twilio.");
    setAuthToken("");
    setMessage("Twilio connected. Add the recording callback in Twilio next.");
    router.refresh();
  }

  async function save() {
    setBusy("save");
    setError("");
    setMessage("");
    const response = await fetch("/api/integrations/twilio", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ settings, mappings }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok)
      return setError(body.error ?? "Opryn couldn't save these settings.");
    setMessage("Call Learning settings saved.");
    router.refresh();
  }

  async function disconnect() {
    if (
      !window.confirm(
        "Disconnect Twilio? Existing approved knowledge will remain.",
      )
    )
      return;
    setBusy("disconnect");
    setError("");
    const response = await fetch("/api/integrations/twilio", {
      method: "DELETE",
    });
    setBusy("");
    if (!response.ok) return setError("Opryn couldn't disconnect Twilio.");
    router.refresh();
  }

  if (!integration) {
    return (
      <div className="grid gap-5 lg:grid-cols-[1fr_.8fr]">
        <section className="rounded-2xl border border-[#dfe5ed] bg-white p-5 sm:p-7">
          <span className="grid size-11 place-items-center rounded-xl bg-[#fff2eb] text-[#e16832]">
            <PhoneCall className="size-5" />
          </span>
          <h2 className="mt-5 text-xl font-semibold">Connect Twilio</h2>
          <p className="mt-2 text-sm leading-6 text-[#657286]">
            Opryn receives completed recordings from your Twilio account. It
            does not place, route, or secretly record calls.
          </p>
          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              Account SID
              <input
                value={accountSid}
                onChange={(event) => setAccountSid(event.target.value)}
                placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                autoComplete="off"
                className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] px-3.5 font-mono text-sm"
              />
            </label>
            <label className="block text-sm font-medium">
              Auth Token
              <input
                type="password"
                value={authToken}
                onChange={(event) => setAuthToken(event.target.value)}
                autoComplete="new-password"
                className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] px-3.5"
              />
              <span className="mt-1.5 block text-xs font-normal text-[#7e8999]">
                Encrypted before storage and never sent back to your browser.
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border border-[#eadfcf] bg-[#fffaf2] p-4 text-sm leading-6 text-[#6e5a3c]">
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
                className="mt-1 size-5 accent-[#3158d8]"
              />
              <span>
                I understand that my business is responsible for obtaining any
                consent required to record and analyze calls.
              </span>
            </label>
          </div>
          {error ? <ErrorMessage>{error}</ErrorMessage> : null}
          <button
            type="button"
            disabled={!accountSid || !authToken || !consent || Boolean(busy)}
            onClick={() => void connect()}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#3158d8] px-5 text-sm font-semibold text-white disabled:opacity-45"
          >
            {busy === "connect" ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <PlugZap className="size-4" />
            )}
            Connect Twilio
          </button>
        </section>
        <WebhookSetup webhookUrl={webhookUrl} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#cfe4da] bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="grid size-11 place-items-center rounded-xl bg-[#eaf7f1] text-[#177257]">
              <PhoneCall className="size-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">Twilio</h2>
                <span className="rounded-full bg-[#eaf7f1] px-2.5 py-1 text-[10px] font-bold uppercase text-[#177257]">
                  Connected
                </span>
              </div>
              <p className="mt-1 font-mono text-xs text-[#748196]">
                {integration.maskedAccount}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={() => void disconnect()}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#e2c4c7] px-4 text-sm font-semibold text-[#a3444c]"
          >
            <Unplug className="size-4" /> Disconnect
          </button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Status label="Phone numbers" value={String(mappings.length)} />
          <Status
            label="Last webhook"
            value={formatDate(integration.lastWebhookAt)}
          />
          <Status
            label="Last import"
            value={formatDate(integration.lastImportAt)}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_.82fr]">
        <section className="rounded-2xl border border-[#dfe5ed] bg-white p-5 sm:p-7">
          <h2 className="font-semibold">Learning settings</h2>
          <p className="mt-1 text-sm text-[#718095]">
            Choose which completed recordings Opryn may process.
          </p>
          <div className="mt-5 grid gap-x-5 sm:grid-cols-2">
            <Toggle
              label="Incoming calls"
              checked={settings.analyzeIncoming}
              onChange={(value) =>
                setSettings({ ...settings, analyzeIncoming: value })
              }
            />
            <Toggle
              label="Outgoing calls"
              checked={settings.analyzeOutgoing}
              onChange={(value) =>
                setSettings({ ...settings, analyzeOutgoing: value })
              }
            />
            <Toggle
              label="Sales calls"
              checked={settings.analyzeSales}
              onChange={(value) =>
                setSettings({ ...settings, analyzeSales: value })
              }
            />
            <Toggle
              label="Customer support"
              checked={settings.analyzeSupport}
              onChange={(value) =>
                setSettings({ ...settings, analyzeSupport: value })
              }
            />
            <Toggle
              label="Voicemail"
              checked={settings.analyzeVoicemail}
              onChange={(value) =>
                setSettings({ ...settings, analyzeVoicemail: value })
              }
            />
            <Toggle
              label="Automatic processing"
              checked={settings.automaticProcessing}
              onChange={(value) =>
                setSettings({ ...settings, automaticProcessing: value })
              }
            />
          </div>
          <div className="mt-5 grid gap-4 border-t border-[#edf0f4] pt-5 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Minimum call length
              <select
                value={settings.minimumDurationSeconds}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    minimumDurationSeconds: Number(event.target.value),
                  })
                }
                className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] bg-white px-3.5"
              >
                <option value="0">No minimum</option>
                <option value="60">1 minute</option>
                <option value="120">2 minutes</option>
                <option value="300">5 minutes</option>
              </select>
            </label>
            <label className="text-sm font-medium">
              Recording retention
              <select
                value={settings.retentionDays}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    retentionDays: Number(event.target.value) as
                      0 | 7 | 30 | 90,
                  })
                }
                className="mt-2 h-11 w-full rounded-xl border border-[#d9e0e9] bg-white px-3.5"
              >
                <option value="0">Delete after processing</option>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </select>
            </label>
          </div>
        </section>
        <WebhookSetup webhookUrl={webhookUrl} />
      </div>

      <section className="rounded-2xl border border-[#dfe5ed] bg-white p-5 sm:p-7">
        <h2 className="font-semibold">Twilio number mapping</h2>
        <p className="mt-1 text-sm text-[#718095]">
          Tell Opryn who normally answers each number. Unknown identities stay
          unlabeled.
        </p>
        <div className="mt-5 divide-y divide-[#edf0f4]">
          {mappings.length ? (
            mappings.map((mapping) => (
              <div
                key={mapping.id}
                className="grid gap-3 py-4 first:pt-0 sm:grid-cols-[1fr_1fr_auto] sm:items-center"
              >
                <div>
                  <p className="text-sm font-semibold">
                    {mapping.friendlyName || "Twilio number"}
                  </p>
                  <p className="mt-1 font-mono text-xs text-[#758195]">
                    {maskPhone(mapping.phoneNumber)}
                  </p>
                </div>
                <select
                  value={
                    mapping.assignedUserId ??
                    (mapping.assignedLabel ? "team" : "")
                  }
                  onChange={(event) =>
                    setMappings((current) =>
                      current.map((item) =>
                        item.id === mapping.id
                          ? {
                              ...item,
                              assignedUserId:
                                event.target.value &&
                                event.target.value !== "team"
                                  ? event.target.value
                                  : null,
                              assignedLabel:
                                event.target.value === "team"
                                  ? "Support Team"
                                  : "",
                            }
                          : item,
                      ),
                    )
                  }
                  className="h-10 rounded-lg border border-[#d9e0e9] bg-white px-3 text-sm"
                >
                  <option value="">Unknown Opryn user</option>
                  <option value="team">Support Team</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-xs font-medium text-[#657286]">
                  <input
                    type="checkbox"
                    checked={mapping.enabled}
                    onChange={(event) =>
                      setMappings((current) =>
                        current.map((item) =>
                          item.id === mapping.id
                            ? { ...item, enabled: event.target.checked }
                            : item,
                        ),
                      )
                    }
                    className="size-4 accent-[#3158d8]"
                  />
                  Learn
                </label>
              </div>
            ))
          ) : (
            <p className="rounded-xl bg-[#f7f9fc] p-4 text-sm text-[#718095]">
              No Twilio phone numbers were found in this account.
            </p>
          )}
        </div>
      </section>

      {error ? <ErrorMessage>{error}</ErrorMessage> : null}
      {message ? (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl bg-[#eaf7f1] p-3 text-sm text-[#177257]"
        >
          <Check className="size-4" />
          {message}
        </p>
      ) : null}
      <div className="flex justify-end">
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void save()}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#3158d8] px-5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {busy === "save" ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <ShieldCheck className="size-4" />
          )}
          Save Call Learning settings
        </button>
      </div>
    </div>
  );
}

function WebhookSetup({ webhookUrl }: { webhookUrl: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
  }
  return (
    <section className="rounded-2xl border border-[#dfe5ed] bg-[#111d34] p-5 text-white sm:p-7">
      <p className="text-xs font-bold uppercase tracking-[.12em] text-[#9fb0cc]">
        Twilio callback
      </p>
      <h2 className="mt-3 text-lg font-semibold">
        Send completed recordings here
      </h2>
      <div className="mt-4 rounded-xl bg-white/8 p-3 font-mono text-xs leading-5 text-[#d7e0ef] break-all">
        {webhookUrl}
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg bg-white/10 px-3 text-xs font-semibold hover:bg-white/15"
      >
        {copied ? (
          <Check className="size-3.5" />
        ) : (
          <Clipboard className="size-3.5" />
        )}
        {copied ? "Copied" : "Copy webhook URL"}
      </button>
      <ol className="mt-5 space-y-2 text-xs leading-5 text-[#b7c4d9]">
        <li>1. Use POST for the recording status callback.</li>
        <li>2. Subscribe to completed and absent.</li>
        <li>3. Prefer dual channels and both tracks.</li>
      </ol>
    </section>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 border-b border-[#edf0f4] py-3 text-sm font-medium">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="size-5 accent-[#3158d8]"
      />
    </label>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f7f9fc] p-3">
      <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[#8490a1]">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[#334056]">{value}</p>
    </div>
  );
}

function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-4 rounded-xl bg-[#fff0f1] p-3 text-sm text-[#a83f49]"
    >
      {children}
    </p>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function maskPhone(value: string) {
  return value.length > 6
    ? `${value.slice(0, 4)} ••• ${value.slice(-4)}`
    : value;
}
