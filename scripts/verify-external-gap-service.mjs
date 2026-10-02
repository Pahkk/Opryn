// Bundle the real external recheck service; only provider/billing queries are fixtures.
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
const { build } = await import(pathToFileURL(process.env.OPRYN_ESBUILD_MODULE));
const bundle = await build({entryPoints:["lib/opryn/knowledge/external-gap-rechecks.ts"],bundle:true,write:false,format:"esm",platform:"node",alias:{"@":process.cwd()},plugins:[{
  name:"isolated-providers",setup(b){
    b.onResolve({filter:/^(server-only|@\/lib\/billing\/subscription|@\/lib\/external-ai\/service)$/},a=>({path:a.path,namespace:"fixture"}));
    b.onLoad({filter:/.*/,namespace:"fixture"},a=>({contents:a.path==="server-only"?"":a.path.includes("subscription")?"export const getOrganizationPlan=async()=>({plan:globalThis.fixture.plan});":`export const searchExternalKnowledgeWithEmbedding=async(...args)=>{globalThis.fixture.retrieval.push(args);return {knowledge:globalThis.fixture.knowledge};};export const answerExternalQuestion=async(...args)=>{globalThis.fixture.calls.push(args);if(globalThis.fixture.failModel)throw Error('secret provider payload');return globalThis.fixture.answer;};`,loader:"js"}));
  }
}]});
const { recheckExternalGapAnswers } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
let state;
const reset=()=>globalThis.fixture=state={plan:"premium",key:true,revoked:false,active:true,scopes:["knowledge:read","policies:read"],knowledge:[{id:"chunk"}],criticality:"normal",answer:{can_answer:true,confidence:.94,answer:"Owner approval required.",steps:[],important_note:"",cited_source_ids:["chunk"]},calls:[],retrieval:[],commits:[],race:false};
const service={from(table){const filters=[];const chain={select(){return chain},eq(...f){filters.push(f);return chain},in(){return chain},single(){return chain},maybeSingle(){return chain},then(resolve){assert.ok(filters.some(([k,v])=>k==="organization_id"&&v==="org"));let data;
if(table==="knowledge_proposals")data={status:"approved",approved_knowledge_id:"chunk"};
if(table==="external_ai_escalations")data={question:"Can I refund $700?",context:"Customer request",connection_id:"original-connection",origin_api_key_id:state.key?"original-key":null};
if(table==="external_ai_connections")data={status:state.active?"active":"revoked"};
if(table==="external_ai_api_keys"){assert.ok(filters.some(([k,v])=>k==="connection_id"&&v==="original-connection"));data={revoked_at:state.revoked?"now":null};}
if(table==="external_ai_scopes")data=state.scopes.map(scope=>({scope}));
if(table==="organization_settings")data={confidence_threshold:.72};
if(table==="knowledge_chunks")data=[{id:"chunk",current_version:3,criticality:state.criticality}];
resolve({data,error:null});}};return chain},async rpc(name,args){if(name.startsWith("claim_")){state.claim=name;return {data:[{external_escalation_id:"interaction"}],error:null}}assert.equal(name,"complete_external_gap_recheck");state.commits.push(args);if(state.race&&state.commits.length===1)return {error:{code:"23514"}};return {data:true,error:null}}};
const run=()=>recheckExternalGapAnswers(service,"org","proposal");
reset();assert.equal((await run())[0].status,"answered");assert.equal(state.retrieval[0][1],"original-connection");assert.deepEqual([...state.retrieval[0][5]],state.scopes);assert.equal(state.calls[0][1],"Customer request");assert.equal(state.commits[0].expected_knowledge_version,3);
for(const condition of [()=>state.key=false,()=>state.revoked=true,()=>state.active=false,()=>state.plan="core",()=>state.scopes=[]]){reset();condition();assert.equal((await run())[0].status,"unknown");assert.equal(state.calls.length,0);}
reset();state.answer.cited_source_ids=["fabricated"];assert.equal((await run())[0].status,"unknown");
reset();state.criticality="critical";state.answer.confidence=.89;assert.equal((await run())[0].status,"unknown");
reset();state.failModel=true;assert.equal((await run())[0].status,"error");assert.equal(state.commits[0].result_answer,"");
reset();state.race=true;assert.equal((await run())[0].status,"unknown");assert.equal(state.commits[1].result_answer,"");assert.deepEqual(state.commits[1].result_citations,[]);
reset();await recheckExternalGapAnswers(service,"org","proposal",true);assert.equal(state.claim,"claim_scheduled_gap_rechecks");
console.log("PASS: real external service uses original connection/key/scopes/context/current version; fails closed for missing/revoked access, billing, confidence, fabricated sources, provider error and commit-time permission races.");
