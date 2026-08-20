import { expect, test } from "@playwright/test";

const controlPlaneURL = "http://127.0.0.1:43001";

test.beforeEach(async ({ page, request }) => {
  await request.post(controlPlaneURL + "/__test/reset");
  await page.goto("/auth/dev-login");
  await page.waitForURL(/\/dashboard$/, { waitUntil: "networkidle" });
  await page.goto("/dashboard/machines");
  await expect(page.getByRole("heading", { name: "Machines", exact: true })).toBeVisible();
});

test("uses a downloaded credential file for native Windows enrollment without rendering the bearer token", async ({ page }) => {
  await page.getByRole("button", { name: "Add machine" }).first().click();

  const enrollment = page.getByRole("region", { name: "User-machine enrollment" });
  await expect(enrollment.getByRole("heading", { name: "Set up a Windows machine" })).toBeVisible();
  await expect(enrollment.getByRole("heading", { name: "Windows amd64" })).toBeVisible();
  await expect(enrollment.getByRole("heading", { name: "Windows arm64" })).toBeVisible();
  await expect(enrollment.getByText("Beta", { exact: true })).toBeVisible();
  await expect(enrollment).not.toContainText("bootstrap-token-browser-test");
  await expect(enrollment).not.toContainText("curl https://example.test/install");
  await expect(enrollment.getByText("--enrollment-token-file $EnrollmentFile").first()).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await enrollment.getByRole("button", { name: "Download enrollment file" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("paperboat-enrollment-enr_browser_test.token");
});

test("keeps the Windows enrollment commands free of bearer tokens", async ({ page }) => {
  await page.getByRole("button", { name: "Add machine" }).first().click();
  const command = page.locator("code").filter({ hasText: "pb pair --server" }).first();
  await expect(command).toContainText("$env:USERPROFILE");
  await expect(command).toContainText("--enrollment-token-file $EnrollmentFile");
  await expect(command).toContainText("icacls.exe");
  await expect(command).not.toContainText("bootstrap-token-browser-test");
  await expect(page.getByRole("button", { name: "Copy Windows amd64 enrollment command" })).toBeVisible();
});

test("renames an enrolled machine", async ({ page }) => {
  await page.getByRole("button", { name: "Rename" }).click();

  const dialog = page.getByRole("dialog", { name: "Rename machine" });
  const name = dialog.getByLabel("Machine name");
  await expect(name).toHaveValue("Studio machine");
  await name.fill("Workshop machine");
  await dialog.getByRole("button", { name: "Save name" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("heading", { name: "Workshop machine" })).toBeVisible();
});
