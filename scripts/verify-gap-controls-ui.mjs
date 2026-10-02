// Actual React components with mock HTTP. Not an authenticated database journey.
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
const { build } = await import(pathToFileURL(process.env.OPRYN_ESBUILD_MODULE));
const root=process.cwd();
const bundle=await build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import {GapQuestionActions,ClarificationReplies} from './components/app/gap-question-actions';createRoot(document.getElementById('root')).render(<main style={{maxWidth:640,margin:'30px auto',padding:24}}><h1>Knowledge gap · Example fixture</h1><p>Can a manager refund $700?</p>{location.search.includes('reply')?<ClarificationReplies items={[{id:'clarification',questionId:'question',question:'Can a manager refund $700?',message:'Which customer type?'}]}/>:<GapQuestionActions questionId="question" onClose={()=>{window.fixtureClosed=true}}/>}</main>);`,resolveDir:root,loader:"jsx"},bundle:true,write:false,format:"iife",platform:"browser",jsx:"automatic",alias:{"@":root},plugins:[{name:"fixture-router",setup(b){b.onResolve({filter:/^next\/navigation$/},a=>({path:a.path,namespace:"fixture"}));b.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:"export const useRouter=()=>({refresh:()=>{window.fixtureRefresh=true}})",loader:"js"}));}}]});
const css=readdirSync(".next/static/css").filter(f=>f.endsWith(".css")).map(f=>readFileSync(resolve(".next/static/css",f),"utf8")).join("\n");
const server=createServer((req,res)=>{res.setHeader("content-type",req.url==="/fixture.js"?"text/javascript":"text/html");res.end(req.url==="/fixture.js"?bundle.outputFiles[0].text:`<html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body class="opryn-app" style="background:#fffcf7;color:#14213d"><div id="root"></div><script src="/fixture.js"></script></body></html>`)});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
mkdirSync("artifacts/operational-platform",{recursive:true});
const browser=await chromium.launch();
try{
const page=await browser.newPage(); const errors=[];let admin=true,fail=false,payload;
page.on("pageerror",e=>errors.push(e.message));
await page.route("**/api/questions/question/manage",async route=>{if(route.request().method()==="GET")await route.fulfill({json:{canReroute:admin,assignedExpertId:"expert",people:[{id:"expert",name:"Support Lead"},{id:"owner",name:"Workspace owner"}],clarifications:[]}});else{payload=route.request().postDataJSON();await route.fulfill({status:fail?503:200,json:fail?{error:"Try again safely"}:{ok:true,clarificationId:"clarification"}})}});
for(const width of [1440,390]){
await page.setViewportSize({width,height:900});await page.goto(`http://127.0.0.1:${server.address().port}`);
await page.getByRole("combobox").selectOption("owner");await page.getByRole("button",{name:"Reassign",exact:true}).click();await expect(page.getByRole("status")).toContainText("Approval authority is unchanged");assert.equal(payload.expertId,"owner");
await page.getByRole("textbox").fill("Which customer type?");fail=true;await page.getByRole("button",{name:"Ask for clarification"}).click();await expect(page.getByRole("alert")).toContainText("Try again");await expect(page.getByRole("button",{name:"Ask for clarification"})).toBeEnabled();
fail=false;await page.getByRole("button",{name:"Ask for clarification"}).click();await expect(page.getByText("Waiting for clarification")).toBeVisible();assert.equal(payload.action,"request_clarification");await expect(page.getByRole("button",{name:"Ask for clarification"})).toBeDisabled();
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`artifacts/operational-platform/gap-controls-${width}.png`,fullPage:true});
await page.goto(`http://127.0.0.1:${server.address().port}/?reply`);await page.getByRole("textbox").fill("Enterprise customer");await page.screenshot({path:`artifacts/operational-platform/clarification-reply-${width}.png`,fullPage:true});await page.getByRole("button",{name:"Send context"}).click();await expect(page.getByRole("status")).toContainText("not approved company knowledge");assert.equal(payload.clarificationId,"clarification");assert.equal(payload.action,"reply");
}
admin=false;await page.goto(`http://127.0.0.1:${server.address().port}`);await expect(page.getByRole("button",{name:"Ask for clarification"})).toBeVisible();await expect(page.getByRole("combobox")).toHaveCount(0);
assert.deepEqual(errors,[]);
console.log("PASS: desktop/mobile actual controls, reroute payload, error recovery, pending clarification, exact reply identity, non-admin UI and no overflow/console errors. Screenshots are component fixtures.");
}finally{await browser.close();await new Promise(r=>server.close(r));}
