import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const { build } = await import(pathToFileURL(process.env.OPRYN_ESBUILD_MODULE));
const bundle = await build({
  stdin: {
    contents: `export {importProviderSource,sourceFailureStatus} from './lib/integrations/source-import';export {normalizeGoogleSource} from './lib/integrations/google-source';export {sourceFreshnessReason} from './lib/opryn/knowledge/source-freshness';export {connectionPermitsKnowledge} from './lib/opryn/knowledge/impact';export {ConnectionError} from './lib/integrations/nango';`,
    resolveDir: process.cwd(),
    loader: "ts",
  },
  bundle: true,
  write: false,
  format: "esm",
  platform: "node",
  alias: { "@": process.cwd() },
  plugins: [
    {
      name: "isolated-boundaries",
      setup(b) {
        b.onResolve(
          {
            filter:
              /^(server-only|@\/lib\/ai\/learning-file|@\/lib\/processes|@\/lib\/integrations\/content-providers|@\/lib\/integrations\/nango-capabilities|\.\/nango-capabilities|@\/lib\/billing\/subscription)$/,
          },
          (a) => ({ path: a.path, namespace: "fixture" }),
        );
        b.onLoad({ filter: /.*/, namespace: "fixture" }, (a) => ({
          contents:
            a.path === "server-only"
              ? ""
              : a.path.includes("learning-file")
                ? `export async function extractLearningFile(){globalThis.fixture.models++;if(globalThis.fixture.aiError)throw Error('AI unavailable');return {title:'Refunds'}}`
                : a.path.endsWith("processes")
                  ? `export async function replaceExtractedProcess(){globalThis.fixture.replacements++}`
                  : a.path.includes("content-providers")
                    ? `export async function normalizeSelectedSource(){globalThis.fixture.normalizations++;return globalThis.fixture.normalized}export function normalizedSourceText(s){return s.title+'\\n\\n'+s.sections.map(x=>x.content).join('\\n')}`
                    : a.path.includes("subscription")
                      ? `export async function getOrganizationPlan(){return {plan:'premium'}}`
                      : `export async function requireNangoCapability(){globalThis.fixture.connections++;if(globalThis.fixture.disconnect && globalThis.fixture.connections>1)throw Error('Disconnected');return globalThis.fixture.connection}export async function driveRequest(c,path){globalThis.fixture.driveCalls++;return new Response(path.includes('/export?')?'Managers may approve up to $500.':JSON.stringify({id:'file',name:'Refunds',mimeType:'application/vnd.google-apps.document',modifiedTime:'2026-09-16T12:00:00Z',version:'3'}))}`,
          loader: "js",
        }));
      },
    },
  ],
});
const actual = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
function reset(overrides = {}) {
  globalThis.fixture = {
    models: 0,
    replacements: 0,
    connections: 0,
    driveCalls: 0,
    normalizations: 0,
    deleted: false,
    busy: false,
    source: {
      id: "source",
      organization_id: "org",
      integration_id: "connection",
      provider: "notion",
      external_id: "page",
      source_type: "page",
      title: "Refunds",
      parent_context: null,
      external_url: null,
      modified_at: null,
      provider_version: "1",
      content_hash: "old",
      process_id: "draft",
      approved_process_id: "approved",
      normalized_content: "Earlier content",
      previous_content: null,
      sync_status: "changed",
      review_status: "pending",
    },
    normalized: {
      provider: "notion",
      title: "Refunds",
      parentContext: null,
      externalUrl: null,
      modifiedAt: "2026-09-16T12:00:00Z",
      providerVersion: "2",
      contentHash: "new",
      sections: [{ heading: null, content: "Managers may approve $750." }],
      metadata: { sourceType: "page" },
    },
    connection: {
      id: "connection",
      organization_id: "org",
      provider: "notion",
      configuration: { selected_files: [{ id: "file" }] },
    },
    ...overrides,
  };
  return globalThis.fixture;
}
class Query {
  constructor(table) {
    this.table = table;
    this.filters = [];
  }
  select() {
    return this;
  }
  eq(k, v) {
    this.filters.push([k, v]);
    return this;
  }
  neq() {
    return this;
  }
  insert(v) {
    this.inserted = v;
    return this;
  }
  update(v) {
    this.updated = v;
    return this;
  }
  delete() {
    this.deleting = true;
    return this;
  }
  single() {
    return Promise.resolve(this.execute());
  }
  then(resolve, reject) {
    return Promise.resolve(this.execute()).then(resolve, reject);
  }
  execute() {
    const s = globalThis.fixture;
    assert.ok(
      this.inserted?.organization_id === "org" ||
        this.filters.some(([k, v]) => k === "organization_id" && v === "org"),
      "Every persisted operation is organization-scoped",
    );
    if (this.table === "integration_sources") {
      if (this.updated?.process_id && s.saveError)
        return { data: null, error: Error("Save unavailable") };
      if (this.updated) Object.assign(s.source, this.updated);
      return { data: { ...s.source }, error: null };
    }
    if (this.table === "processes") {
      if (this.deleting) s.deleted = true;
      if (this.inserted) {
        s.inserted = this.inserted;
        return { data: { id: "new-draft" }, error: null };
      }
    }
    return { data: null, error: null };
  }
}
const db = {
  from: (table) => new Query(table),
  rpc: async (name, args) => {
    const s = globalThis.fixture;
    assert.equal(args.target_org, "org");
    if (name === "claim_source_import") {
      if (s.busy) return { data: false, error: null };
      s.source.import_lease_token = args.lease_token;
      return { data: true, error: null };
    }
    return { data: null, error: null };
  },
};
const run = (options = {}) =>
  actual.importProviderSource({
    db,
    organizationId: "org",
    integrationId: "connection",
    userId: "owner",
    source: { ...globalThis.fixture.source },
    ...options,
  });
let s = reset();
let result = await run();
assert.equal(result.changed, true);
assert.equal(s.inserted.supersedes_process_id, "approved");
assert.equal(s.source.previous_content, "Earlier content");
assert.equal(s.source.sync_status, "changed");
assert.equal(s.source.import_lease_token, null);
assert.equal(s.models, 1);
s = reset();
s.normalized.contentHash = "old";
await run();
assert.equal(s.models, 0);
assert.equal(
  s.source.sync_status,
  "changed",
  "Unchanged check retains pending review",
);
s = reset();
s.source.review_status = "declined";
s.normalized.contentHash = "old";
await run({ onlyIfChanged: true });
assert.equal(s.models, 0);
assert.equal(s.source.sync_status, "imported");
await run();
assert.equal(s.models, 1);
assert.equal(s.source.review_status, "pending");
s = reset({ busy: true });
result = await run();
assert.equal(result.busy, true);
assert.equal(s.connections, 0);
assert.equal(s.models, 0);
s = reset({ saveError: true });
await assert.rejects(run());
assert.equal(s.deleted, true);
assert.equal(s.source.approved_process_id, "approved");
assert.equal(s.source.process_id, "draft");
assert.equal(s.source.import_lease_token, null);
s = reset({ disconnect: true });
await assert.rejects(run());
assert.equal(s.replacements, 0);
assert.equal(s.source.process_id, "draft");
s = reset();
let normalized = await actual.normalizeGoogleSource(s.connection, "file");
assert.equal(normalized.provider, "google_drive");
assert.equal(normalized.providerVersion, "3");
assert.equal(
  normalized.metadata.sourceType,
  "application/vnd.google-apps.document",
);
assert.equal(s.driveCalls, 2);
await assert.rejects(
  actual.normalizeGoogleSource(s.connection, "not-selected"),
  (e) => e.status === 403,
);
assert.equal(s.driveCalls, 2);
assert.equal(
  actual.sourceFailureStatus(new actual.ConnectionError("lost", 403)),
  "unavailable",
);
assert.equal(actual.sourceFailureStatus(Error("timeout")), "error");
const fresh = {
  connectionStatus: "connected",
  sync_status: "imported",
  process_id: "approved",
  approved_process_id: "approved",
  last_successful_check_at: "2026-09-16T12:00:00Z",
  last_imported_at: null,
};
assert.equal(
  actual.sourceFreshnessReason(fresh, Date.parse("2026-09-16T13:00:00Z")),
  null,
);
assert.match(
  actual.sourceFreshnessReason(
    { ...fresh, last_successful_check_at: "2025-01-01" },
    Date.parse("2026-09-16"),
  ),
  /180 days/,
);
assert.match(
  actual.sourceFreshnessReason({ ...fresh, connectionStatus: "disconnected" }),
  /attention/,
);
const item = {
  approved: true,
  library_archived_at: null,
  source_type: "rule",
  source_id: "rule",
  process_id: "process",
  rule_id: "rule",
  role_id: null,
};
assert.equal(
  actual.connectionPermitsKnowledge(
    item,
    "all_approved",
    ["knowledge:read"],
    [],
  ),
  false,
);
assert.equal(
  actual.connectionPermitsKnowledge(
    item,
    "all_approved",
    ["knowledge:read", "policies:read"],
    [],
  ),
  true,
);
assert.equal(
  actual.connectionPermitsKnowledge(
    item,
    "manual",
    ["knowledge:read", "policies:read"],
    [{ source_type: "rule", source_id: "other" }],
  ),
  false,
);
assert.equal(
  actual.connectionPermitsKnowledge(
    item,
    "manual",
    ["knowledge:read", "policies:read"],
    [{ source_type: "rule", source_id: "process" }],
  ),
  true,
);
console.log(
  "PASS: actual source importer/Google adapter/freshness/access helpers with isolated provider/model/database boundaries; approved lineage, pending state, leases, disconnect/save recovery, explicit Google selection and access-policy filtering. No real provider/model calls.",
);
