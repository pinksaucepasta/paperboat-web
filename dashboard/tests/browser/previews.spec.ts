import { expect, test } from "@playwright/test";

const controlPlaneURL = "http://127.0.0.1:43001";

test.beforeEach(async ({ page, request }) => {
  await request.post(controlPlaneURL + "/__test/reset");
  await page.goto("/auth/dev-login");
  await page.waitForURL(/\/dashboard$/, { waitUntil: "networkidle" });
  await page.goto("/dashboard/previews");
  await expect(page.getByRole("heading", { name: "Previews" })).toBeVisible();
});

test("labels served previews and stops them through canonical revoke", async ({ page }) => {
  const servedRow = page.locator("div.divide-y > div").filter({ hasText: "docs" });
  await expect(servedRow).toContainText("directory");
  await expect(servedRow).toContainText("Personal Linux");
  await page.getByRole("button", { name: "Stop serving" }).click();

  const dialog = page.getByRole("alertdialog", { name: "Stop serving docs?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("stops the local static server");
  await dialog.getByRole("button", { name: "Stop serving" }).click();

  await expect(page.getByText("Serving stopped.")).toBeVisible();
  await expect(page.getByText("docs", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Revoke" })).toBeVisible();
});

test("never renders a served source path", async ({ page }) => {
  const text = await page.locator("body").innerText();
  expect(text).not.toContain("source_path");
  expect(text).not.toContain("/Users/");
  expect(text).not.toContain("/home/");
});
