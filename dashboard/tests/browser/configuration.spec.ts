import { expect, test } from "@playwright/test";

const controlPlaneURL = "http://127.0.0.1:43001";

test.beforeEach(async ({ page, request }) => {
  await request.post(controlPlaneURL + "/__test/reset");
  await page.goto("/auth/dev-login");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/dashboard/configuration");
  await expect(page.getByRole("heading", { name: "Configuration" })).toBeVisible();
  await expect(page.getByText("paperboat/config-private").first()).toBeVisible();
});

test("requires the current named BYOD warning before enabling sync", async ({ page }) => {
  const selector = page.getByLabel("Repository for Personal Linux");
  await selector.selectOption("cfgrepo_test");

  const dialog = page.getByRole("dialog", {
    name: "Allow configuration changes on Personal Linux?",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("paperboat/config-private");
  await expect(dialog).toContainText("/home/sailor");
  await expect(dialog).toContainText("Normalized relative paths and bounded file metadata");
  await expect(dialog).toContainText("Offline changes remain local");
  await expect(dialog).toContainText("Remove consent or assignment to stop synchronization immediately");

  const confirm = dialog.getByRole("button", { name: "Accept and enable" });
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("checkbox").check();
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page.getByRole("button", { name: "Remove consent" })).toBeVisible();
  await expect(page.getByText("Configuration sync enabled on Personal Linux.")).toBeVisible();
});

test("surfaces stale consent without silently enabling BYOD", async ({ page, request }) => {
  await page.getByLabel("Repository for Personal Linux").selectOption("cfgrepo_test");
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  await request.post(controlPlaneURL + "/__test/stale-consent");
  await dialog.getByRole("button", { name: "Accept and enable" }).click();

  await expect(page.getByText("Configuration could not be changed.")).toBeVisible();
  await expect(page.getByText("The assignment changed. Refresh and review the current warning.")).toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove consent" })).toHaveCount(0);
});

test("resolves a conflict only with its current revisions", async ({ page }) => {
  const conflict = page.getByText(".config/editor/settings.json").locator("..");
  await expect(conflict).toContainText("Hosted development");
  await page.getByRole("button", { name: "Keep repository" }).click();

  await expect(page.getByText("Resolution queued for .config/editor/settings.json.")).toBeVisible();
  await expect(page.getByText("No concurrent changes need resolution.")).toBeVisible();
});

test("keeps controls labelled, keyboard reachable, responsive, and redacted", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Repository for Personal Linux")).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh GitHub access" })).toBeVisible();

  await page.getByLabel("Repository for Personal Linux").focus();
  await expect(page.getByLabel("Repository for Personal Linux")).toBeFocused();
  await page.getByLabel("Repository for Personal Linux").selectOption("cfgrepo_test");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const text = await page.locator("body").innerText();
  expect(text).not.toContain("github_pat_");
  expect(text).not.toContain("Authorization: Bearer");
  expect(text).not.toContain("https://github.com/paperboat/config-private.git");
  expect(text).not.toContain("repo_external_test");
});
