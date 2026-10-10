import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig.js";
import { fileURLToPath } from "node:url";

// Isolated foundation fixture: exercises the real stylesheet and portal scopes
// without inventory data or API credentials. Functional shell tests belong to
// the following shell stories; these tests do not claim to cover authentication.
let css: string;
test.beforeAll(async () => {
  const source = await readFile(new URL("../../assets/css/main.css", import.meta.url), "utf8");
  css = (
    await postcss([
      tailwindcss({
        ...loadConfig(fileURLToPath(new URL("../../tailwind.config.js", import.meta.url))),
        content: [
          {
            raw: "bg-primary text-primary-foreground bg-popover text-popover-foreground",
            extension: "html",
          },
        ],
        corePlugins: { preflight: false },
      }),
    ]).process(source, { from: undefined })
  ).css;
});

for (const theme of ["theme-black", "theme-cupcake"]) {
  test.describe(`Home foundation over ${theme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setContent(`
        <style>${css}</style>
        <div id='theme' class='${theme}'>
          <main id='route' class='home-presentation'>
            <h1 class='home-headline'>A place for everything.</h1>
            <section class='home-section'>
              <h2 class='home-section-title'>Quick Statistics</h2>
              <article class='home-surface'>Inventory</article>
              <article class='home-statistic'><span class='home-statistic-value'>124</span></article>
              <article class='home-statistic home-statistic-featured'>
                <span class='home-statistic-value'>$4,820</span><span class='home-muted'>Recorded value</span>
              </article>
            </section>
            <button id='action' class='home-action'>Create</button>
            <button class='home-action home-action-outline'>Scanner</button>
            <button id='shared' class='bg-primary text-primary-foreground'>Shared button</button>
          </main>
          <aside id='unrelated' class='bg-primary text-primary-foreground'>Other route</aside>
          <div id='portal' class='home-presentation bg-popover text-popover-foreground'>Portal content</div>
        </div>
      `);
    });

    test("opt-in primitives and portal tokens use purple, neutral surfaces and local typography", async ({ page }) => {
      await expect(page.locator("#action")).toHaveCSS("background-color", "rgb(79, 37, 130)");
      await expect(page.locator("#shared")).toHaveCSS("background-color", "rgb(79, 37, 130)");
      await expect(page.locator("#route")).toHaveCSS("background-color", "rgb(247, 246, 249)");
      await expect(page.locator(".home-surface")).toHaveCSS("border-radius", "4px");
      await expect(page.locator(".home-surface")).toHaveCSS("border-top-color", "rgb(223, 219, 230)");
      await expect(page.locator(".home-surface")).toHaveCSS("background-color", "rgb(255, 255, 255)");
      await expect(page.locator(".home-statistic").first()).toHaveCSS("border-top-width", "3px");
      await expect(page.locator(".home-statistic-featured .home-statistic-value")).toHaveCSS(
        "color",
        "rgb(255, 255, 255)"
      );
      await expect(page.locator(".home-headline")).toHaveCSS("font-family", /Georgia/);
      await expect(page.locator(".home-section-title")).toHaveCSS("font-family", /Arial/);
      expect(
        await page.locator("#portal").evaluate(el => getComputedStyle(el).getPropertyValue("--primary").trim())
      ).toBe("267.0968 55.6886% 32.7451%");
    });

    test("removing the route and portal scope restores the selected theme without changing it", async ({ page }) => {
      const original = await page.locator("#unrelated").evaluate(el => getComputedStyle(el).backgroundColor);
      expect(original).not.toBe("rgb(79, 37, 130)");
      await page.evaluate(() => {
        document.querySelector("#route")!.classList.remove("home-presentation");
        document.querySelector("#portal")!.classList.remove("home-presentation");
      });
      await expect(page.locator("#shared")).toHaveCSS("background-color", original);
      await expect(page.locator("#theme")).toHaveAttribute("class", theme);
      await page.evaluate(() => document.querySelector("#route")!.classList.add("home-presentation"));
      await expect(page.locator("#shared")).toHaveCSS("background-color", "rgb(79, 37, 130)");
      await expect(page.locator("#unrelated")).toHaveCSS("background-color", original);
    });

    test("keyboard focus and all semantic foreground/background pairs are readable", async ({ page }) => {
      await page.keyboard.press("Tab");
      await expect(page.locator("#action")).toBeFocused();
      await expect(page.locator("#action")).toHaveCSS("outline-width", "2px");
      await expect(page.locator("#action")).toHaveCSS("outline-color", "rgb(79, 37, 130)");
      await expect(page.locator("#action")).toHaveCSS("outline-offset", "3px");
      const contrasts = await page.locator("#route").evaluate(el => {
        const style = getComputedStyle(el);
        function luminance(color: string) {
          const probe = document.createElement("span");
          probe.style.color = `hsl(${style.getPropertyValue(color)})`;
          el.append(probe);
          const channels = getComputedStyle(probe)
            .color.match(/[\d.]+/g)!
            .slice(0, 3)
            .map(Number);
          probe.remove();
          const linear = channels.map(c => {
            const s = c / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          });
          return linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
        }
        return [
          "background",
          "primary",
          "secondary",
          "accent",
          "muted",
          "card",
          "popover",
          "destructive",
          "sidebar-background",
          "sidebar-primary",
          "sidebar-accent",
        ].map(token => {
          const foreground =
            token === "background"
              ? "foreground"
              : token === "sidebar-background"
                ? "sidebar-foreground"
                : `${token}-foreground`;
          const a = luminance(`--${token}`);
          const b = luminance(`--${foreground}`);
          return {
            token,
            ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
          };
        });
      });
      for (const { token, ratio } of contrasts) expect(ratio, `${token} contrast`).toBeGreaterThanOrEqual(4.5);
    });
  });
}

// Integration coverage uses the real authenticated app and its existing dialogs.
// Run with the demo API on 7745 and Nuxt on 3000 (or E2E_BASE_URL).
test.describe("functional Home shell", () => {
  test.setTimeout(90000);
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/home");
    await page.locator("input[type='text']").fill("demo@example.com");
    await page.locator("input[type='password']").fill("demodemo");
    await page.locator("button[type='submit']").click();
    await expect(page.locator("#app")).toHaveClass("home-presentation", { timeout: 30000 });
  });

  test("desktop shell, search, profile, route scope and logout", async ({ page }) => {
    const header = page.locator(".home-shell-header");
    await expect(header).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(header).toHaveCSS("height", "64px");
    await expect(page.locator(".home-shell-brand")).toHaveText("HomeBox");
    await expect(page.locator('[data-sidebar="menu-button"][href="/home"]')).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".home-shell-create")).toHaveCSS("background-color", "rgb(79, 37, 130)");
    await expect(page.locator(".home-shell-profile")).toHaveAttribute("href", "/profile");
    await expect(page.locator(".home-shell-profile")).toHaveText("D");
    await expect(page.locator(".home-shell-profile")).toHaveAttribute("aria-label", "Profile: Demo");
    await page.screenshot({ path: "test-results/home-desktop-shell.png" });
    await header.getByRole("searchbox").fill("drill & tools");
    await header.getByRole("searchbox").press("Enter");
    await expect(page).toHaveURL(/\/items\?q=drill%20%26%20tools/);
    await expect(page.locator("#app")).not.toHaveClass("home-presentation");
    await page.locator('[data-sidebar="menu-button"][href="/home"]').click();
    await expect(page.locator("#app")).toHaveClass("home-presentation", { timeout: 30000 });
    await header.getByRole("searchbox").fill("desk");
    await header.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page).toHaveURL(/\/items\?q=desk/);
    await page.locator('[data-sidebar="menu-button"][href="/home"]').click();
    await page.locator(".home-shell-profile").click();
    await expect(page).toHaveURL(/\/profile$/);
    await page.getByTestId("logout-button").click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("collection switching reloads the selected collection and navigation destinations remain available", async ({
    page,
  }) => {
    const selector = page.getByRole("combobox", { name: "Select Collection" });
    await expect(selector).not.toContainText("Select Collection");
    const originalName = (await selector.innerText()).trim();
    const collectionName = `Shell regression ${Date.now()}`;
    await selector.click();
    await page.getByRole("option", { name: "Create New Collection" }).click();
    await page.getByRole("dialog").getByRole("textbox").fill(collectionName);
    await page.getByRole("dialog").getByRole("button", { name: "Create", exact: true }).click();
    await expect(selector).toContainText(collectionName, { timeout: 30000 });
    await expect(page.locator(".home-shell-breadcrumb")).toContainText(collectionName);
    await selector.click();
    const reloaded = page.waitForEvent("load");
    await page.getByRole("option", { name: originalName, exact: true }).click();
    await reloaded;
    await expect(selector).toContainText(originalName, { timeout: 30000 });
    await expect(page.locator(".home-shell-breadcrumb")).toContainText(originalName);
    for (const destination of ["/locations", "/tags", "/items", "/templates", "/maintenance", "/collection/members"]) {
      await page.locator(`[data-sidebar="menu-button"][href="${destination}"]`).first().click();
      await expect(page).toHaveURL(new RegExp(`${destination}$`));
      await expect(page.locator("#app")).not.toHaveClass("home-presentation");
      await page.locator('[data-sidebar="menu-button"][href="/home"]').click();
      await expect(page.locator("#app")).toHaveClass("home-presentation");
    }
  });

  test("existing creation and quick-menu keyboard shortcuts remain available", async ({ page }) => {
    await page.locator(".home-shell-brand").focus();
    for (const key of ["Shift+Digit1", "Shift+Digit2", "Shift+Digit3"]) {
      await page.keyboard.press(key);
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }
    await page.keyboard.press("Control+Backquote");
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("dialog").getByRole("combobox").fill("Locations");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/locations$/);
  });

  test("Create dialogs, collection create/join and camera denial remain wired", async ({ page }) => {
    for (const action of ["Item / Asset", "Location", "Tag"]) {
      await page.locator(".home-shell-create").click();
      await page.getByRole("menuitem", { name: action }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }
    for (const action of ["Create New Collection", "Join Existing Collection"]) {
      await page.mouse.move(700, 500);
      await page.getByRole("combobox", { name: "Select Collection" }).click();
      await page.getByRole("option", { name: action }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
    }
    await page.evaluate(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("Denied", "NotAllowedError"));
    });
    await page.locator(".home-shell-header").getByRole("button", { name: "Scanner" }).click();
    await expect(
      page.getByText("Camera permission denied, please allow access to the camera in your browser settings")
    ).toBeVisible();
    await expect(page.getByRole("dialog")).not.toBeVisible();
  });
});
