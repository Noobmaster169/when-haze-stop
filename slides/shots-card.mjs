// Follow Pasir Gudang on the alerts page and shoot the area card, dark. node shots-card.mjs
import path from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({ chromiumSandbox: false, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, colorScheme: "dark" });
const page = await ctx.newPage();
const settle = (ms) => page.waitForTimeout(ms);
await page.goto("http://127.0.0.1:3000/alerts", { waitUntil: "networkidle" }); await settle(2500);
const close = page.locator("aside button[aria-label*='lose' i]").first();
if (await close.count()) { try { await close.click({ timeout: 1500 }); } catch {} }
const search = page.getByPlaceholder("Search a town or district").first();
await search.click(); await search.fill("Pasir Gudang"); await settle(2500);
const opt = page.getByRole("option").first();
if (await opt.count()) await opt.click(); else await page.keyboard.press("Enter");
await settle(4000);
await page.screenshot({ path: path.join("assets/shots", "dark-alerts-card.png") });
const card = page.locator("section").filter({ hasText: "My areas" }).first();
try { await card.screenshot({ path: path.join("assets/shots", "dark-card.png") }); console.log("card"); } catch (e) { console.log("no card", e.message); }
await browser.close();
