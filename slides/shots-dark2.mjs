// The assistant answer and the Model page, dark. node shots-dark2.mjs
import path from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({ chromiumSandbox: false, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: "dark" });
const page = await ctx.newPage();
const out = (n) => path.join("assets/shots", n);
const settle = (ms) => page.waitForTimeout(ms);
await page.goto("http://127.0.0.1:3000/alerts", { waitUntil: "networkidle" }); await settle(3000);
let box = page.getByPlaceholder(/Ask about haze/).first();
if (!(await box.isVisible().catch(() => false))) {
  const ask = page.getByRole("button", { name: /Ask Haze/ }).first();
  await ask.click({ force: true }); await settle(1000);
  box = page.getByPlaceholder(/Ask about haze/).first();
}
await box.click(); await box.fill("Will schools in Johor Bahru close on Monday?"); await page.keyboard.press("Enter");
const t0 = Date.now();
while (Date.now() - t0 < 240000) {
  await settle(3000);
  const html = await page.content();
  const stop = await page.getByRole("button", { name: /^Stop/ }).count();
  if (html.includes("Tools used") && !stop) break;
}
await settle(2000);
await page.screenshot({ path: out("dark-chat.png") }); console.log("dark-chat", Math.round((Date.now() - t0) / 1000), "s");
const aside = page.locator("aside").last();
try { await aside.screenshot({ path: out("dark-chat-dock.png") }); console.log("dark-chat-dock"); } catch (e) { console.log("no aside shot", e.message); }
await page.goto("http://127.0.0.1:3000/model", { waitUntil: "networkidle" }); await settle(4000);
await page.screenshot({ path: out("dark-model.png") }); console.log("dark-model");
await browser.close();
