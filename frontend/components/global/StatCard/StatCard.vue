<template>
  <article v-if="editorial" class="home-statistic min-w-0" :class="{ 'home-statistic-featured': featured }">
    <h3 class="home-muted text-xs">{{ title }}</h3>
    <p class="home-statistic-value my-2 break-words">
      <Currency v-if="type === 'currency'" :amount="value" />
      <template v-else>{{ formattedNumber }}</template>
    </p>
    <p v-if="subtitle" class="home-muted text-xs">{{ subtitle }}</p>
  </article>
  <Card v-else class="flex flex-col items-center bg-secondary p-3 text-secondary-foreground shadow">
    <CardHeader class="p-0">
      <CardTitle class="text-sm font-medium">{{ title }}</CardTitle>
    </CardHeader>
    <CardContent class="p-0 text-2xl font-bold">
      <Currency v-if="type === 'currency'" :amount="value" />
      <template v-if="type === 'number'">{{ value }}</template>
    </CardContent>
    <CardFooter v-if="subtitle">{{ subtitle }}</CardFooter>
  </Card>
</template>

<script setup lang="ts">
  import { computed } from "vue";
  import Currency from "../Currency.vue";
  import type { StatsFormat } from "./types";
  import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

  type Props = {
    title: string;
    value: number;
    subtitle?: string;
    type?: StatsFormat;
    editorial?: boolean;
    featured?: boolean;
  };

  const props = withDefaults(defineProps<Props>(), {
    type: "number",
    subtitle: undefined,
    editorial: false,
    featured: false,
  });
  const formattedNumber = computed(() => new Intl.NumberFormat(getLocaleCode()).format(props.value));
</script>

<style></style>
