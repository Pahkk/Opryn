// Deterministic contract tests. AI and database are explicit doubles, not live integrations.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";

function load(path, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(code, {
    exports,
    Buffer,
    File,
    Request,
    Response,
    URL,
    TextDecoder,
    console,
    require(name) {
      if (name === "server-only") return {};
      if (dependencies[name]) return dependencies[name];
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}
const formats = load("lib/learning-files.ts");
const schema = load("lib/ai/schemas.ts", { zod: { z } });
const sample = {
  title: "Revision policy",
  summary: "Two revisions included.",
  purpose: "Handle revisions.",
  steps: [
    {
      order: 1,
      title: "Check revision count",
      description: "Two revision rounds are included.",
    },
  ],
  rules: [
    {
      title: "Extra revisions",
      text: "Additional rounds require project lead approval.",
      confidence: 1,
    },
  ],
  exceptions: [],
  clarification_questions: [],
};
let modelInput;
let modelCalls = 0;
let readable = true;
const config = {
  OPENAI_MODELS: { text: "configured-test-model" },
  OPENAI_TEXT_REASONING: { effort: "none" },
};
const ai = load("lib/ai/learning-file.ts", {
  zod: { z },
  "openai/helpers/zod": { zodTextFormat },
  "@/lib/learning-files": formats,
  "@/lib/ai/config": config,
  "@/lib/ai/schemas": schema,
  "@/lib/ai/openai": {
    getOpenAI: () => ({
      responses: {
        parse: async (input) => {
          modelInput = input;
          modelCalls++;
          return {
            output_parsed: {
              readable,
              issue: "",
              process: readable ? sample : null,
            },
          };
        },
      },
    }),
  },
});
const signatures = {
  png: "89504e470d0a1a0a",
  jpeg: "ffd8ff",
  jpg: "ffd8ff",
  doc: "d0cf11e0a1b11ae1",
  docx: "504b0304",
  pdf: "255044462d312e37",
  webp: "524946460000000057454250",
};
for (const [extension, signature] of Object.entries(signatures)) {
  const file = new File(
    [Buffer.from(signature, "hex")],
    `policy.${extension}`,
    { type: formats.LEARNING_FILE_TYPES[extension] },
  );
  const input = await ai.learningFileContent(file);
  assert.equal(
    input.type,
    ["png", "jpg", "jpeg", "webp"].includes(extension)
      ? "input_image"
      : "input_file",
  );
  await ai.extractLearningFile(file);
  assert.equal(modelInput.store, false);
  assert.equal(modelInput.model, config.OPENAI_MODELS.text);
  assert.match(modelInput.instructions, /HUMAN REVIEW/);
}
for (const extension of ["txt", "md", "csv", "json"]) {
  const file = new File(
    ["Two revision rounds are included."],
    `policy.${extension}`,
  );
  assert.equal((await ai.learningFileContent(file)).type, "input_text");
}
for (const file of [
  new File(["executable"], "policy.exe"),
  new File([], "empty.png"),
  new File(["not an image"], "fake.png", { type: "image/png" }),
  new File(["wrong MIME"], "policy.jpeg", { type: "application/pdf" }),
  new File([new Uint8Array(4_000_001)], "large.png"),
  new File([new Uint8Array(100_001)], "large.txt"),
  new File([new Uint8Array([0xff, 0xff])], "invalid.txt"),
])
  await assert.rejects(() => ai.learningFileContent(file));
readable = false;
await assert.rejects(
  () => ai.extractLearningFile(new File(["blank"], "blank.txt")),
  /readable business knowledge/,
);
readable = true;

let access = 200;
let writes = [];
let failSteps = false;
function query(table) {
  const q = {
    insert(value) {
      writes.push({ table, action: "insert", value });
      return q;
    },
    update(value) {
      writes.push({ table, action: "update", value });
      return q;
    },
    delete() {
      writes.push({ table, action: "delete", filters: [] });
      return q;
    },
    eq(key, value) {
      writes.at(-1)?.filters?.push([key, value]);
      return q;
    },
    neq(key, value) {
      writes.at(-1)?.filters?.push([key, "!=", value]);
      return q;
    },
    select() {
      return q;
    },
    single: async () => ({ data: { id: "new-import" }, error: null }),
    then(resolve) {
      return Promise.resolve({
        error:
          failSteps && table === "process_steps"
            ? new Error("Test write failure")
            : null,
      }).then(resolve);
    },
  };
  return q;
}
const processes = load("lib/processes.ts", {
  "@/lib/knowledge-library": load("lib/knowledge-library.ts"),
});
const route = load("app/api/processes/import/route.ts", {
  "next/server": { NextResponse: Response },
  "@/lib/api": {
    getRequestContext: async ({ admin }) => {
      assert.equal(admin, true);
      return access !== 200
        ? { error: Response.json({}, { status: access }) }
        : {
            supabase: { from: query },
            user: { id: "owner" },
            membership: { organization_id: "company" },
          };
    },
    apiError: () => Response.json({ error: "Test failure" }, { status: 500 }),
  },
  "@/lib/ai/learning-file": ai,
  "@/lib/learning-files": formats,
  "@/lib/processes": processes,
  "@/lib/ai/config": config,
});
function request(
  file = new File(["Two revision rounds are included."], "policy.txt"),
  origin = "https://opryn.test",
) {
  const body = new FormData();
  body.set("file", file);
  return new Request("https://opryn.test/api/processes/import", {
    method: "POST",
    headers: { origin },
    body,
  });
}
for (const status of [401, 403]) {
  access = status;
  const before = modelCalls;
  assert.equal((await route.POST(request())).status, status);
  assert.equal(modelCalls, before);
}
access = 200;
assert.equal(
  (await route.POST(request(undefined, "https://other.test"))).status,
  403,
);
assert.equal(
  (await route.POST(request(new File(["no"], "fake.png")))).status,
  400,
);
assert.equal(
  (
    await route.POST(
      new Request("https://opryn.test/api/processes/import", {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=test" },
        body: new Uint8Array(4_020_000),
      }),
    )
  ).status,
  413,
);
assert.equal(writes.length, 0);
const success = await route.POST(request());
assert.equal(success.status, 200);
assert.equal((await success.json()).processId, "new-import");
const insert = writes.find(
  (write) => write.table === "processes" && write.action === "insert",
);
assert.equal(insert.value.organization_id, "company");
assert.equal(insert.value.created_by, "owner");
assert.match(insert.value.description, /policy.txt/);
assert.equal(insert.value.status, "draft");
assert.equal(
  writes.find(
    (write) => write.table === "process_rules" && write.action === "insert",
  ).value[0].status,
  "draft",
);
assert.ok(writes.every((write) => write.value?.status !== "approved"));
writes = [];
failSteps = true;
assert.equal((await route.POST(request())).status, 500);
const cleanup = writes.find(
  (write) => write.table === "processes" && write.action === "delete",
);
assert.ok(
  cleanup.filters.some(
    ([key, value]) => key === "id" && value === "new-import",
  ),
);
assert.ok(
  cleanup.filters.some(
    ([key, value]) => key === "organization_id" && value === "company",
  ),
);
assert.ok(
  cleanup.filters.some(
    ([key, operator, value]) =>
      key === "status" && operator === "!=" && value === "approved",
  ),
);
console.log(
  "PASS: 11 formats, MIME/signature/size/UTF-8 checks, unreadable results, auth/origin gates, tenant-scoped draft review, and isolated failure cleanup. AI/DB mocked.",
);
