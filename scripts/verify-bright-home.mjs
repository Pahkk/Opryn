import assert from "node:assert/strict";
import { chromium, webkit, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
const base = process.env.HOME_URL || "http://localhost:3224";
const dir = "artifacts/bright-identity";
mkdirSync(dir, { recursive: true });
for (const [name, engine] of [["chromium", chromium], ["webkit", webkit]]) {
  const browser = await engine.launch();
  const context = await browser.newContext({recordVideo: name === "chromium" ? {dir: `${dir}/recordings`,size:{width:1440,height:900}} : undefined});
  const p = await context.newPage();
  const errors=[];
  p.on("pageerror",e=>errors.push(e.message));
  for (const width of [1440,768,390]) {
    await p.setViewportSize({width,height:900});
    await p.goto(base,{waitUntil:"networkidle"});
    await expect(p.locator("h1")).toHaveText("Teach your business once.");
    assert.equal(await p.locator("main").evaluate(e=>getComputedStyle(e).backgroundColor),"rgb(255, 252, 247)");
    await p.screenshot({path:`${dir}/${name}-hero-${width}.png`});
    const source=p.locator(".everywhere-source");
    await source.scrollIntoViewIfNeeded();
    const before=await source.boundingBox();
    for(const audience of ["A website bot","A teammate","A call agent","A teammate","A call agent"]) {
      await p.getByRole("button",{name:audience,exact:true}).click();
      await expect(p.getByRole("button",{name:audience,exact:true})).toHaveAttribute("aria-pressed","true");
    }
    await expect(p.locator(".everywhere-answer")).toContainText("project lead");
    assert.deepEqual(await source.boundingBox(),before,"Authority source must remain stable");
    await p.waitForTimeout(500);
    await expect(p.locator(".everywhere-answer article")).toHaveCount(1);
    await p.screenshot({path:`${dir}/${name}-answer-${width}.png`});
    await p.getByRole("button",{name:"View the actual interface"}).click();
    await expect(p.getByRole("dialog")).toBeVisible();
    await p.getByRole("tab",{name:"Knowledge",exact:true}).click();
    await expect(p.locator(".proof-slide")).toHaveCount(1);
    await p.keyboard.press("Escape");
    await expect(p.getByRole("dialog")).toHaveCount(0);
    await expect(p.getByRole("button",{name:"View the actual interface"})).toBeFocused();
    await p.getByRole("button",{name:"View the actual interface"}).click();
    await p.getByRole("button",{name:"Close interface preview"}).click();
    await expect(p.getByRole("dialog")).toHaveCount(0);
    await p.getByRole("button",{name:"View the actual interface"}).click();
    await p.getByRole("button",{name:"Close interface preview"}).click();
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    const final=p.locator(".editorial-final");
    await final.scrollIntoViewIfNeeded();
    await p.screenshot({path:`${dir}/${name}-final-${width}.png`});
    console.log(`${name} ${width}: bright theme, stable source, rapid audience changes, dialog/focus, no overflow`);
  }
  await p.emulateMedia({reducedMotion:"reduce"});
  await p.goto(base,{waitUntil:"networkidle"});
  await p.locator(".knowledge-centerpiece").scrollIntoViewIfNeeded();
  await expect(p.locator(".knowledge-centerpiece .pin-spacer")).toHaveCount(0);
  await expect(p.getByRole("heading",{name:"From information to trusted company knowledge."})).toBeVisible();
  assert.deepEqual(errors,[]);
  await context.close();
  await browser.close();
}
