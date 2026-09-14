import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

// Read-only evidence, not deployment authorization. Never reads environment files.
const deployment = process.argv[2];
if (!/^dpl_[a-zA-Z0-9]+$/.test(deployment ?? "")) {
  throw new Error("Pass the verified current production deployment ID.");
}
const project = JSON.parse(readFileSync(".vercel/project.json", "utf8"));
const tree = JSON.parse(
  execFileSync(
    path.resolve("node_modules/.bin/vercel"),
    ["api", `/v6/deployments/${deployment}/files`, "--scope", project.orgId],
    { encoding: "utf8", timeout: 60_000, maxBuffer: 20 * 1024 * 1024 },
  ),
);
const source = tree.find((entry) => entry.name === "src");
if (!source?.children?.length)
  throw new Error("Deployment source unavailable.");
const hashes = new Map();
function flatten(entries, parent = "") {
  for (const entry of entries) {
    const name = parent ? `${parent}/${entry.name}` : entry.name;
    if (
      name.split("/").some((part) => part === ".." || part.startsWith(".env"))
    ) {
      throw new Error("Unexpected source path; comparison stopped.");
    }
    if (entry.type === "directory") flatten(entry.children ?? [], name);
    else if (entry.type === "file" && /^[a-f0-9]{40}$/.test(entry.uid)) {
      hashes.set(name, entry.uid);
    } else throw new Error(`Unsupported source metadata: ${name}`);
  }
}
flatten(source.children);
const changed = [];
const removed = [];
let unchanged = 0;
for (const [file, expected] of hashes) {
  if (!existsSync(file)) removed.push(file);
  else if (
    createHash("sha1").update(readFileSync(file)).digest("hex") !== expected
  ) {
    changed.push(file);
  } else unchanged++;
}
// Git enumerates new source candidates; explicitly omit non-release artifacts.
// Report candidates conservatively rather than claiming to reproduce Vercel's uploader.
const candidates = execFileSync(
  "git",
  ["ls-files", "-co", "--exclude-standard", "-z"],
  {
    encoding: "utf8",
  },
)
  .split("\0")
  .filter(Boolean);
const excluded =
  /^(?:\.env|\.vercel\/|\.git\/|\.next\/|node_modules\/|artifacts\/|graphify-out\/|test-results\/|playwright-report\/|coverage\/|supabase\/\.temp\/)|(?:\.tsbuildinfo|\.DS_Store)$/;
const addedCandidates = [...new Set(candidates)]
  .filter(
    (file) => !excluded.test(file) && !hashes.has(file) && existsSync(file),
  )
  .sort();
console.log(
  JSON.stringify(
    {
      deployment,
      projectId: project.projectId,
      comparedSourceFiles: hashes.size,
      unchanged,
      changed: changed.sort(),
      removed: removed.sort(),
      addedCandidates,
      note: "Read-only comparison. Added candidates require review against .vercelignore. This does not authorize deployment or verify runtime behavior.",
    },
    null,
    2,
  ),
);
