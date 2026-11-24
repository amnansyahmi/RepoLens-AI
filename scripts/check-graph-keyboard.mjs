import assert from "node:assert/strict";
import { chromium } from "playwright";

const target = process.env.CHECK_URL || "http://127.0.0.1:5173";

async function hasFocus(locator) {
  return locator.evaluate(element => element === document.activeElement);
}

async function tabTo(page, locator) {
  for (let step = 0; step < 100; step++) {
    await page.keyboard.press("Tab");
    if (await hasFocus(locator)) return;
  }
  assert.fail(`Could not reach ${locator} with Tab`);
}

async function assertVisibleFocus(locator) {
  assert.ok(await hasFocus(locator), `${locator} should have focus`);
  const element = await locator.elementHandle();
  try {
    await locator.page().waitForFunction(node => {
      const style = getComputedStyle(node);
      return style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2;
    }, element, { timeout: 3_000 });
  } catch (error) {
    throw new Error(`${locator} should have a visible focus outline`, { cause: error });
  } finally {
    await element.dispose();
  }
}

async function checkFileDetails(page, touch) {
  const modules = page.getByRole("button", { name: "Modules" });
  const file = page.locator(".file-list button").first();
  const dialog = page.getByRole("dialog", { name: "File details" });
  const close = dialog.getByRole("button", { name: "Close file details" });
  const preview = dialog.getByRole("region", { name: "Source preview" });

  await tabTo(page, modules);
  await page.keyboard.press("Enter");
  await file.waitFor();
  await tabTo(page, file);
  await page.keyboard.press("Enter");
  await dialog.waitFor();
  await assertVisibleFocus(close);

  await page.keyboard.press("Tab");
  await assertVisibleFocus(preview);
  await page.keyboard.press("Tab");
  await assertVisibleFocus(close);
  await page.keyboard.press("Shift+Tab");
  await assertVisibleFocus(preview);
  await page.keyboard.press("Shift+Tab");
  await assertVisibleFocus(close);

  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.ok(await hasFocus(file), "Escape should restore focus to the module");

  await page.keyboard.press("Enter");
  await dialog.waitFor();
  await page.keyboard.press("Enter");
  await dialog.waitFor({ state: "hidden" });
  assert.ok(await hasFocus(file), "The Close button should restore focus to the module");

  await page.keyboard.press("Enter");
  await dialog.waitFor();
  const panel = await dialog.locator(".detail-panel").boundingBox();
  assert.ok(panel && panel.x > 0, "The backdrop should be reachable beside the panel");
  const x = panel.x / 2;
  const y = panel.y + panel.height / 2;
  if (touch) await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
  await dialog.waitFor({ state: "hidden" });
  assert.ok(await hasFocus(file), "The backdrop should restore focus to the module");
}

async function checkGraphNode(page) {
  const layers = page.getByRole("button", { name: "Layers", exact: true });
  const node = page.locator(".react-flow__node").first();
  const dialog = page.getByRole("dialog", { name: "File details" });
  const directoryFile = dialog.locator(".directory-detail button").first();

  await tabTo(page, layers);
  await page.keyboard.press("Enter");
  await tabTo(page, node);
  await assertVisibleFocus(node);
  await page.keyboard.press("Enter");
  await dialog.waitFor();
  await page.keyboard.press("Tab");
  assert.ok(await hasFocus(directoryFile), "Tab should reach a file within the directory");
  await page.keyboard.press("Enter");
  await dialog.getByRole("region", { name: "Source preview" }).waitFor();
  await assertVisibleFocus(dialog.getByRole("button", { name: "Close file details" }));
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  await assertVisibleFocus(node);
}

const browser = await chromium.launch();
try {
  for (const [name, options] of [
    ["desktop", { viewport: { width: 1440, height: 900 } }],
    ["mobile", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
  ]) {
    const page = await browser.newPage({ ...options, reducedMotion: "reduce" });
    try {
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(target, { waitUntil: "domcontentloaded" });
      await page.locator(".react-flow__node").first().waitFor();
      if (options.isMobile) {
        const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
        assert.ok(viewport && !/user-scalable\s*=\s*(?:no|0)\b|maximum-scale/i.test(viewport),
          "The viewport should allow pinch zoom");
        const contentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
        assert.ok(contentWidth <= options.viewport.width + 1,
          `Page content is ${contentWidth}px wide at a ${options.viewport.width}px viewport`);
      }
      await checkFileDetails(page, options.hasTouch);
      await checkGraphNode(page);
      assert.deepEqual(errors, [], "The browser should report no page errors");
      console.log(`PASS ${name} graph keyboard and file details checks`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
