<script setup lang="ts">
import { ref, computed } from 'vue';
import { 
  X, 
  Pipette, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  LayoutList, 
  LayoutGrid, 
  FoldVertical, 
  UnfoldVertical,
  Link2Off,
  Check
} from 'lucide-vue-next';
import { useColorConversion } from '../../composables/useColorConversion';
import type { PickerTarget } from '../../types';

interface Props {
  visible: boolean;
  pos: { top: number, left: number };
  target: PickerTarget | null;
  hsv: { h: number, s: number, v: number, a: number };
  allVariables: any[];
  isDuplicateName: boolean;
  collections: any[];
}

const props = defineProps<Props>();
const emit = defineEmits([
  'update:hsv', 
  'update:visible', 
  'update:target',
  'close',
  'update-variable',
  'set-alias',
  'detach-alias',
  'rename',
  'update-description',
  'value-input',
  'variable-hover',
  'mouse-move'
]);

const { 
  rgbaToHsva, 
  hsvaToRgba, 
  rgbaToHex, 
  rgbaToHsla 
} = useColorConversion();

// --- Local State ---
const pickerTab = ref<'Custom' | 'Libraries'>('Custom');
const pickerColorMode = ref<'Hex' | 'RGB' | 'CSS'>('Hex');
const isColorModeDropdownOpen = ref(false);
const isVariableInfoExpanded = ref(false);
const librarySearchQuery = ref('');
const isLibraryGrid = ref(false);
const collapsedLibraryGroups = ref<Set<string>>(new Set());

// --- Computed ---
const pickerRgba = computed(() => hsvaToRgba(props.hsv));
const pickerHsla = computed(() => {
  const rgba = hsvaToRgba(props.hsv);
  return rgbaToHsla(rgba);
});

const pickerHex = computed({
  get: () => rgbaToHex(pickerRgba.value),
  set: (val: string) => {
    // Only update if it's a valid hex
    if (/^#?[0-9A-Fa-f]{3,8}$/.test(val)) {
      const rgba = hexToRgbaLocal(val);
      emit('update:hsv', rgbaToHsva(rgba));
    }
  }
});

// Duplicated local helper for internal hex set (to avoid complex circular emits)
function hexToRgbaLocal(hex: string) {
  let r = 0, g = 0, b = 0, a = 1;
  hex = hex.replace('#', '');
  if (hex.length === 3) {
    r = parseInt(hex[0] + hex[0], 16);
    g = parseInt(hex[1] + hex[1], 16);
    b = parseInt(hex[2] + hex[2], 16);
  } else if (hex.length === 6) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
  } else if (hex.length === 8) {
    r = parseInt(hex.substring(0, 2), 16);
    g = parseInt(hex.substring(2, 4), 16);
    b = parseInt(hex.substring(4, 6), 16);
    a = parseInt(hex.substring(6, 8), 16) / 255;
  }
  return { r, g, b, a };
}

const filteredLibraries = computed(() => {
  let result: any[] = [];
  props.collections.forEach(col => {
    col.variables.forEach((v: any) => {
      if (v.type === 'COLOR') {
        const q = librarySearchQuery.value.toLowerCase();
        if (!q || v.name.toLowerCase().includes(q) || col.collectionName.toLowerCase().includes(q)) {
          result.push({ ...v, collectionName: col.collectionName });
        }
      }
    });
  });
  return result;
});

const groupedLibraries = computed(() => {
  const groups: Record<string, any[]> = {};
  filteredLibraries.value.forEach((v: any) => {
    const colName = v.collectionName;
    const parts = v.name.split('/');
    const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : 'General';
    const fullGroupName = `${colName} · ${folder}`;
    if (!groups[fullGroupName]) groups[fullGroupName] = [];
    groups[fullGroupName].push(v);
  });
  return groups;
});

const anyLibraryGroupsExpanded = computed(() => {
  const allGroups = Object.keys(groupedLibraries.value);
  if (allGroups.length === 0) return false;
  return allGroups.some(g => !collapsedLibraryGroups.value.has(g));
});

// --- Methods ---
const closePicker = () => emit('close');

const switchToCustomTab = () => {
  pickerTab.value = 'Custom';
};

const handleRgbaInput = (key: string, val: any) => {
  const num = parseInt(val) || 0;
  const newRgba = { ...pickerRgba.value, [key]: Math.max(0, Math.min(255, num)) };
  emit('update:hsv', rgbaToHsva(newRgba));
};

const handleAlphaInputRelative = (val: any) => {
  const num = parseInt(val) || 0;
  const newRgba = { ...pickerRgba.value, a: Math.max(0, Math.min(100, num)) / 100 };
  emit('update:hsv', rgbaToHsva(newRgba));
};

const toggleLibraryGroup = (name: string) => {
  if (collapsedLibraryGroups.value.has(name)) {
    collapsedLibraryGroups.value.delete(name);
  } else {
    collapsedLibraryGroups.value.add(name);
  }
};

const toggleLibrarySmartGroups = () => {
  if (anyLibraryGroupsExpanded.value) {
    Object.keys(groupedLibraries.value).forEach(g => collapsedLibraryGroups.value.add(g));
  } else {
    collapsedLibraryGroups.value.clear();
  }
};

const cycleColorMode = () => {
  const modes = ['Hex', 'RGB', 'CSS'] as const;
  const idx = modes.indexOf(pickerColorMode.value);
  pickerColorMode.value = modes[(idx + 1) % modes.length];
};

// --- Dragging Logic ---
const handleSVMouse = (e: MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const update = (moveEvent: MouseEvent | { clientX: number, clientY: number }) => {
    const s = Math.max(0, Math.min(100, ((moveEvent.clientX - rect.left) / rect.width) * 100));
    const v = Math.max(0, Math.min(100, (1 - (moveEvent.clientY - rect.top) / rect.height) * 100));
    emit('update:hsv', { ...props.hsv, s, v });
  };
  update(e);
  const onMove = (ev: MouseEvent) => update(ev);
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
};

const handleHueMouse = (e: MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const update = (moveEvent: MouseEvent | { clientX: number }) => {
    const h = Math.max(0, Math.min(360, ((moveEvent.clientX - rect.left) / rect.width) * 360));
    emit('update:hsv', { ...props.hsv, h });
  };
  update(e);
  const onMove = (ev: MouseEvent) => update(ev);
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
};

const handleAlphaMouse = (e: MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const update = (moveEvent: MouseEvent | { clientX: number }) => {
    const a = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
    emit('update:hsv', { ...props.hsv, a });
  };
  update(e);
  const onMove = (ev: MouseEvent) => update(ev);
  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
};

const internalTarget = computed({
  get: () => props.target,
  set: (val) => emit('update:target', val)
});

</script>

<template>
  <div v-if="visible">
    <!-- Click Outside Overlay -->
    <div 
      class="fixed inset-0 z-[1999] bg-transparent cursor-default"
      @click="closePicker"
    ></div>

    <div 
      class="fixed z-[2000] w-[260px] bg-[#2C2C2C] border border-[#444] rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden text-white pointer-events-auto"
      :style="{ top: pos.top + 'px', left: pos.left + 'px' }"
    >
      <!-- Tabs Header -->
      <div class="flex items-center justify-between px-2 pt-1 border-b border-white/5 bg-[#2C2C2C]">
        <div class="flex">
          <button 
            @click="switchToCustomTab"
            class="px-3 py-2 text-[11px] font-medium transition-colors relative"
            :class="pickerTab === 'Custom' ? 'text-white' : 'text-white/40 hover:text-white/60'"
          >
            Custom
            <div v-if="pickerTab === 'Custom'" class="absolute bottom-0 left-0 w-full h-[2px] bg-figma-accent"></div>
          </button>
          <button 
            @click="pickerTab = 'Libraries'"
            class="px-3 py-2 text-[11px] font-medium transition-colors relative"
            :class="pickerTab === 'Libraries' ? 'text-white' : 'text-white/40 hover:text-white/60'"
          >
            Libraries
            <div v-if="pickerTab === 'Libraries'" class="absolute bottom-0 left-0 w-full h-[2px] bg-figma-accent"></div>
          </button>
        </div>
        <button @click="closePicker" class="p-2 opacity-40 hover:opacity-100 transition-opacity">
          <X :size="14" />
        </button>
      </div>

      <!-- Content -->
      <div class="p-3 space-y-2 relative flex-1 flex flex-col min-h-0">
        <!-- Variable Name Input (Hidden in Libraries tab) -->
        <div v-if="pickerTab !== 'Libraries'" class="relative shrink-0">
          <div class="text-[10px] text-white/40 px-0.5">Name</div>
          <input 
            id="picker-name-input"
            :value="target?.name" 
            @input="(e: any) => $emit('update:target', { ...target, name: e.target.value })"
            @blur="$emit('rename')"
            @keyup.enter="$emit('rename')"
            class="w-full bg-black/20 border rounded px-2 py-1.5 text-[11px] outline-none text-white/80 placeholder:text-white/20 transition-colors"
            :class="isDuplicateName ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-figma-accent'"
            placeholder="Name"
          />
          <div v-if="isDuplicateName" class="text-[9px] text-red-400 mt-0.5 flex items-center gap-1">
            <span>變數名稱已存在</span>
          </div>
        </div>

        <template v-if="pickerTab === 'Custom'">
          <template v-if="target?.type === 'COLOR'">
            <!-- Color Display / Alias -->
            <div class="px-0.5 mt-1">
              <div v-if="target?.alias" class="flex items-center justify-between bg-white/[0.04] p-1 rounded-md border border-white/[0.06] group/alias">
                <div class="flex items-center gap-2 px-1 py-0.5 bg-figma-accent/10 rounded border border-figma-accent/20">
                  <div class="w-2.5 h-2.5 rounded-sm shrink-0" :style="{ backgroundColor: target.initialValue }"></div>
                  <span class="text-[10px] font-medium text-figma-accent truncate max-w-[120px]">{{ target.alias.name }}</span>
                </div>
                <button 
                  @click="$emit('detach-alias')"
                  class="p-1 text-white/30 hover:text-white/80 hover:bg-white/5 rounded transition-all"
                  title="Detach variable"
                >
                  <Link2Off :size="12" />
                </button>
              </div>
              
              <div v-else class="relative w-full h-[150px] rounded-md overflow-hidden cursor-crosshair shrink-0"
                :style="{ backgroundColor: `hsl(${hsv.h}, 100%, 50%)` }"
                @mousedown="handleSVMouse"
              >
                <div class="absolute inset-0 bg-gradient-to-r from-white to-transparent"></div>
                <div class="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
                <!-- Handle -->
                <div 
                  class="absolute w-4 h-4 border-2 border-white rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.3)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  :style="{ left: hsv.s + '%', top: (100 - hsv.v) + '%' }"
                ></div>
              </div>
            </div>

            <!-- Eye dropper & Sliders -->
            <div class="flex items-center gap-2 py-1">
              <button class="p-1.5 hover:bg-white/10 rounded transition-colors text-white/70">
                <Pipette :size="14" />
              </button>
              
              <div class="flex-1 space-y-3">
                <!-- Hue Slider -->
                <div 
                  class="relative h-2.5 rounded-full cursor-pointer rainbow-gradient"
                  @mousedown="handleHueMouse"
                >
                  <div 
                    class="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border border-black/20 rounded-full shadow-md -translate-x-1/2"
                    :style="{ left: (hsv.h / 360 * 100) + '%' }"
                  ></div>
                </div>

                <!-- Alpha Slider -->
                <div 
                  class="relative h-2.5 rounded-full cursor-pointer checkerboard overflow-hidden"
                  @mousedown="handleAlphaMouse"
                >
                  <div 
                    class="absolute inset-0"
                    :style="{ background: `linear-gradient(to right, transparent, rgba(${pickerRgba.r},${pickerRgba.g},${pickerRgba.b},1))` }"
                  ></div>
                  <div 
                    class="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border border-black/20 rounded-full shadow-md -translate-x-1/2"
                    :style="{ left: (hsv.a * 100) + '%' }"
                  ></div>
                </div>
              </div>
            </div>

            <!-- Bottom Row: Mode & Inputs -->
            <div class="flex gap-1 items-center px-0.5 mt-0.5 relative">
              <!-- Mode Select -->
              <div class="w-[52px] shrink-0 h-[26px] relative">
                <button 
                  @click.stop="isColorModeDropdownOpen = !isColorModeDropdownOpen"
                  class="w-full h-full px-1 bg-black/20 hover:bg-black/40 rounded text-[10px] font-medium transition-all flex items-center justify-between gap-0.5 border border-white/5"
                >
                  <span class="truncate">{{ pickerColorMode }}</span>
                  <ChevronDown :size="10" class="shrink-0 opacity-40" />
                </button>
                
                <!-- Dropdown Menu -->
                <div v-if="isColorModeDropdownOpen" class="absolute bottom-full left-0 mb-1 w-[70px] bg-[#333] border border-[#444] rounded shadow-xl z-50 overflow-hidden">
                  <div 
                    v-for="mode in (['RGB', 'Hex', 'CSS'] as const)" 
                    :key="mode"
                    @click="pickerColorMode = mode; isColorModeDropdownOpen = false"
                    class="px-2 py-1.5 text-[10px] hover:bg-figma-accent hover:text-white cursor-pointer transition-colors"
                    :class="{ 'text-figma-accent font-bold': pickerColorMode === mode }"
                  >
                    {{ mode }}
                  </div>
                </div>
              </div>

              <!-- Main Input Area -->
              <div class="flex-1 min-w-0 h-[26px]">
                <div v-if="pickerColorMode === 'RGB'" class="w-full h-full grid grid-cols-3 gap-[2px]">
                  <input v-for="key in ['r','g','b']" :key="key"
                    :value="pickerRgba[key as keyof typeof pickerRgba]"
                    @input="(e: any) => handleRgbaInput(key, (e.target as HTMLInputElement).value)"
                    class="w-full h-full bg-black/20 border border-white/5 rounded text-[10px] text-center outline-none focus:bg-black/30 text-white/90"
                  />
                </div>
                <input 
                  v-else-if="pickerColorMode === 'Hex'"
                  v-model="pickerHex"
                  class="w-full h-full bg-black/20 border border-white/5 rounded px-2 text-[10px] outline-none focus:bg-black/30 font-mono uppercase text-white/90"
                />
                <input 
                  v-else
                  :value="`rgb(${pickerRgba.r} ${pickerRgba.g} ${pickerRgba.b}${pickerRgba.a < 1 ? ' / ' + pickerRgba.a.toFixed(2) : ''})`"
                  readonly
                  class="w-full h-full bg-black/20 border border-white/5 rounded px-2 text-[9px] outline-none opacity-60 font-mono text-white/80"
                />
              </div>

              <div v-if="pickerColorMode !== 'CSS'" class="w-[60px] shrink-0 flex items-center gap-0 h-[24px] px-1 bg-black/20 border border-white/5 rounded">
                <input 
                  :value="Math.round(pickerRgba.a * 100)"
                  @input="(e: any) => handleAlphaInputRelative((e.target as HTMLInputElement).value)"
                  class="w-full bg-transparent text-[10px] text-center outline-none text-white/90 p-0"
                />
                <span class="text-[9px] opacity-20 select-none">%</span>
              </div>
            </div>
          </template>

          <template v-else>
            <div>
              <div class="text-[10px] text-white/40 font-medium px-0.5">Value</div>
              <input 
                :value="target?.initialValue" 
                @input="(e: any) => $emit('value-input', e.target.value)"
                class="w-full bg-black/20 border border-white/10 rounded px-2 py-2 text-[11px] outline-none text-white/80 focus:border-figma-accent transition-colors"
                :placeholder="target?.type === 'FLOAT' ? '0' : 'Value text'"
              />
            </div>
          </template>

          <!-- Advanced Section -->
          <div class="pt-1 mt-2 border-t border-white/5">
            <div 
              @click="isVariableInfoExpanded = !isVariableInfoExpanded"
              class="flex items-center justify-between h-8 cursor-pointer -mx-1 px-1 rounded transition-colors group"
            >
              <div class="flex items-center gap-2">
                <div :class="{ 'rotate-90': isVariableInfoExpanded }" class="transition-transform duration-200">
                  <ChevronRight :size="10" class="opacity-30" />
                </div>
                <span class="text-[10px] text-white/30 group-hover:text-white/80" :class="{ 'text-white/80': isVariableInfoExpanded }">進階設定</span>
              </div>
            </div>

            <div v-if="isVariableInfoExpanded" class="space-y-3 px-1 pb-1 animate-in fade-in slide-in-from-top-1 duration-200">
              <div>
                <textarea 
                  :value="target?.initialDescription"
                  @input="(e: any) => $emit('update:target', { ...target, initialDescription: e.target.value })"
                  @blur="$emit('update-description')"
                  class="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-[11px] outline-none text-white/80 focus:border-figma-accent min-h-[60px] resize-none placeholder:text-white/20 transition-colors"
                  placeholder="描述"
                ></textarea>
              </div>
            </div>
          </div>
        </template>

        <template v-else>
          <!-- Libraries Tab -->
          <div class="flex flex-col h-[400px] -m-3 overflow-hidden bg-[#2C2C2C]">
            <div class="p-2 border-b border-white/5 space-y-3 bg-[#242424]">
              <div class="flex items-center gap-1">
                <div class="relative flex-1 group/search">
                  <Search :size="12" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within/search:text-figma-accent transition-colors" />
                  <input 
                    v-model="librarySearchQuery"
                    class="w-full bg-black/40 border border-white/5 hover:border-white/10 rounded-md pl-8 pr-3 py-1.5 text-[11px] outline-none focus:border-figma-accent/50 focus:bg-black/60 placeholder:text-white/20 transition-all shadow-inner"
                    placeholder="Search libraries..."
                  />
                </div>

                <div class="flex bg-black/40 p-0.5 rounded-lg border border-white/5 shrink-0">
                  <button @click="isLibraryGrid = false" :class="!isLibraryGrid ? 'bg-[#333] text-white shadow-md' : 'text-white/20 hover:text-white/40'" class="p-1.5 rounded-md transition-all duration-200">
                    <LayoutList :size="14" />
                  </button>
                  <button @click="isLibraryGrid = true" :class="isLibraryGrid ? 'bg-[#333] text-white shadow-md' : 'text-white/20 hover:text-white/40'" class="p-1.5 rounded-md transition-all duration-200">
                    <LayoutGrid :size="14" />
                  </button>
                </div>

                <button @click="toggleLibrarySmartGroups" :title="anyLibraryGroupsExpanded ? 'Collapse All' : 'Expand All'" class="px-1 transition-colors text-white/40 hover:text-white/80">
                  <FoldVertical v-if="anyLibraryGroupsExpanded" :size="15" />
                  <UnfoldVertical v-else :size="15" />
                </button>
              </div>
            </div>

            <div class="flex-1 overflow-y-auto custom-scrollbar p-2">
              <div v-if="filteredLibraries.length === 0" class="flex flex-col items-center justify-center h-full opacity-20">
                <Search :size="32" class="mb-2" />
                <span class="text-[11px]">No matching variables</span>
              </div>

              <div v-else-if="isLibraryGrid" class="space-y-4">
                <div v-for="(vars, groupFullName) in groupedLibraries" :key="groupFullName" class="space-y-2">
                  <div @click="toggleLibraryGroup(groupFullName as string)" class="flex items-center gap-1 cursor-pointer group/header mb-1 px-1">
                    <ChevronDown v-if="!collapsedLibraryGroups.has(groupFullName as string)" :size="10" class="text-white/20 group-hover/header:text-white/40 transition-transform" />
                    <ChevronRight v-else :size="10" class="text-white/20 group-hover/header:text-white/40 transition-transform" />
                    <div class="text-[9px] text-white/30 group-hover/header:text-white/50 transition-colors">{{ groupFullName }}</div>
                    <div class="h-[1px] flex-1 bg-white/5 ml-2"></div>
                  </div>

                  <div v-if="!collapsedLibraryGroups.has(groupFullName as string)" class="grid grid-cols-8 gap-1 pl-4 pr-1">
                    <div 
                      v-for="v in vars" :key="v.id"
                      @click="$emit('set-alias', v.id)"
                      @mouseenter="$emit('variable-hover', $event, v)"
                      @mousemove="$emit('mouse-move', $event)"
                      @mouseleave="$emit('variable-hover', null, null)"
                      class="aspect-square rounded-md shadow-sm transition-all duration-300 relative group/griditem overflow-visible"
                      :class="target?.id === v.id ? 'cursor-not-allowed grayscale-[0.8] opacity-40' : 'cursor-pointer'"
                      :style="{ backgroundColor: v.colorValue }"
                    >
                      <div v-if="target?.alias?.id === v.id" class="absolute -inset-[1px] rounded-lg border-2 border-figma-accent z-10 scale-105 flex items-center justify-center bg-figma-accent/10"></div>
                      <div v-else-if="target?.id !== v.id" class="absolute inset-0 rounded-md border border-white/10 group-hover/griditem:border-white/30 group-hover/griditem:scale-110 transition-all"></div>
                      <div v-if="target?.id === v.id" class="absolute inset-0 flex items-center justify-center">
                        <X :size="12" class="text-red-500 stroke-[3px]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div v-else class="space-y-4">
                <div v-for="(vars, groupFullName) in groupedLibraries" :key="groupFullName" class="space-y-1">
                  <div @click="toggleLibraryGroup(groupFullName as string)" class="flex items-center gap-1 cursor-pointer group/header mb-1 px-1">
                    <ChevronDown v-if="!collapsedLibraryGroups.has(groupFullName as string)" :size="10" class="text-white/20 group-hover/header:text-white/40 transition-transform" />
                    <ChevronRight v-else :size="10" class="text-white/20 group-hover/header:text-white/40 transition-transform" />
                    <div class="text-[9px] text-white/30 group-hover/header:text-white/50 transition-colors">{{ groupFullName }}</div>
                    <div class="h-[1px] flex-1 bg-white/5 ml-2"></div>
                  </div>

                  <div v-if="!collapsedLibraryGroups.has(groupFullName as string)">
                    <div 
                      v-for="v in vars" :key="v.id"
                      @click="$emit('set-alias', v.id)"
                      @mouseenter="$emit('variable-hover', $event, v)"
                      @mousemove="$emit('mouse-move', $event)"
                      @mouseleave="$emit('variable-hover', null, null)"
                      class="flex items-center gap-2.5 h-[28px] px-4 rounded-lg transition-all relative overflow-hidden"
                      :class="[
                        target?.alias?.id === v.id ? 'bg-white/[0.02]' : 'hover:bg-white/5',
                        target?.id === v.id ? 'cursor-not-allowed opacity-30 grayscale' : 'cursor-pointer group'
                      ]"
                    >
                      <div class="w-4 h-4 rounded-md border border-white/10 shrink-0 shadow-sm" :style="{ backgroundColor: v.colorValue }"></div>
                      <span class="text-[11px] truncate flex-1 transition-colors" :class="target?.alias?.id === v.id ? 'text-white font-bold' : 'text-white/60 group-hover:text-white/90'">{{ v.name.split('/').pop() }}</span>
                      <Check v-if="target?.alias?.id === v.id" :size="12" class="text-white shrink-0" />
                      <X v-if="target?.id === v.id" :size="12" class="text-red-500/50 shrink-0" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
