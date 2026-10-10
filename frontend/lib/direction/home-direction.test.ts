import { readFileSync } from "node:fs";
import postcss, { type Rule } from "postcss";
import tailwindcss from "tailwindcss";
import { describe, expect, it } from "vitest";
import tailwindConfig from "../../tailwind.config.js";
import { themes } from "../data/themes";
import { HOME_DIRECTION_CLASS } from "./home-direction";

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

  it("defines purple emphasis, pale surfaces and 4px corners", () => {
    expect(declarations(ruleFor(`.${HOME_DIRECTION_CLASS}`))).toEqual({
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
        content: [{ raw: "shadow shadow-sm shadow-md drop-shadow-md focus:ring-2 blur-sm", extension: "html" }],
      }),
    ]).process(css, { from: undefined });
    const generated = postcss.parse(result.css);
    const selectors: string[] = [];
    generated.walkRules(rule => {
      selectors.push(rule.selector);
    });
    expect(selectors).toContain(`.${HOME_DIRECTION_CLASS}`);
    expect(selectors).toContain(shadowSelector);
    expect(selectors).toContain(".focus\\:ring-2:focus");
    expect(result.css).toContain("var(--tw-ring-shadow)");
    expect(result.css).toContain("var(--tw-drop-shadow)");
    expect(selectors.indexOf(shadowSelector)).toBeGreaterThan(selectors.indexOf(".shadow-md"));
  });
});
