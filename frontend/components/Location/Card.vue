<template>
  <NuxtLink
    v-if="home"
    :to="`/location/${location.id}`"
    class="home-surface home-location-card flex min-w-0 items-center gap-3 p-4"
  >
    <MdiMapMarkerOutline class="size-5 shrink-0" aria-hidden="true" />
    <span class="min-w-0 flex-1">
      <span class="block break-words text-sm font-bold">{{ location.name }}</span>
      <span v-if="homeCount !== undefined" class="home-muted mt-1 block text-xs">
        {{ $t("home.item_count", { count: homeCount }, homeCount) }}
      </span>
    </span>
    <span class="shrink-0" aria-hidden="true">→</span>
  </NuxtLink>
  <Card v-else>
    <NuxtLink :to="`/location/${location.id}`" class="group/location-card transition duration-300">
      <div
        :class="{
          'p-4': !dense,
          'px-3 py-2': dense,
        }"
      >
        <h2 class="flex items-center justify-between gap-2">
          <div class="relative size-6">
            <div
              class="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover/location-card:-rotate-90"
            >
              <MdiMapMarkerOutline class="size-6 group-hover/location-card:hidden" />
              <MdiArrowUp class="hidden size-6 group-hover/location-card:block" />
            </div>
          </div>
          <span class="mx-auto">
            {{ location.name }}
          </span>
          <Badge :class="{ 'opacity-0': !hasCount }">
            {{ count }}
          </Badge>
        </h2>
      </div>
    </NuxtLink>
  </Card>
</template>

<script lang="ts" setup>
  import type { EntityOut, EntitySummary } from "~~/lib/api/types/data-contracts";
  import MdiArrowUp from "~icons/mdi/arrow-down";
  import MdiMapMarkerOutline from "~icons/mdi/map-marker-outline";
  import { Card } from "@/components/ui/card";
  import { Badge } from "@/components/ui/badge";

  const props = defineProps({
    location: {
      type: Object as () => EntitySummary | EntityOut,
      required: true,
    },
    home: { type: Boolean, default: false },
    dense: {
      type: Boolean,
      default: false,
    },
  });

  const homeCount = computed(() => {
    const value = (props.location as EntitySummary).itemCount;
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  });

  const hasCount = computed(() => {
    return !!(props.location as EntitySummary).itemCount;
  });

  const count = computed(() => {
    return hasCount.value ? (props.location as EntitySummary).itemCount : undefined;
  });
</script>

<style scoped>
  .home-location-card > svg,
  .home-location-card > span:last-child {
    color: var(--home-purple);
  }
  .home-location-card:hover {
    border-color: var(--home-purple);
  }
  .home-location-card:focus-visible {
    outline: 2px solid var(--home-purple);
    outline-offset: 3px;
  }
</style>
