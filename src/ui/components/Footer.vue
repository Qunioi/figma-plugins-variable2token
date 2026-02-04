<script setup lang="ts">
interface Props {
  version: string;
  status: string;
}

defineProps<Props>();
</script>

<template>
  <footer class="h-8 border-t border-figma-border flex items-center justify-between px-3 text-[10px] opacity-40 bg-figma-bg select-none shrink-0">
    <div class="flex items-center gap-2">
      <span>V2T v{{ version }}</span>
      <span class="w-1 h-1 rounded-full bg-green-500"></span>
    </div>
    <div class="flex items-center gap-3">
      <span>{{ status }}</span>
    </div>
  </footer>
</template>
