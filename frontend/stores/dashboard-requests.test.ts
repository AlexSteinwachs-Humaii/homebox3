import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { useLocationStore } from "./locations";
import { useTagStore } from "./tags";

const prefs = { value: { collectionId: "a" } };
const locations = vi.fn();
const tags = vi.fn();
beforeEach(() => {
  setActivePinia(createPinia());
  prefs.value.collectionId = "a";
  vi.stubGlobal("useViewPreferences", () => prefs);
  vi.stubGlobal("useUserApi", () => ({ items: { getLocations: locations }, tags: { getAll: tags } }));
  locations.mockReset();
  tags.mockReset();
});

for (const kind of ["locations", "tags"]) {
  describe(`${kind} dashboard cache`, () => {
    const request = kind === "locations" ? locations : tags;
    function setup() {
      const store = kind === "locations" ? useLocationStore() : useTagStore();
      return {
        refresh: () => ("refreshParents" in store ? store.refreshParents() : store.refresh()),
        status: () => ("parentsStatus" in store ? store.parentsStatus : store.status),
        data: () => ("parentLocations" in store ? store.parentLocations : store.tags),
      };
    }
    it("distinguishes empty success, failure and retry", async () => {
      const store = setup();
      request.mockResolvedValueOnce({ error: "failed", data: [] }).mockResolvedValueOnce({ data: [], error: null });
      await store.refresh();
      expect(store.status()).toBe("error");
      await store.refresh();
      expect(store.status()).toBe("success");
      expect(store.data()).toEqual([]);
    });
    it("a failed transport exposes retry instead of leaving pending forever", async () => {
      const store = setup();
      request.mockRejectedValueOnce(new Error("network"));
      await store.refresh();
      expect(store.status()).toBe("error");
    });
    it("rejects late responses for a changed collection", async () => {
      const store = setup();
      let release!: (result: unknown) => void;
      request.mockReturnValueOnce(
        new Promise(resolve => {
          release = resolve;
        })
      );
      const pending = store.refresh();
      expect(store.status()).toBe("pending");
      prefs.value.collectionId = "b";
      release({ data: [{ id: "a-only", name: "Old inventory" }], error: null });
      await pending;
      expect(store.data()).toEqual([]);
      expect(store.status()).not.toBe("success");
    });
    it("the latest mutation refresh wins even if older requests complete last", async () => {
      const store = setup();
      let release!: (result: unknown) => void;
      request.mockReturnValueOnce(
        new Promise(resolve => {
          release = resolve;
        })
      );
      const pending = store.refresh();
      request.mockResolvedValueOnce({ data: [{ id: "new", name: "New" }], error: null });
      await store.refresh();
      release({ data: [{ id: "old", name: "Old" }], error: null });
      await pending;
      expect(store.data()[0]?.id).toBe("new");
    });
  });
}
