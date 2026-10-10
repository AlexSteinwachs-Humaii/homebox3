import { readFileSync } from "node:fs";
import { computed, ref } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveTableHeaders } from "../../components/Item/View/table/column-visibility";
import type { UserClient } from "../../lib/api/user";
import en from "../../locales/en.json";
import { itemsTable } from "./table";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const page = read("./index.vue");
const recentColumns = ["assetId", "name", "quantity", "insured", "purchasePrice", "location", "archived"];
const allColumns = [...recentColumns, "createdAt", "updatedAt"];

afterEach(() => vi.unstubAllGlobals());

describe("Home recent items", () => {
  it("overrides hidden and reordered inventory columns without mutating saved preferences", () => {
    const saved = Object.freeze([
      Object.freeze({ value: "updatedAt", enabled: true }),
      ...recentColumns.map(value => Object.freeze({ value, enabled: false })),
    ]);
    const headers = resolveTableHeaders(allColumns, [...saved], recentColumns);
    expect(headers.filter(h => h.enabled).map(h => h.value)).toEqual(recentColumns);
    expect(headers.filter(h => !h.enabled).map(h => h.value)).toEqual(["createdAt", "updatedAt"]);
    expect(saved[0]).toEqual({ value: "updatedAt", enabled: true });
    expect(saved.slice(1).every(h => !h.enabled)).toBe(true);
    expect(resolveTableHeaders(allColumns, [...saved])).toEqual(saved);
  });

  it("preserves inventory defaults and allows an explicitly empty override", () => {
    expect(
      resolveTableHeaders(allColumns, undefined)
        .filter(h => h.enabled)
        .map(h => h.value)
    ).toEqual(["name", "quantity", "insured", "purchasePrice"]);
    expect(resolveTableHeaders(allColumns, undefined, []).every(h => !h.enabled)).toBe(true);
  });

  it("loads actual recent items and returns an honest empty list", async () => {
    const data = ref();
    const getAll = vi.fn().mockResolvedValue({ data: { items: [] } });
    vi.stubGlobal("computed", computed);
    vi.stubGlobal(
      "useAsyncData",
      vi.fn((_key, loader) => {
        void loader().then((items: unknown) => (data.value = items));
        return { data, refresh: vi.fn() };
      })
    );
    vi.stubGlobal("onServerEvent", vi.fn());
    vi.stubGlobal("ServerEvent", { EntityMutation: "mutation" });
    const result = itemsTable({ items: { getAll } } as unknown as UserClient);
    expect(result.value.items).toEqual([]);
    await vi.waitFor(() => expect(data.value).toEqual([]));
    expect(getAll).toHaveBeenCalledWith({
      page: 1,
      pageSize: 5,
      orderBy: "createdAt",
    });
    data.value = [{ id: "real-item", name: "Collection item" }];
    expect(result.value.items).toEqual(data.value);
  });

  it("keeps search reachable in empty and narrow states, with cards below the existing breakpoint", () => {
    const section = page.slice(
      page.indexOf('        <div class="flex flex-wrap items-baseline'),
      page.indexOf("home.storage_locations")
    );
    expect(page.indexOf("home.quick_statistics")).toBeLessThan(page.indexOf("home.recently_added"));
    expect(section).toContain('<NuxtLink to="/items"');
    expect(section.indexOf("home.search_inventory")).toBeLessThan(
      section.indexOf('v-if="itemTable.items.length === 0"')
    );
    expect(en.home.search_inventory).toBe("Search inventory");
    expect(section).toContain('$t("items.no_results")');
    expect(section).toContain('v-else-if="breakpoints.lg"');
    expect(section).toContain('<ItemCard v-for="item in itemTable.items"');
    expect(section).toContain(
      ":visible-column-ids=\"['assetId', 'name', 'quantity', 'insured', 'purchasePrice', 'location', 'archived']\""
    );
    expect(read("../../composables/use-css-var.ts")).toContain("breakpoints.lg = window.innerWidth >= 768");
  });

  it("passes the override to the shared table and prevents header persistence", () => {
    const wrapper = read("../../components/Item/View/Table.vue");
    const table = read("../../components/Item/View/table/data-table.vue");
    expect(wrapper).toContain(':visible-column-ids="visibleColumnIds"');
    expect(wrapper).toContain("makeColumns({ t })");
    expect(table).toMatch(/const persistHeaders = \(\) => \{\s*if \(props.visibleColumnIds !== undefined\) return;/);
    expect(table).toMatch(/get columnVisibility\(\) \{\s*return props.visibleColumnIds !== undefined/);
    expect(page).not.toMatch(/Cordless drill|Office monitor|Camping tent|Socket set/);
  });
});
