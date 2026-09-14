// Real Stripe signature verification and webhook handler. Retrieval/database mocked.
import assert from "node:assert/strict";
import Stripe from "stripe";
import { build } from "esbuild";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url), root=process.cwd();
const mocks={"@/lib/supabase/service":"export const createServiceClient=()=>globalThis.fixture.db", "@/lib/billing/stripe":"export const getStripe=()=>globalThis.fixture.stripe;export const planFromStripePrice=(id)=>id==='price_premium'?{plan:'premium',interval:'month'}:null"};
const output=await build({entryPoints:["app/api/billing/webhook/route.ts"],bundle:true,write:false,platform:"node",format:"cjs",packages:"external",alias:{"@":root},plugins:[{name:"mock",setup(b){b.onResolve({filter:/.*/},a=>mocks[a.path]?{path:a.path,namespace:"mock"}:undefined);b.onLoad({filter:/.*/,namespace:"mock"},a=>({contents:mocks[a.path],loader:"js"}))}}]});
const mod={exports:{}};new Function("require","module","exports",output.outputFiles[0].text)(require,mod,mod.exports);
const sdk=new Stripe("sk_test_fixture_not_a_real_key");
const originalSecret=process.env.STRIPE_WEBHOOK_SECRET;process.env.STRIPE_WEBHOOK_SECRET="whsec_local_fixture";
const sub={id:"sub_test",customer:"cus_test",metadata:{organization_id:"org"},status:"trialing",trial_start:100,trial_end:432100,cancel_at_period_end:false,items:{data:[{price:{id:"price_premium"},current_period_start:100,current_period_end:432100}]}};
let f;
function reset(){f={existing:{trial_used:false,stripe_customer_id:"cus_test",stripe_subscription_id:"sub_test"},sub:{...sub},processed:false,saved:[],deleted:false};f.db={from(table){let write,payload;const q={select(){return q},eq(){return q},maybeSingle(){return q},upsert(p){write="upsert";payload=p;return q},update(p){write="update";payload=p;return q},then(resolve){if(table==="organization_subscriptions"&&write){f.saved.push(payload);f.existing=payload}if(table==="stripe_webhook_events"&&payload?.processed_at)f.processed=true;resolve({data:table==="stripe_webhook_events"?{processed_at:f.processed?"done":null}:table==="deleted_workspaces"?(f.deleted?{}:null):f.existing,error:null})}};return q}};f.stripe={webhooks:sdk.webhooks,subscriptions:{async retrieve(id){return id==="sub_current"?{status:"active"}:f.sub},async cancel(){f.canceled=true}}};globalThis.fixture=f}
async function post(type,object,bad=false){const payload=JSON.stringify({id:"evt_fixture",type,data:{object}});const signature=bad?"invalid":sdk.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET});return mod.exports.POST(new Request("https://opryn.test/api/billing/webhook",{method:"POST",headers:{"stripe-signature":signature},body:payload}))}
reset();assert.equal((await post("customer.subscription.created",sub,true)).status,400);assert.equal(f.saved.length,0);
reset();assert.equal((await post("customer.subscription.created",sub)).status,200);assert.equal(f.saved[0].status,"trialing");assert.equal(f.saved[0].trial_used,true);assert.equal(f.saved[0].trial_end,new Date(432100000).toISOString());await post("customer.subscription.created",sub);assert.equal(f.saved.length,1);
reset();f.sub={...sub,status:"active"};await post("checkout.session.completed",{subscription:"sub_test"});assert.equal(f.saved[0].status,"active");
for(const [event,status] of [["invoice.paid","active"],["invoice.payment_failed","past_due"]]){reset();f.sub={...sub,status};await post(event,{parent:{subscription_details:{subscription:"sub_test"}}});assert.equal(f.saved[0].status,status)}
reset();f.existing.stripe_subscription_id="sub_current";f.sub={...sub,status:"canceled"};await post("customer.subscription.deleted",sub);assert.equal(f.saved.length,0);
reset();f.deleted=true;await post("customer.subscription.created",sub);assert.equal(f.canceled,true);assert.equal(f.saved.length,0);
reset();f.sub={...sub,trial_start:null,trial_end:null,status:"active"};await post("customer.subscription.updated",sub);assert.equal(f.saved[0].trial_used,false);
if(originalSecret===undefined)delete process.env.STRIPE_WEBHOOK_SECRET;else process.env.STRIPE_WEBHOOK_SECRET=originalSecret;delete globalThis.fixture;
console.log("PASS actual Stripe signature + mocked webhook state: trial, paid, invoice failure, replay, late previous subscription, deleted workspace, no false trial consumption");
