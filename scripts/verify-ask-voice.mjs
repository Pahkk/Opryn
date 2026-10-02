import assert from "node:assert/strict";
import { build } from "esbuild";
Error.stackTraceLimit = 0;
const options = {
  entryPoints: ["app/api/ask/transcribe/route.ts"],
  bundle: true,
  write: false,
  platform: "node",
  format: "esm",
  alias: { "@": process.cwd() },
  plugins: [
    {
      name: "fixtures",
      setup(b) {
        b.onResolve(
          {
            filter:
              /^(server-only|next\/server|@\/lib\/api|@\/lib\/ai\/services)$/,
          },
          (args) => ({ path: args.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
          contents:
            path === "server-only"
              ? ""
              : path === "next/server"
                ? "export const NextResponse = Response;"
                : path === "@/lib/api"
                  ? `export const getRequestContext=async()=>globalThis.voice.context;export const apiError=()=>Response.json({error:'unavailable'},{status:500});`
                  : `export const transcribeAudio=async(...args)=>{globalThis.voice.calls.push(args);return {text:globalThis.voice.text}};`,
          loader: "js",
        }));
      },
    },
  ],
};
const gatedBundle = await build(options);
const gatedRoute = await import(
  `data:text/javascript;base64,${Buffer.from(gatedBundle.outputFiles[0].text).toString("base64")}`
);
const gatedResponse = await gatedRoute.POST(
  new Request("https://opryn.app/api/ask/transcribe", { method: "POST" }),
);
assert.equal(
  gatedResponse.status,
  503,
  "unreleased voice must stop before auth, storage, or model calls",
);
options.plugins.unshift({
  name: "test-unreleased-implementation",
  setup(b) {
    b.onResolve({ filter: /^@\/lib\/ask-features$/ }, () => ({
      path: "voice-enabled-fixture",
      namespace: "voice-gate",
    }));
    b.onLoad({ filter: /.*/, namespace: "voice-gate" }, () => ({
      contents: "export const ASK_VOICE_ENABLED = true;",
      loader: "js",
    }));
  },
});
const bundle = await build(options);
const { POST } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
let settings;
const reset = () => {
  settings = { data: { employees_can_ask: true }, error: null };
  const query = {
    select() {
      return query;
    },
    eq(key, value) {
      assert.equal(key, "organization_id");
      assert.equal(value, "org");
      return query;
    },
    maybeSingle() {
      return settings;
    },
  };
  globalThis.voice = {
    text: "Can I refund a $750 order?",
    calls: [],
    context: {
      membership: { organization_id: "org" },
      supabase: {
        from(table) {
          assert.equal(table, "organization_settings");
          return query;
        },
      },
    },
  };
};
const send = (body = "recorded-audio", headers = {}) =>
  POST(
    new Request("https://opryn.app/api/ask/transcribe", {
      method: "POST",
      headers: { "content-type": "audio/webm", ...headers },
      body,
    }),
  );
reset();
let response = await send();
assert.equal(response.status, 200);
assert.equal((await response.json()).text, voice.text);
assert.equal(voice.calls.length, 1);
assert.equal(response.headers.get("cache-control"), "private, no-store");
reset();
voice.context = { error: Response.json({}, { status: 401 }) };
assert.equal((await send()).status, 401);
assert.equal(voice.calls.length, 0);
reset();
assert.equal(
  (await send("audio", { origin: "https://other.example" })).status,
  403,
);
assert.equal(voice.calls.length, 0);
reset();
settings.data.employees_can_ask = false;
assert.equal((await send()).status, 403);
assert.equal(voice.calls.length, 0);
reset();
assert.equal(
  (await send("file", { "content-type": "application/pdf" })).status,
  415,
);
assert.equal(voice.calls.length, 0);
reset();
assert.equal((await send("", {})).status, 400);
assert.equal(voice.calls.length, 0);
reset();
assert.equal((await send("x".repeat(3_000_001))).status, 413);
assert.equal(voice.calls.length, 0);
reset();
assert.equal(
  (await send("audio", { "content-length": "3000001" })).status,
  413,
);
assert.equal(voice.calls.length, 0);
reset();
voice.text = "x".repeat(4001);
assert.equal((await send()).status, 422);
reset();
settings.error = new Error("unavailable");
assert.equal((await send()).status, 500);
assert.equal(voice.calls.length, 0);
console.log(
  "PASS 10 voice route cases: auth, workspace, disabled Ask, origin, type, empty, actual size, declared size, length, transient transcription. Model/audio are fixtures; microphone is not tested.",
);
