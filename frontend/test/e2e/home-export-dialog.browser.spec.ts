import { expect, test } from "@playwright/test";

// Dialog-only coverage uses collection-scoped API fixtures. CSV download/content
// coverage belongs to the subsequent download story.
test.beforeEach(async ({ context, page, baseURL }) => {
  test.setTimeout(90000);
  await context.addCookies([{ name: "hb.auth.session", value: "true", url: baseURL! }]);
  await page.route(
    url => url.pathname.startsWith("/api/"),
    async route => {
      const url = new URL(route.request().url());
      const path = url.pathname;
      const collection = route.request().headers()["x-tenant"] === "second" ? "Second" : "First";
      let body: unknown = {};
      if (path.endsWith("/users/self"))
        body = {
          item: {
            id: "user",
            name: "Dialog Tester",
            email: "dialog@example.com",
            defaultGroupId: "first",
            groupId: "first",
            isOwner: true,
          },
        };
      else if (path.endsWith("/users/self/settings")) body = { item: {} };
      else if (path.endsWith("/groups/statistics"))
        body = { totalItems: 42, totalLocations: 1, totalTags: 1, totalItemPrice: 100 };
      else if (path.endsWith("/groups/all"))
        body = [
          { id: "first", name: "First collection" },
          { id: "second", name: "Second collection" },
        ];
      else if (path.endsWith("/groups/self") || path.endsWith("/groups/first") || path.endsWith("/groups/second"))
        body = { id: "first", name: "First collection", currency: "USD" };
      else if (path.endsWith("/entities/fields/values")) body = ["Blue", "Red"];
      else if (path.endsWith("/entities/fields")) body = [collection + " color"];
      else if (path.endsWith("/tags")) body = [{ id: collection + "-tag", name: collection + " tag" }];
      else if (path.endsWith("/entities"))
        body = {
          items:
            url.searchParams.get("isLocation") === "true"
              ? [{ id: collection + "-location", name: collection + " room" }]
              : [],
          total: 0,
        };
      else if (path.endsWith("/status"))
        body = {
          health: true,
          build: { version: "1.0.0", commit: "test" },
          versions: { latest: "1.0.0", current: "1.0.0" },
        };
      await route.fulfill({ json: body });
    }
  );
  await page.goto("/home");
  await expect(page.getByRole("button", { name: "Export CSV", exact: true })).toBeEnabled({ timeout: 60000 });
});

for (const mobile of [false, true]) {
  test(`filters, reset, cancel and keyboard access (${mobile ? "mobile" : "desktop"})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    let downloads = 0;
    page.on("download", () => downloads++);
    const before = await page.locator("main").innerText();
    const action = page.getByRole("button", { name: "Export CSV", exact: true });
    await action.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Export CSV" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Include Archived")).not.toBeChecked();
    await dialog.getByLabel("Search", { exact: true }).fill("#000-123");
    await dialog.getByLabel("Include Archived").click();
    await dialog.getByLabel("Only items with photo").click();
    await dialog.getByLabel("Only items without photo").click();
    await expect(dialog.getByLabel("Only items with photo")).not.toBeChecked();
    await expect(dialog.getByLabel("Only items without photo")).toBeChecked();
    await dialog.getByRole("button", { name: /^Locations/ }).click();
    await page.getByText("First room", { exact: true }).last().click();
    await page.keyboard.press("Escape");
    await dialog.getByRole("button", { name: /^Tags/ }).click();
    await page.getByText("First tag", { exact: true }).last().click();
    await page.keyboard.press("Escape");
    await dialog.getByLabel("Negate Selected Tags").click();
    await dialog.getByRole("button", { name: "Add", exact: true }).click();
    await dialog.getByLabel("Field", { exact: true }).click();
    await page.getByRole("option", { name: "First color" }).click();
    await dialog.getByLabel("Field Value", { exact: true }).click();
    await page.getByRole("option", { name: "Blue" }).click();
    await dialog.getByRole("button", { name: "Reset filters" }).click();
    await expect(dialog.getByLabel("Search", { exact: true })).toHaveValue("");
    await expect(dialog.getByLabel("Include Archived")).not.toBeChecked();
    await expect(dialog.getByLabel("Negate Selected Tags")).not.toBeChecked();
    await expect(dialog.getByLabel("Only items without photo")).not.toBeChecked();
    await expect(dialog.getByLabel("Field", { exact: true })).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Locations", exact: true })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Tags", exact: true })).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(mobile ? 390 : 1280);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(action).toBeFocused();
    expect(await page.locator("main").innerText()).toBe(before);
    await action.click();
    await dialog.getByLabel("Search", { exact: true }).fill("discard this");
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await action.click();
    await expect(dialog.getByLabel("Search", { exact: true })).toHaveValue("");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/home$/);
    expect(downloads).toBe(0);
  });
}

test("collection switch discards filters and offers only new collection options", async ({ page }) => {
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Export CSV" });
  await dialog.getByLabel("Search", { exact: true }).fill("old collection");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("combobox", { name: "Select Collection" }).click();
  await page.getByRole("option", { name: "Second collection" }).click();
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  await expect(dialog.getByLabel("Search", { exact: true })).toHaveValue("");
  await dialog.getByRole("button", { name: /^Locations/ }).click();
  await expect(page.getByText("Second room", { exact: true }).last()).toBeVisible();
  await expect(page.getByText("First room", { exact: true })).toHaveCount(0);
});
