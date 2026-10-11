// Dark-mode screenshots of the running app: map, station panel, a followed area's alert card,
// a real assistant answer, the Model page. node shots-dark.mjs
import path from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({ chromiumSandbox: false, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: "dark" });
const page = await ctx.newPage();
const out = (n) => path.join("assets/shots", n);
const settle = (ms) => page.waitForTimeout(ms);

await page.goto("http://127.0.0.1:3000/map", { waitUntil: "networkidle" });
await settle(7000);
const notNow = page.getByRole("button", { name: "Not now" });
if (await notNow.count()) await notNow.first().click();
const closeDock = page.locator("aside button[aria-label*='lose' i]").first();
if (await closeDock.count()) { try { await closeDock.click({ timeout: 2000 }); } catch {} }
await settle(1500);
await page.screenshot({ path: out("dark-map.png") }); console.log("dark-map");

const search = page.getByPlaceholder("Search a town or district").first();
await search.click(); await search.fill("Pasir Gudang"); await settle(1500); await page.keyboard.press("Enter"); await settle(5000);
const alertMe = page.getByRole("button", { name: /Alert me here/ });
if (await alertMe.count()) { await alertMe.first().click(); await settle(2000); }
await page.screenshot({ path: out("dark-panel.png") }); console.log("dark-panel");

await page.goto("http://127.0.0.1:3000/alerts", { waitUntil: "networkidle" }); await settle(4000);
await page.screenshot({ path: out("dark-alerts.png") }); console.log("dark-alerts");

const ask = page.getByRole("button", { name: /Ask Haze/ });
if (await ask.count()) { await ask.first().click(); await settle(1000); }
const box = page.getByPlaceholder(/Ask about haze/).first();
await box.click(); await box.fill("Will schools in Johor Bahru close on Monday?"); await page.keyboard.press("Enter");
const t0 = Date.now();
while (Date.now() - t0 < 180000) {
  await settle(3000);
  const html = await page.content();
  if (html.includes("Tools used") && !(await page.getByRole("button", { name: /Stop/ }).count())) break;
}
await settle(1500);
await page.screenshot({ path: out("dark-chat.png") }); console.log("dark-chat", Math.round((Date.now() - t0) / 1000), "s");
const aside = page.locator("aside").last();
try { await aside.screenshot({ path: out("dark-chat-dock.png") }); console.log("dark-chat-dock"); } catch (e) { console.log("no aside shot", e.message); }

await page.goto("http://127.0.0.1:3000/model", { waitUntil: "networkidle" }); await settle(4000);
if (await closeDock.count()) { try { await closeDock.click({ timeout: 2000 }); } catch {} }
await settle(500);
await page.screenshot({ path: out("dark-model.png") }); console.log("dark-model");
await browser.close();
