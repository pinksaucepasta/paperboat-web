import { expect, test } from "@playwright/test";

const controlPlaneURL = "http://127.0.0.1:43001";

test.setTimeout(60_000);

test.beforeEach(async ({ page, request }) => {
  await request.post(controlPlaneURL + "/__test/reset");
  await request.post(controlPlaneURL + "/__test/environment-client-only");
  await page.goto("/auth/dev-login");
  await page.waitForURL(/\/dashboard$/, { waitUntil: "networkidle" });
  await page.goto("/dashboard/environment-variables");
  await expect(page.getByRole("heading", { name: "ENV Injection", exact: true })).toBeVisible();
});

test("offers only host-capable machines for injection", async ({ page }) => {
  const selector = page.getByLabel("Machine for environment variables");
  await expect(selector.locator("option")).toHaveCount(1);
  await expect(selector).not.toContainText("Client-only machine");
});

test("writes values without rendering them and shows the pending state", async ({ page }) => {
  const secret = "super-secret-value-do-not-render";
  const name = page.getByLabel("Variable name").first();
  const value = page.getByLabel("Value", { exact: true }).first();

  await name.fill("APP_API_KEY");
  await value.fill(secret);
  await page.getByRole("button", { name: "Save" }).first().click();

  await expect(page.getByText("APP_API_KEY saved for account defaults.")).toBeVisible();
  await expect(page.getByText("APP_API_KEY", { exact: true })).toBeVisible();
  await expect(value).toHaveValue("");
  await expect(page.locator("body")).not.toContainText(secret);

  const machinePanel = page.getByRole("region", { name: "Machine overrides" });
  await machinePanel.getByLabel("Variable name").fill("APP_API_KEY");
  const machineValue = machinePanel.getByLabel("Value", { exact: true });
  await machineValue.fill("machine-pending-secret");
  await machinePanel.getByRole("button", { name: "Save" }).click();
  await expect(machinePanel.getByText("Pending", { exact: true })).toBeVisible();
  await expect(machineValue).toHaveValue("");
  await expect(page.locator("body")).not.toContainText("machine-pending-secret");
});

test("removes a variable only after confirmation and sends the current scope version", async ({ page }) => {
  const remove = page.getByRole("button", { name: "Remove" }).first();
  await remove.click();

  const dialog = page.getByRole("alertdialog", { name: "Remove APP_REGION?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Existing processes keep their current environment");
  await dialog.getByRole("button", { name: "Keep variable" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText("APP_REGION", { exact: true })).toBeVisible();

  await remove.click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove variable" }).click();
  await expect(page.getByText("APP_REGION removed from account defaults.")).toBeVisible();
  await expect(page.getByText("APP_REGION", { exact: true })).toHaveCount(0);
});

test("surfaces a revision conflict without retaining the submitted value", async ({ page, request }) => {
  await request.post(controlPlaneURL + "/__test/environment-conflict");
  const secret = "conflict-secret-value";
  await page.getByLabel("Variable name").first().fill("APP_CONFLICT");
  const value = page.getByLabel("Value", { exact: true }).first();
  await value.fill(secret);
  await page.getByRole("button", { name: "Save" }).first().click();

  await expect(page.getByText("Refresh required", { exact: true })).toBeVisible();
  await expect(page.getByText("changed before the save landed.")).toBeVisible();
  await expect(value).toHaveValue("");
  await expect(page.locator("body")).not.toContainText(secret);
});

test("does not echo a rejected value in the save error", async ({ page, request }) => {
  await request.post(controlPlaneURL + "/__test/environment-echo");
  const secret = "echo-secret-value\nwith-\"quoted-fragment\"";
  await page.getByLabel("Variable name").first().fill("APP_ECHO");
  const value = page.getByLabel("Value", { exact: true }).first();
  await value.fill(secret);
  await page.getByRole("button", { name: "Save" }).first().click();

  await expect(page.getByText("Environment variable could not be saved.", { exact: true })).toBeVisible();
  await expect(value).toHaveValue("");
  await expect(page.locator("body")).not.toContainText("echo-secret-value");
  await expect(page.locator("body")).not.toContainText("quoted-fragment");
});

test("keeps machine overrides understandable while the machine is offline", async ({ page, request }) => {
  await request.post(controlPlaneURL + "/__test/offline");
  await page.reload();
  await expect(page.getByText("Studio machine is offline")).toBeVisible();

  await page.getByLabel("Machine for environment variables").selectOption("mch_browser_test");
  const machinePanel = page.getByRole("region", { name: "Machine overrides" });
  await machinePanel.getByLabel("Variable name").fill("APP_OFFLINE");
  await machinePanel.getByLabel("Value", { exact: true }).fill("offline-secret-value");
  await machinePanel.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("APP_OFFLINE saved for Studio machine overrides.")).toBeVisible();
  await expect(
    machinePanel.getByRole("listitem").filter({ hasText: "APP_OFFLINE" }).getByLabel("Offline"),
  ).toBeVisible();
  await expect(page.locator("body")).not.toContainText("offline-secret-value");
});
