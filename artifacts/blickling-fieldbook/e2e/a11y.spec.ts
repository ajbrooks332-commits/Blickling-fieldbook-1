import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// The suite runs signed in via a shared storage state (see global-setup.ts);
// the login-page test opts out of it below.

// Fail on serious/critical axe violations; log the rest for review.
async function expectNoSeriousViolations(page: Page, context: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"]).analyze();
  const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  if (results.violations.length) {
    console.log(`[axe] ${context}: ${results.violations.map((v) => `${v.id}(${v.impact})x${v.nodes.length}`).join(", ")}`);
    for (const v of serious) {
      for (const node of v.nodes.slice(0, 10)) {
        console.log(`[axe]   ${v.id}: ${node.target.join(" ")} — ${node.failureSummary?.split("\n")[1] ?? ""}`);
      }
    }
  }
  expect(serious, `${context}: serious/critical axe violations: ${serious.map((v) => v.id).join(", ")}`).toEqual([]);
}

test.describe("login page (signed out)", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("passes axe and shows visible keyboard focus", async ({ page }) => {
    await page.goto("/login");
    await expectNoSeriousViolations(page, "login");

    // Keyboard-only: first Tab must land on a control with visible focus.
    await page.keyboard.press("Tab");
    const focusVisible = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return false;
      const style = getComputedStyle(el);
      return style.outlineStyle !== "none" || style.boxShadow !== "none";
    });
    expect(focusVisible).toBe(true);
  });
});

test.describe("accessibility (signed in)", () => {
  for (const path of ["/", "/observations", "/actions", "/activities", "/reports"]) {
    test(`page ${path} passes axe`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expectNoSeriousViolations(page, path);
    });
  }

  test("200% zoom keeps the observations page usable", async ({ page }) => {
    await page.goto("/observations");
    await page.waitForLoadState("networkidle");
    // Emulate 200% zoom (WCAG 1.4.4/1.4.10) by halving the viewport.
    await page.setViewportSize({ width: 640, height: 360 });
    // No horizontal scrolling of the document and primary heading visible.
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(24);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("touch targets on mobile are at least 24px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile project only");
    await page.goto("/actions");
    await page.waitForLoadState("networkidle");
    const tooSmall = await page.evaluate(() => {
      const interactive = Array.from(document.querySelectorAll<HTMLElement>("a, button, input, select"));
      return interactive
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ tag: el.tagName, text: (el.textContent ?? "").trim().slice(0, 30), rect: el.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && rect.height > 0 && (rect.height < 24 || rect.width < 24))
        .map(({ tag, text }) => `${tag}:${text}`);
    });
    expect(tooSmall, `Interactive elements under 24px: ${tooSmall.join(", ")}`).toEqual([]);
  });
});
