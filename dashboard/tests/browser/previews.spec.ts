import { expect, test } from "@playwright/test";

const controlPlaneURL = "http://127.0.0.1:43001";

test.beforeEach(async ({ page, request }) => {
  await request.post(controlPlaneURL + "/__test/reset");
  await page.addInitScript(() => {
    let copied = "";
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        readText: async () => copied,
        writeText: async (value: string) => { copied = value; },
      },
    });
  });
  await page.goto("/auth/dev-login");
  await page.waitForURL(/\/dashboard$/, { waitUntil: "networkidle" });
  await page.goto("/dashboard/previews");
  await expect(page.getByRole("heading", { name: "Previews", exact: true })).toBeVisible();
});

test("creates a preview on an online device and shows its lifecycle details", async ({ page }) => {
  const card = page.getByTestId("preview-card-prv_docs");
  await expect(card).toContainText("http://127.0.0.1:3000");
  await expect(card).toContainText("Studio machine");
  await expect(card).toContainText("Public");
  await expect(card).toContainText("Accepting traffic");
  await expect(card).toContainText("Reachable");

  await card.getByRole("button", { name: "Copy URL", exact: true }).click();
  await expect(page.getByText("Preview URL copied.")).toBeVisible();

  await card.getByRole("button", { name: "View details" }).click();
  const detail = page.getByTestId("preview-detail");
  await expect(detail).toContainText("Owner session");
  await expect(detail).toContainText("ses_browser_test");
  await expect(detail.getByRole("link", { name: /docs\.preview/ })).toHaveAttribute(
    "target",
    "_blank",
  );

  await page.getByRole("button", { name: "Create preview" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Create preview" });
  await dialog.getByLabel("Port or origin URL").fill("4100");
  await dialog.getByLabel("Access").selectOption("private");
  await dialog.getByLabel("Maximum duration").selectOption("2h");
  await dialog.getByRole("button", { name: "Create preview", exact: true }).click();

  await expect(page.getByText("Preview ready.")).toBeVisible();
  const created = page.getByTestId("preview-card-prv_created");
  await expect(created).toContainText("http://127.0.0.1:4100");
  await expect(created).toContainText("Private");
  await expect(created).toContainText("Studio machine");
  await expect(created).toContainText("runtime on this machine");
  await expect(created).toContainText("local proxy/PAC rule enabled");
  await expect(created.getByRole("link", { name: /through the local Paperboat proxy/ })).toBeVisible();
});

test("stops a preview with the current ETag and removes it from active previews", async ({ page }) => {
  const card = page.getByTestId("preview-card-prv_docs");
  await card.getByRole("button", { name: "Stop preview", exact: true }).click();

  const dialog = page.getByRole("alertdialog", { name: "Stop this preview?" });
  await expect(dialog).toContainText("immediately revokes the temporary lease");
  await dialog.getByRole("button", { name: "Stop preview", exact: true }).click();

  await expect(page.getByText("Preview stopped.")).toBeVisible();
  await expect(page.getByTestId("preview-card-prv_docs")).toHaveCount(0);
});

test("shows disconnected and degraded origin states instead of a stale ready URL", async ({ page, request }) => {
  await expect(page.getByTestId("preview-card-prv_disconnected")).toContainText("Owner disconnected");
  await request.post(controlPlaneURL + "/__test/degraded");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();

  const card = page.getByTestId("preview-card-prv_docs");
  await expect(card).toContainText("Origin unavailable");
  await expect(card).toContainText("Waiting for origin");
});

test("gives an exact local command when no device is online", async ({ page, request }) => {
  await request.post(controlPlaneURL + "/__test/offline");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();

  const guidance = page.getByTestId("no-device-guidance").first();
  await expect(guidance).toContainText("No online device is available");
  await expect(guidance).toContainText("pb preview <port>");

  await page.getByRole("button", { name: "Create preview" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Create preview" });
  await expect(dialog).toContainText("Connect a device to create a preview");
  await expect(dialog.getByRole("button", { name: "Create preview", exact: true })).toBeDisabled();
});

test("offers retry after a control-plane read failure", async ({ page, request }) => {
  await request.post(controlPlaneURL + "/__test/fail-previews");
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.getByTestId("preview-load-error")).toContainText("Previews unavailable");

  await request.post(controlPlaneURL + "/__test/recover-previews");
  await page.getByTestId("preview-load-error").getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("preview-card-prv_docs")).toBeVisible();
});

test("never renders a served source path or reusable credential", async ({ page }) => {
  const text = await page.locator("body").innerText();
  expect(text).not.toContain("source_path");
  expect(text).not.toContain("/Users/");
  expect(text).not.toContain("/home/");
  expect(text).not.toContain("Bearer ");
  expect(text).not.toContain("private_key");
});
