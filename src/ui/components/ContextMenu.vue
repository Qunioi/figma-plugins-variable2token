<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Pencil, Trash2, Plus, Copy, AlertCircle } from 'lucide-vue-next';

interface Props {
  visible: boolean;
  pos: { x: number, y: number };
  type: 'collection' | 'mode';
  deleteDisabled?: boolean; // 新增：是否禁止刪除
}

const props = defineProps<Props>();
const emit = defineEmits(['close', 'edit', 'delete', 'add-mode', 'duplicate-mode', 'duplicate-collection']);

const close = () => emit('close');

// Close on click outside
const handleClickOutside = (e: MouseEvent) => {
  if (props.visible) {
    close();
  }
};

onMounted(() => {
  window.addEventListener('click', handleClickOutside);
  window.addEventListener('contextmenu', handleClickOutside);
});

onUnmounted(() => {
  window.removeEventListener('click', handleClickOutside);
  window.removeEventListener('contextmenu', handleClickOutside);
});
</script>

<template>
  <div 
    v-if="visible"
    class="fixed z-[4000] w-[170px] bg-[#2C2C2C] border border-[#444] rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.5)] py-1 flex flex-col text-white pointer-events-auto overflow-hidden animate-in fade-in zoom-in-95 duration-100"
    :style="{ top: pos.y + 'px', left: pos.x + 'px' }"
    @click.stop
  >
    <!-- Common: Edit -->
    <button 
      @click="emit('edit'); close();"
      class="flex items-center gap-2.5 px-3 py-2 text-[11px] hover:bg-figma-accent hover:text-white transition-colors text-white/80 group"
    >
      <Pencil :size="12" class="opacity-40 group-hover:opacity-100" />
      <span>編輯項目</span>
    </button>

    <!-- Collection Specific: Duplicate & Add -->
    <template v-if="type === 'collection'">
      <button 
        @click="emit('duplicate-collection'); close();"
        class="flex items-center gap-2.5 px-3 py-2 text-[11px] hover:bg-figma-accent hover:text-white transition-colors text-white/80 group"
      >
        <Copy :size="12" class="opacity-40 group-hover:opacity-100" />
        <span>複製集合 (Collection)</span>
      </button>

      <button 
        @click="emit('add-mode'); close();"
        class="flex items-center gap-2.5 px-3 py-2 text-[11px] hover:bg-figma-accent hover:text-white transition-colors text-white/80 group"
      >
        <Plus :size="12" class="opacity-40 group-hover:opacity-100" />
        <span>新增模式 (Mode)</span>
      </button>
    </template>

    <!-- Mode Specific: Duplicate Mode -->
    <button 
      v-if="type === 'mode'"
      @click="emit('duplicate-mode'); close();"
      class="flex items-center gap-2.5 px-3 py-2 text-[11px] hover:bg-figma-accent hover:text-white transition-colors text-white/80 group"
    >
      <Copy :size="12" class="opacity-40 group-hover:opacity-100" />
      <span>複製模式 (Mode)</span>
    </button>
    
    <div class="h-[1px] bg-white/5 my-1"></div>
    
    <!-- Delete -->
    <button 
      @click="!deleteDisabled && emit('delete'); !deleteDisabled && close();"
      class="flex items-center justify-between px-3 py-2 text-[11px] transition-colors group"
      :class="[
        deleteDisabled ? 'opacity-30 cursor-not-allowed bg-black/10' : 'hover:bg-red-500 hover:text-white text-red-400'
      ]"
      :title="deleteDisabled ? '請先刪除清空底下的變數' : ''"
    >
      <div class="flex items-center gap-2.5">
        <Trash2 :size="12" class="opacity-40 group-hover:opacity-100" />
        <span>刪除項目</span>
      </div>
      <AlertCircle v-if="deleteDisabled" :size="10" class="opacity-40" />
    </button>
  </div>
</template>
