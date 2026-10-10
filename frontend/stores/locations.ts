import { defineStore } from "pinia";
import type { ItemsApi } from "~~/lib/api/classes/items";
import type { EntitySummary, TreeItem } from "~~/lib/api/types/data-contracts";

export const useLocationStore = defineStore("locations", {
  state: () => ({
    parents: null as EntitySummary[] | null,
    Locations: null as EntitySummary[] | null,
    client: useUserApi(),
    collectionId: useViewPreferences().value.collectionId ?? null,
    parentsStatus: "idle" as "idle" | "pending" | "success" | "error",
    parentsRequest: 0,
    tree: null as TreeItem[] | null,
    refreshLocationsPromise: null as Promise<void> | null,
  }),
  getters: {
    /**
     * locations represents the locations that are currently in the store. The store is
     * synched with the server by intercepting the API calls and updating on the
     * response
     */
    parentLocations(state): EntitySummary[] {
      if ((useViewPreferences().value.collectionId ?? null) !== state.collectionId) return [];
      return state.parentsStatus === "success" ? (state.parents ?? []) : [];
    },
    allLocations(state): EntitySummary[] {
      return (useViewPreferences().value.collectionId ?? null) === state.collectionId ? (state.Locations ?? []) : [];
    },
  },
  actions: {
    ensureParentsFetched() {
      if (this.parentsStatus === "idle") return this.refreshParents();
    },
    async ensureLocationsFetched() {
      if (this.Locations !== null) {
        return;
      }

      if (this.refreshLocationsPromise === null) {
        this.refreshLocationsPromise = this.refreshChildren()
          .then(() => {})
          .finally(() => {
            this.refreshLocationsPromise = null;
          });
      }
      await this.refreshLocationsPromise;
    },
    async refreshParents(): ReturnType<ItemsApi["getLocations"]> {
      const request = ++this.parentsRequest;
      this.parentsStatus = "pending";
      try {
        const result = await this.client.items.getLocations({
          filterChildren: true,
        });
        if (request === this.parentsRequest && this.isCurrentCollection()) {
          this.parentsStatus = result.error ? "error" : "success";
          this.parents = result.error ? null : result.data;
        }
        return result;
      } catch (error) {
        if (request === this.parentsRequest && this.isCurrentCollection()) this.parentsStatus = "error";
        return { data: [], error, status: 0 };
      }
    },
    isCurrentCollection() {
      return (useViewPreferences().value.collectionId ?? null) === this.collectionId;
    },
    async refreshChildren(): ReturnType<ItemsApi["getLocations"]> {
      const result = await this.client.items.getLocations({
        filterChildren: false,
      });
      if (result.error || !this.isCurrentCollection()) {
        return result;
      }

      this.Locations = result.data;
      return result;
    },
    async refreshTree(): ReturnType<ItemsApi["getTree"]> {
      const result = await this.client.items.getTree();
      if (result.error || !this.isCurrentCollection()) {
        return result;
      }

      this.tree = result.data;
      return result;
    },
  },
});
