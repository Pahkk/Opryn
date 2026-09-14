// Actual suggestion endpoint/schema, mocked provider and authenticated database.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url), root=process.cwd();
const mocks={
  "@/lib/supabase/server":"export async function createClient(){return globalThis.fixture.db}",
  "@/lib/api":"export async function getRequestContext(){return globalThis.fixture.roleError?{error:Response.json({error:'denied'},{status:403})}:{membership:{}}}",
  "@/lib/ai/openai":"export const getOpenAI=()=>({responses:{parse:async(args)=>{globalThis.fixture.sent=args;return {output_parsed:globalThis.fixture.suggestion}}}})",
};
const output=await build({entryPoints:["app/api/onboarding/suggestions/route.ts"],bundle:true,write:false,platform:"node",format:"cjs",packages:"external",alias:{"@":root},plugins:[{name:"mock",setup(b){b.onResolve({filter:/.*/},a=>mocks[a.path]||a.path==="server-only"?{path:a.path,namespace:"mock"}:undefined);b.onLoad({filter:/.*/,namespace:"mock"},a=>({contents:mocks[a.path]||"",loader:"js"}))}}]});
const m={exports:{}};new Function("require","module","exports",output.outputFiles[0].text)(require,m,m.exports);
const suggestion={description:"We build websites.",industryId:"technology",explanation:"You mentioned websites.",departments:["Design"],knowledgeAreas:["Processes"],firstSource:"explain",sourceReason:"Explain one customer process.",firstQuestion:"How do you onboard customers?"};
const f={signedIn:true,budget:true,suggestion,db:{auth:{async getUser(){return {data:{user:f.signedIn?{id:"user"}:null}}}},async rpc(){return {data:f.budget,error:null}}}};globalThis.fixture=f;
const request=(body={description:"we build websites"},headers={})=>m.exports.POST(new Request("https://opryn.test/api/onboarding/suggestions",{method:"POST",headers:{origin:"https://opryn.test","Content-Type":"application/json",...headers},body:JSON.stringify(body)}));
let r=await request();assert.equal(r.status,200);assert.equal((await r.json()).suggestion.industryId,"technology");assert.equal(f.sent.store,false);assert.ok(!f.sent.input.includes("billing"));
f.signedIn=false;assert.equal((await request()).status,401);f.signedIn=true;
f.roleError=true;assert.equal((await request(undefined,{"x-opryn-organization":"other"})).status,403);f.roleError=false;
f.budget=false;assert.equal((await request()).status,429);f.budget=true;
assert.equal((await request({description:"x"})).status,400);assert.equal((await request({description:"we build websites",secret:"not allowed"})).status,400);
f.suggestion={...suggestion,industryId:"invented-industry"};assert.equal((await request()).status,503);
assert.equal((await request(undefined,{origin:"https://hostile.test"})).status,403);
delete globalThis.fixture;console.log("PASS setup endpoint: authenticated pre-workspace help, membership denial, rate budget, strict input, allowed industry IDs, invalid-model fallback, no automatic saving");
