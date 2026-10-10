<script setup lang="ts">
  defineProps<{ status: string; section: string }>();
  defineEmits<{ retry: [] }>();
</script>

<template>
  <div v-if="status === 'error'" role="alert" class="home-surface p-4">
    <p class="home-muted mb-3">{{ $t("home.section_error", { section }) }}</p>
    <button type="button" class="home-action home-action-outline" @click="$emit('retry')">
      {{ $t("home.retry_section", { section }) }}
    </button>
  </div>
  <p v-else-if="status !== 'success'" role="status" class="home-muted py-4">
    {{ $t("home.section_loading", { section }) }}
  </p>
  <slot v-else />
</template>
