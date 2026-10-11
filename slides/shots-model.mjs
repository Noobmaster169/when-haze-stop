// The Model page's change scatter and two Singapore panels, for the evidence slide.
// node shots-model.mjs
import path from "node:path";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({ chromiumSandbox: false, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 3, colorScheme: "dark" });
const page = await ctx.newPage();
await page.goto("http://127.0.0.1:3000/model", { waitUntil: "networkidle" });
await page.waitForTimeout(5000);
const closeDock = page.locator("aside button[aria-label*='lose' i]").first();
if (await closeDock.count()) { try { await closeDock.click({ timeout: 2000 }); } catch {} }
const snap = async (name, loc) => {
  await loc.scrollIntoViewIfNeeded(); await page.waitForTimeout(800);
  await loc.screenshot({ path: path.join("assets/shots", `${name}.png`) }); console.log(name);
};
await snap("model-scatter", page.locator("svg", { hasText: "perfect forecast" }).first().locator("xpath=../.."));
for (const region of ["Central", "North"]) {
  await snap(`model-sg-${region.toLowerCase()}`, page.locator("figure", { hasText: `Singapore ${region}` }).first());
}
await browser.close();
