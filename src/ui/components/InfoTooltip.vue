<script setup lang="ts">
import { computed } from 'vue';
import { Link as LinkIcon } from 'lucide-vue-next';

interface Props {
  variable: any | null;
  activeMode: string | null;
  mousePos: { x: number, y: number };
  placement: 'top' | 'bottom';
}

const props = defineProps<Props>();

const colorValue = computed(() => {
  if (!props.variable) return '';
  if (props.variable.colorValue) return props.variable.colorValue;
  
  const modeVal = props.variable.values?.find((m: any) => m.modeId === props.activeMode) || props.variable.values?.[0];
  const val = modeVal?.value || '#000000';
  return typeof val === 'string' ? val.toUpperCase() : String(val);
});

const aliasName = computed(() => {
  if (!props.variable) return null;
  const modeVal = props.variable.values?.find((m: any) => m.modeId === props.activeMode) || props.variable.values?.[0];
  return modeVal?.alias ? (modeVal.alias.name.split('/').pop() || modeVal.alias.name) : null;
});

const displayType = computed(() => {
  if (!props.variable) return '';
  switch (props.variable.type?.toUpperCase()) {
    case 'FLOAT': return 'Number';
    case 'COLOR': return 'Color';
    case 'STRING': return 'String';
    case 'BOOLEAN': return 'Boolean';
    default: return props.variable.type;
  }
});

const tooltipPosition = computed(() => {
  const tooltipWidth = 240; // tooltip 的大約寬度
  const tooltipHeight = 150; // tooltip 的大約高度
  const padding = 10; // 與邊界的安全距離
  
  let finalPlacement: 'top' | 'bottom' = props.placement;
  let top = finalPlacement === 'top' ? (props.mousePos.y - 12) : (props.mousePos.y + 12);
  let left = props.mousePos.x;
  let transform = finalPlacement === 'top' ? 'translateX(-50%) translateY(-100%)' : 'translateX(-50%)';
  
  // 水平邊界檢測
  const halfWidth = tooltipWidth / 2;
  if (left - halfWidth < padding) {
    // 太靠左，改為左對齊
    left = padding;
    transform = props.placement === 'top' ? 'translateY(-100%)' : '';
  } else if (left + halfWidth > window.innerWidth - padding) {
    // 太靠右，改為右對齊
    left = window.innerWidth - padding;
    transform = props.placement === 'top' ? 'translateX(-100%) translateY(-100%)' : 'translateX(-100%)';
  }
  
  // 垂直邊界檢測
  if (finalPlacement === 'top' && top - tooltipHeight < padding) {
    // 上方空間不足，改為下方顯示
    top = props.mousePos.y + 12;
    transform = transform.replace('translateY(-100%)', '');
    finalPlacement = 'bottom';
  } else if (finalPlacement === 'bottom' && top + tooltipHeight > window.innerHeight - padding) {
    // 下方空間不足，改為上方顯示
    top = props.mousePos.y - 12;
    if (!transform.includes('translateY')) {
      transform = transform ? transform + ' translateY(-100%)' : 'translateY(-100%)';
    }
    finalPlacement = 'top';
  }
  
  return {
    style: {
      top: top + 'px',
      left: left + 'px',
      transform
    },
    placement: finalPlacement
  };
});
</script>

<template>
  <transition name="tooltip-premium">
    <div 
      v-if="variable && mousePos.x" 
      class="info-tooltip fixed z-[99999] pointer-events-none"
      :style="tooltipPosition.style"
    >
      <div class="glass-container p-3 flex flex-col gap-2.5">
        <!-- Header: Type & Name -->
        <div class="flex items-center gap-2 border-b border-white/5 pb-2">
          <div 
            class="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[9px] font-medium text-white/40 tracking-wider"
          >
            {{ displayType }}
          </div>
          <div class="text-[11px] font-bold text-white/90 truncate leading-tight flex-1">
            {{ variable.name.split('/').pop() }}
          </div>
        </div>
        
        <!-- Content Area -->
        <div class="flex flex-col gap-2">
          <!-- Visual Preview & Value -->
          <div class="flex items-center gap-2 px-2 py-2 bg-white/[0.04] rounded-md border border-white/5 shadow-inner">
            <div 
              v-if="variable.type?.toUpperCase() === 'COLOR'"
              class="w-5 h-5 rounded-md border border-white/20 shrink-0 shadow-lg relative overflow-hidden checkerboard-bg" 
            >
              <div class="absolute inset-0" :style="{ backgroundColor: colorValue }"></div>
            </div>
            <div 
              v-else
              class="w-5 h-5 flex items-center justify-center rounded-md bg-white/5 border border-white/5 text-[10px] font-bold text-white/40 shrink-0 shadow-lg"
            >
              {{ variable.type?.toUpperCase() === 'BOOLEAN' ? 'TF' : variable.type?.toUpperCase() === 'FLOAT' ? '0.1' : 'Aa' }}
            </div>

            <div class="flex flex-col min-w-0 flex-1 justify-center">
              <!-- Linked Name (Alias) -->
              <div v-if="aliasName" class="flex items-center gap-1.5 min-w-0 mb-1">
                <LinkIcon :size="10" class="text-figma-accent shrink-0" />
                <span class="text-[11px] font-bold text-figma-accent truncate leading-none">{{ aliasName }}</span>
              </div>
              <div class="flex items-center gap-1.5 min-w-0">
                <span 
                  class="text-[10px] font-mono text-white/70 tracking-wide leading-none truncate block"
                  :class="{ 'uppercase': variable.type?.toUpperCase() === 'COLOR' }"
                >
                  {{ variable.type?.toUpperCase() === 'COLOR' ? colorValue : (variable.values?.find((m: any) => m.modeId === activeMode)?.value || 'N/A') }}
                </span>
              </div>
            </div>
          </div>

          <!-- Description Section -->
          <div v-if="variable.description" class="px-1.5 py-1">
            <div class="text-[12px] text-figma-accent leading-relaxed break-words font-medium">
              {{ variable.description }}
            </div>
          </div>
        </div>
        
        <!-- Decoration Glow -->
        <div class="absolute -inset-[1px] rounded-[11px] bg-gradient-to-br from-white/10 to-transparent -z-10"></div>
      </div>

      <!-- Arrow -->
      <div 
        v-if="tooltipPosition.placement === 'top'"
        class="tooltip-arrow absolute top-[calc(100%-6px)] left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1e1e1e] rotate-45 border-r border-b border-white/10 -z-10"
      ></div>
      <div 
        v-else
        class="tooltip-arrow absolute bottom-[calc(100%-6px)] left-1/2 -translate-x-1/2 w-3 h-3 bg-[#1e1e1e] rotate-45 border-l border-t border-white/10 -z-10"
      ></div>
    </div>
  </transition>
</template>

<style scoped>
.tooltip-premium-enter-active, .tooltip-premium-leave-active { 
  transition: opacity 0.25s cubic-bezier(0.16, 1, 0.3, 1), 
              transform 0.25s cubic-bezier(0.16, 1, 0.3, 1); 
}
.tooltip-premium-enter-from, .tooltip-premium-leave-to { 
  opacity: 0; 
  transform: v-bind('placement === "top" ? "translateX(-50%) translateY(-95%) scale(0.9)" : "translateX(-50%) translateY(15%) scale(0.9)"') !important;
}

.glass-container {
  background: rgba(30, 30, 30, 0.95);
  border-radius: 12px;
  min-width: 160px;
  max-width: 300px;
}

.checkerboard-bg {
  background-size: 8px 8px;
  background-position: 0 0, 0 4px, 4px 4px, 4px 0;
  background-color: #1e1e1e;
}

.info-tooltip {
  filter: drop-shadow(0 20px 25px rgba(0, 0, 0, 0.2));
}
</style>
