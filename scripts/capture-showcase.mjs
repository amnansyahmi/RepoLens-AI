import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const target = process.env.SHOWCASE_URL || "http://127.0.0.1:5173";
await mkdir("docs/assets", { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    reducedMotion: "reduce", colorScheme: "light"
  });
  page.on("pageerror", error => { console.error("Browser error:", error.message); });
  await page.goto(target, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator("#architecture").waitFor({ state: "visible", timeout: 30_000 });
  await page.screenshot({ path: "docs/assets/homepage-screenshot.png", animations: "disabled" });
  await page.getByRole("button", { name: /See demo/i }).click();
  await page.waitForFunction(() => document.querySelectorAll(".react-flow__node").length >= 5, { timeout: 25_000 });
  await page.locator("#architecture").screenshot({ path: "docs/assets/architecture-screenshot.png", animations: "disabled" });
  await page.locator("#health").scrollIntoViewIfNeeded();
  await page.locator("#health").screenshot({ path: "docs/assets/health-report-screenshot.png", animations: "disabled" });
  await page.locator("#byok").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "docs/assets/byok-walkthrough-frame.png", animations: "disabled" });
  console.log("Saved real product screenshots from built-in demo (no API keys used).");
} finally {
  await browser.close();
}
