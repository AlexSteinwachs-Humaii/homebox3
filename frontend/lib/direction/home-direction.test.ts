import { readFileSync, readdirSync } from "node:fs";
import postcss, { type Rule } from "postcss";
import tailwindcss from "tailwindcss";
import { describe, expect, it } from "vitest";
import tailwindConfig from "../../tailwind.config.js";
import { themes } from "../data/themes";
import { HOME_DIRECTION_CLASS } from "./home-direction";
import * as homeDirection from "./home-direction";

function sourceFiles(directory: URL): URL[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = new URL(entry.name, directory);
    return entry.isDirectory() ? sourceFiles(new URL(`${entry.name}/`, directory)) : [path];
  });
}

const css = readFileSync(new URL("../../assets/css/main.css", import.meta.url), "utf8");
const stylesheet = postcss.parse(css);

function declarations(rule: Rule) {
  const values: Record<string, string> = {};
  rule.walkDecls(decl => {
    values[decl.prop] = decl.value;
  });
  return values;
}

function ruleFor(selector: string) {
  let found: Rule | undefined;
  stylesheet.walkRules(selector, rule => {
    found = rule;
  });
  if (!found) throw new Error(`Missing CSS rule: ${selector}`);
  return found;
}

const shadowSelector =
  ".direction-evolve:is(.shadow, .shadow-sm, .shadow-md, .drop-shadow-md),\n" +
  ".direction-evolve :is(.shadow, .shadow-sm, .shadow-md, .drop-shadow-md)";

describe("Home direction tokens", () => {
  it("exports an opt-in scope, not a selectable theme", () => {
    expect(HOME_DIRECTION_CLASS).toBe("direction-evolve");
    expect(themes.map(theme => theme.value)).not.toContain(HOME_DIRECTION_CLASS);
    expect(themes.map(theme => theme.value)).toContain("homebox");
  });

  it("exposes only a class constant, with no theme-setting API", () => {
    expect(Object.keys(homeDirection)).toEqual(["HOME_DIRECTION_CLASS"]);
    const source = readFileSync(new URL("./home-direction.ts", import.meta.url), "utf8");
    // Strip comments: the contract documents these APIs but must never call them.
    const code = source.replace(/\/\/[^\n]*/g, "");
    expect(code.trim()).toBe('export const HOME_DIRECTION_CLASS = "direction-evolve";');
  });

  it("preserves the existing picker options, including Homebox", () => {
    expect(themes.map(theme => theme.value)).toEqual([
      "homebox",
      "garden",
      "light",
      "cupcake",
      "bumblebee",
      "emerald",
      "corporate",
      "synthwave",
      "retro",
      "cyberpunk",
      "valentine",
      "halloween",
      "forest",
      "aqua",
      "lofi",
      "pastel",
      "fantasy",
      "wireframe",
      "black",
      "luxury",
      "dracula",
      "cmyk",
      "autumn",
      "business",
      "acid",
      "lemonade",
      "night",
      "coffee",
      "winter",
    ]);
    expect(themes).toContainEqual({ label: "Homebox", value: "homebox" });
    for (const { label, value } of themes) {
      expect(`${label} ${value}`).not.toMatch(/direction-evolve|kellogg|evolve|purple/i);
    }
    const picker = readFileSync(new URL("../../components/App/ThemePicker.vue", import.meta.url), "utf8");
    expect(picker).toContain('import { themes } from "~~/lib/data/themes"');
    expect(picker).toContain('v-for="theme in themes"');
  });

  it("limits the opt-in consumer to the shared default layout", () => {
    const files = [new URL("../../app.vue", import.meta.url)];
    for (const directory of ["pages", "layouts", "plugins", "composables", "components"]) {
      files.push(...sourceFiles(new URL(`../../${directory}/`, import.meta.url)));
    }
    const layout = new URL("../../layouts/default.vue", import.meta.url);
    for (const file of files.filter(file => /\.(vue|ts|js)$/.test(file.pathname))) {
      if (file.href === layout.href) continue;
      expect(readFileSync(file, "utf8"), file.pathname).not.toMatch(/direction-evolve|HOME_DIRECTION_CLASS/);
    }
    const source = readFileSync(layout, "utf8");
    expect(source).toContain('import { HOME_DIRECTION_CLASS } from "~/lib/direction/home-direction"');
    expect(source).toContain('<div id="app" :class="{ [HOME_DIRECTION_CLASS]: isHomeDirection }">');
    expect(source).toContain('const isHomeDirection = computed(() => route.path === "/home")');
    expect(source).not.toMatch(/useTheme\(|data-theme|theme-\$|preferences(?:\.value)?\.theme\s*=/);
  });

  it("switches only the sidebar identity, preserving primary/accent styling and shell controls", () => {
    const source = readFileSync(new URL("../../layouts/default.vue", import.meta.url), "utf8");
    expect(source).toContain('<span v-if="isHomeDirection" class="text-3xl font-bold text-primary">HomeBox</span>');
    expect(source).toMatch(/<div v-else class="flex size-24[^"]*rounded-full[^"]*">\s*<AppLogo \/>/);
    expect(source).toContain("bg-accent text-accent-foreground");
    expect(source).toContain("bg-primary text-primary-foreground");
    expect(source).toContain('@keyup.enter="triggerSearch"');
    expect(source).toContain('@click="openScanner"');
    expect(source).toContain('@click.prevent="openDialog(DialogID.Scanner)"');
    expect(source).toContain('v-if="preferences.displayLegacyHeader"');
    expect(source).toContain('data-testid="logout-button"');
    for (const destination of [
      "/home",
      "/locations",
      "/tags",
      "/items",
      "/templates",
      "/maintenance",
      "/profile",
      "/collection/members",
      "/collection/invites",
      "/collection/notifiers",
      "/collection/settings",
      "/collection/entity-types",
      "/collection/tools",
    ]) {
      expect(source).toContain(`to: "${destination}"`);
    }
  });

  it("keeps the referenced institution out of UI copy and public identity assets", () => {
    for (const directory of ["components", "locales", "public"]) {
      for (const file of sourceFiles(new URL(`../../${directory}/`, import.meta.url))) {
        expect(decodeURIComponent(file.pathname)).not.toMatch(/kellogg/i);
        expect(readFileSync(file).toString("utf8"), file.pathname).not.toMatch(/kellogg/i);
      }
    }
  });

  it("defines purple emphasis, pale surfaces and 4px corners", () => {
    expect(declarations(ruleFor(`.${HOME_DIRECTION_CLASS}`))).toMatchObject({
      "--background": "270 20% 97%",
      "--background-accent": "270 20% 95%",
      "--foreground": "270 8% 16%",
      "--primary": "267 56% 33%",
      "--primary-foreground": "0 0% 98%",
      "--secondary": "270 20% 95%",
      "--secondary-foreground": "270 8% 16%",
      "--accent": "267 40% 94%",
      "--accent-foreground": "267 56% 33%",
      "--muted": "270 20% 95%",
      "--muted-foreground": "270 6% 40%",
      "--card": "0 0% 100%",
      "--card-foreground": "270 8% 16%",
      "--popover": "0 0% 100%",
      "--popover-foreground": "270 8% 16%",
      "--border": "270 20% 88%",
      "--input": "270 20% 88%",
      "--ring": "267 56% 33%",
      "--sidebar-background": "270 20% 98%",
      "--sidebar-foreground": "270 8% 16%",
      "--sidebar-primary": "267 56% 33%",
      "--sidebar-primary-foreground": "0 0% 98%",
      "--sidebar-accent": "267 40% 94%",
      "--sidebar-accent-foreground": "267 56% 33%",
      "--sidebar-border": "270 20% 88%",
      "--sidebar-ring": "267 56% 33%",
      "--radius": "0.25rem",
    });
  });

  it("provides optional local display and sans faces with ordered offline fallbacks", () => {
    expect(declarations(ruleFor(`.${HOME_DIRECTION_CLASS}`))).toMatchObject({
      "--font-sans":
        'Roboto, Arial, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      "--font-display": "Petrona, Georgia, serif",
      "font-family": "var(--font-sans)",
    });
    expect(declarations(ruleFor(".direction-evolve .font-display"))).toEqual({
      "font-family": "var(--font-display)",
    });
  });

  it("confines font roles to the scope and does not request network fonts", () => {
    stylesheet.walkDecls(/^(--font-sans|--font-display)$/, decl => {
      expect((decl.parent as Rule).selector).toBe(`.${HOME_DIRECTION_CLASS}`);
    });
    stylesheet.walkDecls("font-family", decl => {
      if (decl.value.includes("var(--font-display)")) {
        expect((decl.parent as Rule).selector).toBe(".direction-evolve .font-display");
      }
      if (decl.value.includes("var(--font-sans)")) {
        expect((decl.parent as Rule).selector).toBe(`.${HOME_DIRECTION_CLASS}`);
      }
    });
    stylesheet.walkRules(rule => {
      if (rule.selector.includes(".font-display")) {
        expect(rule.selector).toBe(".direction-evolve .font-display");
      }
    });
    expect(css).not.toMatch(/@import|@font-face|fonts\.googleapis\.com|fonts\.gstatic\.com/i);
  });

  it("keeps Homebox defaults intact", () => {
    expect(declarations(ruleFor(":root,.homebox"))).toMatchObject({
      "--primary": "139 16% 43%",
      "--primary-foreground": "139 100% 89%",
      "--background": "0 0% 100%",
      "--background-accent": "0 0% 81%",
      "--secondary": "77 8% 17%",
      "--accent": "97 37% 93%",
      "--border": "0 0% 81%",
      "--radius": "0.5rem",
    });
  });

  it("flattens all four utilities only on the scope and its descendants, preserving rings and filters", () => {
    expect(declarations(ruleFor(shadowSelector))).toEqual({
      "--tw-shadow": "0 0 #0000",
      "--tw-shadow-colored": "0 0 #0000",
      "--tw-drop-shadow": "drop-shadow(0 0 #0000)",
      border: "1px solid hsl(var(--border))",
    });
  });

  it("retains the opt-in rules in generated CSS without a consumer or safelist", async () => {
    const result = await postcss([
      tailwindcss({
        ...tailwindConfig,
        safelist: [],
        content: [
          {
            raw: "shadow shadow-sm shadow-md drop-shadow-md focus:ring-2 blur-sm",
            extension: "html",
          },
        ],
      }),
    ]).process(css, { from: undefined });
    const generated = postcss.parse(result.css);
    const selectors: string[] = [];
    generated.walkRules(rule => {
      selectors.push(rule.selector);
    });
    expect(selectors).toContain(`.${HOME_DIRECTION_CLASS}`);
    expect(selectors).toContain(shadowSelector);
    expect(selectors).toContain(".direction-evolve .font-display");
    expect(selectors).toContain(".focus\\:ring-2:focus");
    expect(result.css).toContain("var(--tw-ring-shadow)");
    expect(result.css).toContain("var(--tw-drop-shadow)");
    expect(selectors.indexOf(shadowSelector)).toBeGreaterThan(selectors.indexOf(".shadow-md"));
  });
});
