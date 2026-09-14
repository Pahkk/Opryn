// Real decoding/cropping code; fake auth/storage. Never uploads customer files.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import vm from "node:vm";
import ts from "typescript";
import sharp from "sharp";
let assertions = 0;
const check = (value, label) => {
  assert.ok(value, label);
  assertions++;
};
const id = "10000000-0000-4000-8000-000000000001";
let user = { id },
  stale = false,
  uploaded = [],
  removed = [],
  saved = null;
const storage = {
  upload: async (path, data) => {
    uploaded.push({ path, data });
    return { error: null };
  },
  remove: async (paths) => {
    removed.push(...paths);
    return { error: null };
  },
  download: async () => ({
    data: new Blob([uploaded.at(-1)?.data ?? new Uint8Array()]),
  }),
};
const supabase = {
  auth: { getUser: async () => ({ data: { user } }) },
  from: () => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: { avatar_path: `${id}/old.webp` } }),
      }),
    }),
  }),
  storage: { from: () => storage },
  rpc: async (name, args) => {
    saved = { name, args };
    return stale ? { error: { code: "40001" } } : { data: { revision: 2 } };
  },
};
const json = (body, init) => new Response(JSON.stringify(body), init);
const deps = {
  "node:crypto": { randomUUID },
  sharp: { default: sharp },
  "next/server": { NextResponse: { json } },
  "@/lib/supabase/server": { createClient: async () => supabase },
  "@/lib/request-origin": {
    rejectCrossOrigin: (request) =>
      request.headers.get("origin") === "https://opryn.test"
        ? null
        : json({ error: "Cross-site" }, { status: 403 }),
  },
};
const testModule = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(readFileSync("app/api/account/avatar/route.ts", "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
  {
    module: testModule,
    exports: testModule.exports,
    require: (key) => {
      if (key in deps) return deps[key];
      throw new Error(key);
    },
    Buffer,
    File,
    Response,
    Request,
    Number,
    Error,
    console,
  },
);
const route = testModule.exports;
const png = await sharp({
  create: { width: 400, height: 300, channels: 3, background: "#245fc9" },
})
  .png()
  .toBuffer();
function upload(data = png, type = "image/png", zoom = "2") {
  const form = new FormData();
  form.set("avatar", new File([data], "avatar.png", { type }));
  form.set("revision", "1");
  form.set("zoom", zoom);
  return new Request("https://opryn.test/api/account/avatar", {
    method: "POST",
    headers: { origin: "https://opryn.test" },
    body: form,
  });
}
user = null;
check((await route.POST(upload())).status === 401, "anonymous upload denied");
user = { id };
check(
  (await route.POST(upload(Buffer.from("<svg/>"), "image/svg+xml"))).status ===
    400,
  "SVG rejected",
);
check(
  (await route.POST(upload(Buffer.from("<script/>"), "image/png"))).status ===
    400,
  "spoofed PNG rejected by decoder",
);
check(
  (await route.POST(upload(Buffer.alloc(3 * 1024 * 1024 + 1)))).status === 400,
  "oversize payload rejected",
);
check(
  (await route.POST(upload(png, "image/png", "99"))).status === 400,
  "crop bounds validated",
);
check(uploaded.length === 0, "invalid uploads never reach storage");
const result = await route.POST(upload());
check(result.status === 200, "valid crop saved");
const metadata = await sharp(uploaded[0].data).metadata();
check(
  metadata.width === 256 &&
    metadata.height === 256 &&
    metadata.format === "webp",
  "real normalized 256px WebP",
);
check(!metadata.exif, "metadata stripped");
check(
  uploaded[0].path.startsWith(`${id}/`) &&
    !uploaded[0].path.includes("avatar.png"),
  "server-generated user-owned path",
);
check(
  saved.name === "save_account_settings" && saved.args.expected_revision === 1,
  "photo revision checked",
);
check(
  removed[0] === `${id}/old.webp`,
  "old image removed only after confirmed save",
);
stale = true;
const conflict = await route.POST(upload());
check(conflict.status === 409, "stale upload returns conflict");
check(
  removed.at(-1) === uploaded.at(-1).path,
  "uncommitted new object cleaned on conflict",
);
stale = false;
const get = await route.GET();
check(
  get.headers.get("cache-control") === "private, no-store",
  "private avatar not cached publicly",
);
const deletion = await route.DELETE(
  new Request("https://opryn.test/api/account/avatar", {
    method: "DELETE",
    headers: {
      origin: "https://opryn.test",
      "content-type": "application/json",
    },
    body: JSON.stringify({ revision: 2 }),
  }),
);
check(
  deletion.status === 200 && saved.args.changes.avatar_hidden === true,
  "remove suppresses OAuth fallback image",
);
console.log(
  `Avatar handling: ${assertions} assertions passed (real image processing, mocked auth/storage).`,
);
