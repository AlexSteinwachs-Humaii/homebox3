<script setup lang="ts">
  import type { TagOut, TagSummary } from "~~/lib/api/types/data-contracts";
  import MdiArrowUp from "~icons/mdi/arrow-up";
  import { getContrastTextColor } from "~/lib/utils";
  import { getIconComponent } from "~/lib/icons";

  export type sizes = "sm" | "md" | "lg" | "xl";
  const props = defineProps({
    tag: {
      type: Object as () => TagOut | TagSummary,
      required: true,
    },
    home: { type: Boolean, default: false },
    size: {
      type: String as () => sizes,
      default: "md",
    },
    hideIcon: {
      type: Boolean,
      default: false,
    },
    ancestors: {
      type: Boolean,
      default: false,
    },
  });

  const chipIcon = computed(() => {
    return getIconComponent(props.tag.icon);
  });
</script>

<template>
  <NuxtLink v-if="home" :to="`/tag/${tag.id}`" class="home-tag-chip min-w-0 max-w-full">
    <component :is="chipIcon" v-if="!hideIcon" class="size-4 shrink-0" aria-hidden="true" />
    <span class="min-w-0 break-words">{{ tag.name }}</span>
  </NuxtLink>
  <NuxtLink
    v-else
    class="group/tag-chip flex gap-2 rounded-full border shadow transition duration-300 hover:bg-accent/50"
    :class="{
      'p-4 py-1 text-base': size === 'lg',
      'p-3 py-1 text-sm': size !== 'sm' && size !== 'lg',
      'p-2 py-0.5 text-xs': size === 'sm',
      'border-dashed italic': ancestors,
      'border-transparent': !ancestors,
    }"
    :style="
      tag.color
        ? { backgroundColor: tag.color, color: getContrastTextColor(tag.color) }
        : { backgroundColor: 'hsl(var(--accent))' }
    "
    :to="`/tag/${tag.id}`"
  >
    <template v-if="!hideIcon">
      <div class="relative">
        <component :is="chipIcon" class="invisible" /><!-- hack to ensure the size is correct -->

        <div
          class="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover/tag-chip:rotate-90"
        >
          <component :is="chipIcon" class="group-hover/tag-chip:hidden" />
          <MdiArrowUp class="hidden group-hover/tag-chip:block" />
        </div>
      </div>
    </template>
    {{ tag.name }}
  </NuxtLink>
</template>

<style scoped>
  .home-tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border: 1px solid var(--home-border);
    border-radius: var(--home-radius);
    background: var(--home-soft);
    color: var(--home-purple);
    font-size: 0.75rem;
  }
  .home-tag-chip:hover {
    border-color: var(--home-purple);
  }
  .home-tag-chip:focus-visible {
    outline: 2px solid var(--home-purple);
    outline-offset: 3px;
  }
</style>
