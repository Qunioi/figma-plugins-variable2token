<script setup lang="ts">
import { ref, computed } from 'vue';
import { 
  Package, 
  Library, 
  ChevronDown, 
  ChevronRight, 
  Settings2, 
  Download, 
  Copy, 
  Link as LinkIcon,
  Palette,
  Hash,
  Type,
  ToggleLeft,
  Github,
  CloudUpload,
  Settings,
  Check
} from 'lucide-vue-next';
import VueJsonPretty from 'vue-json-pretty';
import 'vue-json-pretty/lib/styles.css';
import InfoTooltip from './InfoTooltip.vue';
import GitHubSettings from './GitHubSettings.vue';

interface Props {
  activeCollection: any | null;
  activeMode: string | null;
  searchQuery: string;
  searchTypeFilter: string;
  viewMode: 'list' | 'grid' | 'json';
  jsonTheme: string;
  jsonThemeOptions: any[];
  hoveredVariable: any | null;
  mousePos: { x: number, y: number };
  tooltipPlacement: 'top' | 'bottom';
  collapsedGroups: Set<string>;
}

import { useVariableLogic } from '../../composables/useVariableLogic';

const props = defineProps<Props>();
const emit = defineEmits([
  'update:viewMode',
  'update:jsonTheme',
  'copy-value',
  'open-picker',
  'variable-hover',
  'mouse-move',
  'toggle-group',
  'json-node-click',
  'json-node-mouseover',
  'clear-json-hover',
  'json-mouse-move'
]);

const { 
  getMappedType, 
  getTypeSymbol, 
  generateOrderedJsonObject, 
  serializeJson 
} = useVariableLogic();

const filteredVariables = computed(() => {
  if (!props.activeCollection) return [];
  let vars = props.activeCollection.variables || [];
  
  if (props.searchTypeFilter !== 'ALL') {
    vars = vars.filter((v: any) => {
      const targetType = getMappedType(props.searchTypeFilter);
      return getMappedType(v.type) === targetType;
    });
  }
  
  // 文字搜尋
  if (props.searchQuery) {
    const q = props.searchQuery.toLowerCase();
    vars = vars.filter((v: any) => v.name.toLowerCase().includes(q));
  }
  
  return vars;
});

const groupedVariables = computed(() => {
  const groups: Record<string, any[]> = {};
  filteredVariables.value.forEach((v: any) => {
    const parts = v.name.split('/');
    const groupName = parts.length > 1 ? parts.slice(0, -1).join('/') : 'General';
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(v);
  });
  return groups;
});

const includeDescription = ref(true);

const jsonData = computed(() => {
  return generateOrderedJsonObject(filteredVariables.value, props.activeMode, { includeDescription: includeDescription.value });
});

// 自訂 JSON 序列化函數，保持順序
const jsonContent = computed(() => {
  return serializeJson(filteredVariables.value, props.activeMode, { includeDescription: includeDescription.value });
});

const getDisplayValue = (v: any) => {
  const modeVal = v.values.find((m: any) => m.modeId === props.activeMode) || v.values[0];
  if (modeVal?.alias) {
    return modeVal.alias.name.split('/').pop() || modeVal.alias.name;
  }
  const val = modeVal?.value;
  if (val === undefined || val === null) return 'N/A';

  if (v.type?.toUpperCase() === 'BOOLEAN') {
    return (val === true || val === 1 || val === 'true') ? 'true' : 'false';
  }
  
  return String(val);
};


const internalJsonTheme = computed({
  get: () => props.jsonTheme,
  set: (val) => emit('update:jsonTheme', val)
});

const currentModeName = computed(() => {
  if (!props.activeCollection || !props.activeMode) return 'tokens';
  const mode = props.activeCollection.modes.find((m: any) => m.modeId === props.activeMode);
  return mode ? mode.name : 'tokens';
});

const downloadJson = () => {
  const content = jsonContent.value;
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentModeName.value}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Event Handlers
const openPicker = (e: MouseEvent, v: any) => emit('open-picker', e, v);
const copyValue = (val: string, label: string) => emit('copy-value', val, label);
const handleVariableHover = (e: MouseEvent | null, v: any | null) => emit('variable-hover', e, v);
const handleMouseMove = (e: MouseEvent) => emit('mouse-move', e);
const toggleGroup = (name: string) => emit('toggle-group', name);
const handleJsonNodeClick = (...args: any[]) => {
  const [node, event] = args;
  emit('json-node-click', node, node?.path, event);
};

const handleJsonNodeMouseover = (...args: any[]) => {
  const [node, event] = args;
  emit('json-node-mouseover', node, node?.path, event);
};

const clearJsonHover = () => emit('clear-json-hover');
const handleJsonMouseMove = (e: MouseEvent) => emit('json-mouse-move', e);

const isGithubSettingsOpen = ref(false); // keep for local if needed, but actually can be removed
const isSyncing = ref(false); // can be removed

</script>

<template>
  <div class="flex-1 overflow-y-auto custom-scrollbar bg-figma-bg relative">
    <div v-if="!activeCollection" class="flex flex-col items-center justify-center h-full opacity-30 gap-3">
      <Package :size="48" stroke-width="1" />
      <p class="text-sm">Select a collection to view variables</p>
    </div>

    <div v-else-if="activeCollection.status === 'not-imported'" class="flex flex-col items-center justify-center h-full gap-4 p-8 text-center opacity-40">
      <Library :size="40" />
      <div class="space-y-1">
        <p class="font-medium text-[13px]">Library not imported</p>
        <p class="text-[11px] max-w-[200px]">Use a variable from this library in your design to load it.</p>
      </div>
    </div>

    <template v-else>
      <!-- List View -->
      <div v-if="viewMode === 'list'" class="p-2 space-y-2">
        <div v-for="(vars, groupName) in groupedVariables" :key="groupName" class="space-y-1">
          <div 
            @click="toggleGroup(groupName)"
            class="flex items-center gap-2 cursor-pointer group/header"
          >
            <ChevronDown v-if="!collapsedGroups.has(groupName)" :size="12" class="text-white/20 group-hover/header:text-white/40 transition-colors" />
            <ChevronRight v-else :size="12" class="text-white/20 group-hover/header:text-white/40 transition-colors" />
            <span class="text-[11px] text-white/30 group-hover/header:text-white/50 transition-colors">{{ groupName }}</span>
            <div class="h-[1px] flex-1 bg-white/5 ml-2"></div>
            <span class="text-[10px] opacity-20 font-mono pr-3">{{ vars.length }}</span>
          </div>

          <div v-show="!collapsedGroups.has(groupName)">
            <div 
              v-for="v in vars" 
              :key="v.name"
              class="flex items-center gap-3 pl-5 pr-2 h-[34px] group transition-all relative overflow-hidden hover:bg-white/[0.03]"
              @mouseenter="handleVariableHover($event, v)"
              @mousemove="handleMouseMove"
              @mouseleave="handleVariableHover(null, null)"
            >
              <!-- Icon / Color Swatch -->
              <div v-if="v.type?.toUpperCase() === 'COLOR'" class="relative shrink-0">
                <div 
                  class="w-5 h-5 rounded-md border border-figma-border shadow-sm transition-transform hover:scale-110 overflow-hidden cursor-pointer"
                  :style="{ backgroundColor: v.values.find((m:any) => m.modeId === activeMode)?.value || v.values[0]?.value }"
                  @click.stop="openPicker($event, v)"
                >
                </div>
              </div>
              <div 
                v-else 
                class="w-5 h-5 flex items-center justify-center rounded-md bg-white/5 border border-figma-border text-[9px] font-bold opacity-60 shrink-0 cursor-pointer hover:bg-white/10"
                @click.stop="openPicker($event, v)"
              >
                {{ getTypeSymbol(v.type) }}
              </div>

              <!-- Name -->
              <div class="flex-1 min-w-0 pointer-events-auto">
                <div 
                  class="text-[12px] truncate font-medium text-white/60 hover:text-white cursor-pointer transition-colors inline-block"
                  @click.stop="openPicker($event, v)"
                >
                  {{ v.name.split('/').pop() }}
                </div>
              </div>

              <!-- Value -->
              <div 
                class="font-mono text-[10px] px-2 py-1 rounded border transition-all truncate max-w-[140px] bg-black/20 border-white/5 text-white/40 group-hover:text-white/70 group-hover:border-white/10 select-all cursor-copy"
                @click.stop="copyValue(getDisplayValue(v), 'Value')"
                :title="getDisplayValue(v)"
              >
                {{ getDisplayValue(v) }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Grid View -->
      <div v-else-if="viewMode === 'grid'" class="p-2 space-y-2">
        <div v-for="(vars, groupName) in groupedVariables" :key="groupName" class="space-y-1">
          <div 
            @click="toggleGroup(groupName)"
            class="flex items-center gap-2 cursor-pointer group/header"
          >
            <ChevronDown v-if="!collapsedGroups.has(groupName)" :size="12" class="text-white/20 group-hover/header:text-white/40 transition-colors" />
            <ChevronRight v-else :size="12" class="text-white/20 group-hover/header:text-white/40 transition-colors" />
            <span class="text-[11px] text-white/30 group-hover/header:text-white/50 transition-colors">{{ groupName }}</span>
            <div class="h-[1px] flex-1 bg-white/5 ml-2"></div>
            <span class="text-[10px] opacity-20 font-mono pr-3">{{ vars.length }}</span>
          </div>

          <div v-show="!collapsedGroups.has(groupName)" class="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-16 gap-1.5 pl-4 pr-2">
            <div 
              v-for="v in vars" 
              :key="v.id"
              @click="openPicker($event, v)"
              @mouseenter="handleVariableHover($event, v)"
              @mousemove="handleMouseMove"
              @mouseleave="handleVariableHover(null, null)"
              class="flex flex-col gap-1.5 group/card cursor-pointer"
            >
              <div class="aspect-square rounded-lg bg-white/5 border border-white/5 flex items-center justify-center relative overflow-hidden transition-all duration-300 group-hover/card:border-white/20 group-hover/card:scale-105 group-hover/card:shadow-xl">
                <div v-if="v.type?.toUpperCase() === 'COLOR'" class="absolute inset-0" :style="{ backgroundColor: v.values.find((m:any) => m.modeId === activeMode)?.value || v.values[0]?.value }"></div>
                <span v-else class="text-xs font-bold opacity-20 group-hover/card:opacity-40">{{ getTypeSymbol(v.type) }}</span>
                
                <!-- Hover Overlay -->
                <div class="absolute inset-0 bg-black/20 opacity-0 group-hover/card:opacity-100 transition-opacity flex items-center justify-center">
                  <Settings2 :size="16" class="text-white drop-shadow-md" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- JSON View -->
      <div v-else-if="viewMode === 'json'" class="h-full flex flex-col pt-0 pb-4 overflow-hidden">
        <div class="flex items-center justify-between py-2 px-2 shrink-0 border-b border-white/[0.03] bg-black/10">
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2">
              <span class="text-[10px] opacity-30">Tokens JSON</span>
              <div class="relative">
                <select 
                  v-model="internalJsonTheme"
                  class="appearance-none bg-black/30 border border-white/10 rounded px-2 py-1 pr-6 text-[10px] text-white/70 hover:border-white/20 focus:border-figma-accent focus:outline-none cursor-pointer transition-colors"
                >
                  <option v-for="t in jsonThemeOptions" :key="t.value" :value="t.value">{{ t.label }}</option>
                </select>
                <ChevronDown :size="10" class="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-40" />
              </div>
            </div>

            <!-- Include Description Checkbox -->
            <label class="flex items-center gap-1 cursor-pointer group">
              <div class="relative flex items-center">
                <input 
                  type="checkbox" 
                  v-model="includeDescription" 
                  class="peer appearance-none w-3 h-3 border border-white/20 rounded-sm bg-black/30 checked:bg-figma-accent checked:border-figma-accent transition-all"
                />
                <Check :size="12" class="absolute left-0 top-0 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" />
              </div>
              <span class="text-[10px] text-white/40 line-height-[1] group-hover:text-white/60 transition-colors">Include Descriptions</span>
            </label>
          </div>
          <div class="flex items-center gap-2">
            <button 
              @click="downloadJson"
              class="text-[10px] flex items-center gap-1.5 px-2 py-1 hover:bg-white/10 rounded transition-colors border border-white/10 text-white/60 active:scale-[0.98]"
            >
              <Download :size="12" /> Download
            </button>
            <button 
              @click="copyValue(jsonContent, 'JSON')"
              class="text-[10px] flex items-center gap-1.5 px-2 py-1 hover:bg-white/10 rounded transition-colors border border-white/10 text-white/60 active:scale-[0.98]"
            >
              <Copy :size="12" /> Copy
            </button>
          </div>
        </div>
        <div 
          class="flex-1 overflow-auto custom-scrollbar"
          @mouseleave="clearJsonHover"
          @mousemove="handleJsonMouseMove"
          @click="handleJsonMouseMove"
        >
          <VueJsonPretty 
            :data="jsonData" 
            :deep="4"
            :showLength="true"
            :showLine="true"
            :showIcon="true"
            :showDoubleQuotes="true"
            :highlightSelectedNode="true"
            :collapsedOnClickBrackets="true"
            :class="'json-theme-' + jsonTheme"
            @node-click="handleJsonNodeClick"
            @node-mouseover="handleJsonNodeMouseover"
          />
        </div>
      </div>
    </template>

    <!-- Detailed Tooltip Component -->
    <InfoTooltip 
      :variable="hoveredVariable"
      :active-mode="activeMode"
      :mouse-pos="mousePos"
      :placement="tooltipPlacement"
    />

  </div>
</template>


<style scoped>
/* Custom Scrollbar */
.custom-scrollbar::-webkit-scrollbar { width: 8px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(128, 128, 128, 0.2); border-radius: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(128, 128, 128, 0.4); }

/* JSON Styling */
:deep(.vjs-tree) {
  font-size: 13px !important;
  font-family: 'Fira Code', 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace !important;
}

:deep(.vjs-tree-node.is-highlight), :deep(.vjs-tree-node:hover) {
  background: rgb(255 255 255 / 5%) !important;
  border: 0;
  border-radius: 0;
}

:deep(.vjs-indent-unit.has-line) {
  border-left-color: rgb(255 255 255 / 10%) !important;
}

:deep(.vjs-comment) {
  color: rgb(255 255 255 / 20%) !important;
}

:deep(.vjs-key) {
  color: var(--vjs-key-color) !important;
  cursor: pointer;
  transition: color 0.15s, background-color 0.15s;
  border-radius: 3px;
  padding: 0 2px;
  margin: 0 -2px;
}

:deep(.vjs-value__string), :deep(.vjs-value-string) { color: var(--vjs-value-string-color) !important; }
:deep(.vjs-value__number), :deep(.vjs-value-number) { color: var(--vjs-value-number-color) !important; }
:deep(.vjs-value__boolean), :deep(.vjs-value-boolean) { color: var(--vjs-value-boolean-color) !important; }

:deep(.vjs-key:hover) {
  background-color: rgba(255, 255, 255, 0.1);
}

/* JSON Theme Colors */
:deep(.json-theme-vscode) { --vjs-key-color: #9cdcfe; --vjs-value-string-color: #ce9178; --vjs-value-number-color: #b5cea8; --vjs-value-boolean-color: #569cd6; }
:deep(.json-theme-monokai) { --vjs-key-color: #f92672; --vjs-value-string-color: #e6db74; --vjs-value-number-color: #ae81ff; --vjs-value-boolean-color: #66d9ef; }
:deep(.json-theme-dracula) { --vjs-key-color: #ff79c6; --vjs-value-string-color: #f1fa8c; --vjs-value-number-color: #bd93f9; --vjs-value-boolean-color: #8be9fd; }
:deep(.json-theme-github) { --vjs-key-color: #79c0ff; --vjs-value-string-color: #a5d6ff; --vjs-value-number-color: #d2a8ff; --vjs-value-boolean-color: #ff7b72; }
:deep(.json-theme-one-dark) { --vjs-key-color: #e06c75; --vjs-value-string-color: #98c379; --vjs-value-number-color: #d19a66; --vjs-value-boolean-color: #61afef; }
:deep(.json-theme-nord) { --vjs-key-color: #81a1c1; --vjs-value-string-color: #a3be8c; --vjs-value-number-color: #b48ead; --vjs-value-boolean-color: #88c0d0; }
:deep(.json-theme-tokyo-night) { --vjs-key-color: #7aa2f7; --vjs-value-string-color: #9ece6a; --vjs-value-number-color: #bb9af7; --vjs-value-boolean-color: #7dcfff; }
:deep(.json-theme-catppuccin) { --vjs-key-color: #cba6f7; --vjs-value-string-color: #a6e3a1; --vjs-value-number-color: #fab387; --vjs-value-boolean-color: #89dceb; }

select option {
  background-color: #2C2C2C;
  color: rgba(255, 255, 255, 0.9);
}
</style>
