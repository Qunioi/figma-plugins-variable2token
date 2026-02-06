<script setup lang="ts">
import { ref, watch } from 'vue';
import { X, ChevronDown } from 'lucide-vue-next';

interface Props {
  visible: boolean;
  pos: { top: number, left: number };
  title: string;
  name: string;
  valueLabel: string;
  value: string;
  options?: string[]; // 新增下拉選單選項
}

const props = defineProps<Props>();
const emit = defineEmits(['close', 'save']);

const localName = ref(props.name);
const localValue = ref(props.value);
const isDropdownOpen = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

watch(() => props.name, (newVal) => {
  localName.value = newVal;
});

watch(() => props.value, (newVal) => {
  localValue.value = newVal;
});

watch(() => props.visible, (newVal) => {
  if (newVal) {
    isDropdownOpen.value = false;
    setTimeout(() => {
      inputRef.value?.focus();
      inputRef.value?.select();
    }, 50);
  }
});

const handleSave = () => {
  // 只有在名稱或值有變動時才儲存
  if (localName.value.trim() !== props.name || localValue.value !== props.value) {
    emit('save', localName.value.trim(), localValue.value);
  }
};

const confirm = () => {
  handleSave();
  emit('close');
};

const selectOption = (opt: string) => {
  localValue.value = opt;
  isDropdownOpen.value = false;
};
</script>

<template>
  <div v-if="visible">
    <!-- Click Outside Overlay -->
    <div 
      class="fixed inset-0 z-[2999] bg-transparent cursor-default"
      @click="emit('close')"
    ></div>

    <div 
      class="fixed z-[3000] w-[220px] bg-[#2C2C2C] border border-[#444] rounded-lg shadow-[0_12px_32px_rgba(0,0,0,0.6)] flex flex-col overflow-visible text-white pointer-events-auto"
      :style="{ top: pos.top + 'px', left: pos.left + 'px' }"
      @click.stop
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-[#2C2C2C]">
        <span class="text-[10px] font-bold opacity-40 uppercase tracking-widest">{{ title }}</span>
        <button @click="emit('close')" class="opacity-40 hover:opacity-100 transition-opacity active:scale-[0.98]">
          <X :size="14" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-3 space-y-4">
        <!-- Name Input -->
        <div>
          <div class="text-[10px] text-white/40 mb-1.5 pl-0.5">Name</div>
          <input 
            ref="inputRef"
            v-model="localName"
            @keyup.enter="confirm"
            @keyup.escape="emit('close')"
            class="w-full bg-black/20 border border-white/10 rounded px-2.5 py-2 text-[11px] outline-none text-white/80 focus:border-figma-accent transition-colors"
            placeholder="Enter name..."
          />
        </div>

        <!-- Info/Select Area -->
        <div class="relative">
          <div class="text-[10px] text-white/40 mb-1.5 pl-0.5">{{ valueLabel }}</div>
          
          <!-- Dropdown Style -->
          <template v-if="options && options.length > 0">
            <div 
              @click="isDropdownOpen = !isDropdownOpen"
              class="w-full bg-black/20 border border-white/10 rounded px-2.5 py-2 text-[11px] flex items-center justify-between cursor-pointer hover:bg-black/30 transition-all select-none"
              :class="isDropdownOpen ? 'border-figma-accent' : 'border-white/10 text-white/60'"
            >
              <span class="truncate">{{ localValue }}</span>
              <ChevronDown :size="12" class="opacity-40" :class="{ 'rotate-180': isDropdownOpen }" />
            </div>

            <!-- Options Menu -->
            <div v-if="isDropdownOpen" class="absolute top-full left-0 w-full mt-1 bg-[#333] border border-[#444] rounded shadow-xl z-10 max-h-[150px] overflow-y-auto custom-scrollbar">
              <div 
                v-for="opt in options" 
                :key="opt"
                @click="selectOption(opt)"
                class="px-3 py-2 text-[11px] hover:bg-figma-accent hover:text-white cursor-pointer transition-colors border-b border-white/5 last:border-0"
                :class="{ 'text-figma-accent font-bold': localValue === opt }"
              >
                {{ opt }}
              </div>
            </div>
          </template>

          <!-- Static Text Style -->
          <div v-else class="w-full bg-black/10 border border-white/5 rounded px-2.5 py-2 text-[11px] text-white/30 italic truncate select-all">
            {{ value }}
          </div>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="px-3 pb-3 pt-1 flex items-center justify-end gap-2">
        <button 
          @click="emit('close')"
          class="px-3 py-1.5 text-[11px] text-white/40 hover:text-white hover:bg-white/5 rounded transition-all active:scale-[0.98]"
        >
          Cancel
        </button>
        <button 
          @click="confirm"
          class="px-4 py-1.5 text-[11px] bg-figma-accent text-white rounded font-medium hover:brightness-110 transition-all active:scale-[0.98]"
        >
          {{ title.toLowerCase().includes('duplicate') ? 'Duplicate' : 'Save' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.select-all {
  user-select: all;
}
</style>
