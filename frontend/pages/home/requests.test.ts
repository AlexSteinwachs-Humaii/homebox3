import { beforeEach, expect, it, vi } from "vitest";
import { ref } from "vue";
import type { UserClient } from "~~/lib/api/user";
import { itemsTable } from "./table";
import { statCardData } from "./statistics";

vi.mock("vue-i18n", () => ({ useI18n: () => ({ t: (key: string) => key }) }));
const prefs = ref({ collectionId: "a" });
const listeners = new Map<string, (() => void)[]>();
const keys: string[] = [];
const work: Promise<void>[] = [];
const items = vi.fn();
const stats = vi.fn();
const api = { items: { getAll: items }, stats: { group: stats } } as unknown as UserClient;
const totals = { totalItemPrice: 10, totalItems: 1, totalLocations: 2, totalTags: 3 };

beforeEach(() => {
  prefs.value.collectionId = "a";
  listeners.clear();
  keys.length = 0;
  work.length = 0;
  items.mockReset().mockResolvedValue({ data: { items: [{ id: "item" }] } });
  stats.mockReset().mockResolvedValue({ data: totals });
  vi.stubGlobal("useViewPreferences", () => prefs);
  vi.stubGlobal("ServerEvent", { EntityMutation: "entity", TagMutation: "tag" });
  vi.stubGlobal("onServerEvent", (event: string, callback: () => void) => {
    listeners.set(event, [...(listeners.get(event) ?? []), callback]);
  });
  vi.stubGlobal("useAsyncData", (key: string, handler: () => Promise<unknown>) => {
    keys.push(key);
    const data = ref<unknown>();
    const status = ref("idle");
    const error = ref<unknown>();
    const refresh = () => {
      status.value = "pending";
      const pending = handler()
        .then(result => {
          data.value = result;
          status.value = "success";
        })
        .catch(err => {
          error.value = err;
          status.value = "error";
        });
      work.push(pending);
      return pending;
    };
    void refresh();
    return { data, status, error, refresh };
  });
});

it("uses separate collection-scoped keys and refreshes items/statistics on inventory and tag mutations", async () => {
  const recent = itemsTable(api);
  const statistics = statCardData(api);
  await Promise.all(work);
  expect(keys).toEqual(["home-recent:a", "home-statistics:a"]);
  expect(recent.items.value).toHaveLength(1);
  expect(statistics.statistics.value).toEqual(totals);
  for (const callback of listeners.get("entity") ?? []) callback();
  for (const callback of listeners.get("tag") ?? []) callback();
  await Promise.all(work);
  expect(items).toHaveBeenCalledTimes(2);
  expect(stats).toHaveBeenCalledTimes(3);
  expect(items).toHaveBeenCalledWith({ page: 1, pageSize: 5, orderBy: "createdAt" });
});

it("hides completed results and ignores mutation refreshes for another collection", async () => {
  const recent = itemsTable(api);
  const statistics = statCardData(api);
  await Promise.all(work);
  prefs.value.collectionId = "b";
  expect(recent.items.value).toEqual([]);
  expect(statistics.statistics.value).toBeUndefined();
  expect(statistics.cards.value).toEqual([]);
  for (const callback of listeners.get("entity") ?? []) callback();
  expect(items).toHaveBeenCalledTimes(1);
  expect(stats).toHaveBeenCalledTimes(1);
});

it("late requests cannot expose another collection's items or statistics", async () => {
  let releaseItems!: (data: unknown) => void;
  let releaseStats!: (data: unknown) => void;
  items.mockReturnValueOnce(
    new Promise(resolve => {
      releaseItems = resolve;
    })
  );
  stats.mockReturnValueOnce(
    new Promise(resolve => {
      releaseStats = resolve;
    })
  );
  const recent = itemsTable(api);
  const statistics = statCardData(api);
  prefs.value.collectionId = "b";
  releaseItems({ data: { items: [{ id: "a-only" }] } });
  releaseStats({ data: totals });
  await Promise.all(work);
  expect(recent.items.value).toEqual([]);
  expect(statistics.statistics.value).toBeUndefined();
});
