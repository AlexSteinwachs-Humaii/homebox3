import { computed } from "vue";
import { createRequestScope } from "~~/lib/data/request-scope";
import type { UserClient } from "~~/lib/api/user";

export function itemsTable(api: UserClient) {
  const prefs = useViewPreferences();
  const collectionId = prefs.value.collectionId ?? null;
  const scope = createRequestScope(collectionId, () => prefs.value.collectionId);
  const { data, status, refresh } = useAsyncData(
    `home-recent:${collectionId ?? "default"}`,
    async () => {
      const isCurrent = scope.begin();
      const response = await api.items.getAll({
        page: 1,
        pageSize: 5,
        orderBy: "createdAt",
      });
      if (!isCurrent()) throw new Error("Collection changed during request");
      if (response.error || !Array.isArray(response.data?.items)) throw new Error("Unable to load recent items");
      return response.data.items;
    },
    { deep: false }
  );

  onServerEvent(ServerEvent.EntityMutation, () => {
    if (scope.matches()) void refresh();
  });

  return {
    items: computed(() => (scope.matches() && status.value === "success" ? (data.value ?? []) : [])),
    status: computed(() => status.value),
    refresh,
  };
}
