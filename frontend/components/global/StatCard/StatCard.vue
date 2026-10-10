<template>
  <Card class="flex flex-col p-3" :class="variantClasses[variant]">
    <CardHeader class="p-0">
      <CardTitle class="text-sm font-medium">{{ title }}</CardTitle>
    </CardHeader>
    <CardContent class="p-0 text-2xl font-bold" :class="{ 'text-primary': variant === 'outline' }">
      <Currency v-if="type === 'currency'" :amount="value" />
      <template v-if="type === 'number'">{{ value }}</template>
    </CardContent>
    <CardFooter v-if="subtitle" :class="variant === 'default' ? undefined : 'mt-2 p-0 text-xs'">
      {{ subtitle }}
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
  import Currency from "../Currency.vue";
  import type { StatsFormat, StatsVariant } from "./types";
  import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

  type Props = {
    title: string;
    value: number;
    subtitle?: string;
    type?: StatsFormat;
    variant?: StatsVariant;
  };

  withDefaults(defineProps<Props>(), {
    type: "number",
    subtitle: undefined,
    variant: "default",
  });

  const variantClasses: Record<StatsVariant, string> = {
    default: "items-center bg-secondary text-secondary-foreground shadow",
    filled: "items-start bg-primary text-primary-foreground shadow-none",
    outline: "items-start border bg-card text-card-foreground shadow-none",
  };
</script>

<style></style>
