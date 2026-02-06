<script setup lang="ts">
import { AlertTriangle, X } from 'lucide-vue-next';

interface Props {
  visible: boolean;
  collectionName: string;
  modeName: string;
}

defineProps<Props>();
const emit = defineEmits(['close', 'confirm']);
</script>

<template>
  <div v-if="visible" class="fixed inset-0 z-[11000] flex items-center justify-center">
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="$emit('close')"></div>

    <div class="relative w-[340px] bg-[#2C2C2C] border border-[#444] rounded-xl shadow-[0_24px_48px_rgba(0,0,0,0.8)] overflow-hidden text-white flex flex-col animate-in zoom-in-95 duration-200">
      <div class="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div class="flex items-center gap-2 text-amber-300">
          <AlertTriangle :size="16" />
          <span class="text-[13px] font-bold">覆蓋確認</span>
        </div>
        <button @click="$emit('close')" class="p-1 opacity-40 hover:opacity-100 transition-opacity">
          <X :size="16" />
        </button>
      </div>

      <div class="p-5 space-y-3">
        <div class="text-[12px] text-white/70 leading-relaxed">
          此模式與遠端檔案不同，是否要用 GitHub 內容覆蓋本地？
        </div>
        <div class="text-[12px] text-white/50">
          目標：
          <span class="ml-1 text-white font-mono bg-white/5 px-2 py-1 rounded inline-block">
            {{ collectionName }} / {{ modeName }}
          </span>
        </div>
      </div>

      <div class="px-4 py-3 bg-white/[0.02] flex gap-2 justify-end border-t border-white/5">
        <button
          @click="$emit('close')"
          class="px-4 py-1.5 rounded-md text-[11px] font-medium text-white/50 hover:text-white hover:bg-white/5 transition-all"
        >
          取消
        </button>
        <button
          @click="$emit('confirm')"
          class="px-4 py-1.5 rounded-md text-[11px] font-medium bg-amber-500 text-black hover:bg-amber-400 transition-all shadow-lg active:scale-95"
        >
          覆蓋
        </button>
      </div>
    </div>
  </div>
</template>
