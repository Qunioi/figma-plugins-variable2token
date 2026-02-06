<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { AlertTriangle, X } from 'lucide-vue-next';

interface Props {
  visible: boolean;
  itemPath: string; // e.g. "CollectionName/ModeName"
  itemType: 'Collection' | 'Mode';
}

const props = defineProps<Props>();
const emit = defineEmits(['close', 'confirm']);

const userInput = ref('');
const inputRef = ref<HTMLInputElement | null>(null);

watch(() => props.visible, (newVal) => {
  if (newVal) {
    userInput.value = '';
    setTimeout(() => {
      inputRef.value?.focus();
    }, 50);
  }
});

const handleConfirm = () => {
  if (userInput.value === props.itemPath) {
    emit('confirm');
    emit('close');
  }
};

const close = () => {
  emit('close');
};
</script>

<template>
  <div v-if="visible" class="fixed inset-0 z-[5000] flex items-center justify-center">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="close"></div>
    
    <!-- Modal -->
    <div class="relative w-[320px] bg-[#2C2C2C] border border-[#444] rounded-xl shadow-[0_24px_48px_rgba(0,0,0,0.8)] overflow-hidden text-white flex flex-col animate-in zoom-in-95 duration-200">
      <div class="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div class="flex items-center gap-2 text-red-400">
          <AlertTriangle :size="16" />
          <span class="text-[13px] font-bold">確認刪除</span>
        </div>
        <button @click="close" class="p-1 opacity-40 hover:opacity-100 transition-opacity">
          <X :size="16" />
        </button>
      </div>

      <div class="p-5 space-y-4">
        <div class="text-[12px] text-white/60 leading-relaxed">
          您即將刪除 {{ itemType === 'Collection' ? '集合' : '模式' }}：
          <div class="mt-1 text-white font-mono bg-white/5 px-2 py-1 rounded inline-block select-all">{{ itemPath }}</div>
          <p class="mt-2 text-red-400/80">此操作無法撤銷，所有相關數據將會消失。</p>
        </div>

        <div class="space-y-2">
          <div class="text-[11px] text-white/40">請輸入完整路徑以確認刪除：</div>
          <input 
            ref="inputRef"
            v-model="userInput"
            @keyup.enter="handleConfirm"
            class="w-full bg-black/40 border border-white/10 rounded-md px-3 py-2 text-[12px] outline-none focus:border-red-500 transition-all placeholder:text-white/10"
            :placeholder="itemPath"
          />
        </div>
      </div>

      <div class="px-4 py-3 bg-white/[0.02] flex gap-2 justify-end border-t border-white/5">
        <button 
          @click="close"
          class="px-4 py-1.5 rounded-md text-[11px] font-medium text-white/40 hover:text-white hover:bg-white/5 transition-all"
        >
          取消
        </button>
        <button 
          @click="handleConfirm"
          :disabled="userInput !== itemPath"
          class="px-4 py-1.5 rounded-md text-[11px] font-medium bg-red-500 text-white disabled:opacity-20 disabled:cursor-not-allowed hover:bg-red-600 transition-all shadow-lg active:scale-95 shadow-red-500/10"
        >
          確認刪除
        </button>
      </div>
    </div>
  </div>
</template>
