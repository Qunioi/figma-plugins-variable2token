<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { 
  RefreshCcw, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Copy, 
  Check,
  Package,
  Library,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronsUpDown,
  ChevronsDownUp,
  Settings,
  Braces,
  List,
  Download
} from 'lucide-vue-next';

// --- State ---
const collections = ref<any[]>([]);
const activeIndex = ref(0);
const activeMode = ref<string | null>(null);
const searchQuery = ref('');
const isSidebarCollapsed = ref(false);
const sidebarWidth = ref(180);
const collapsedGroups = ref<Set<string>>(new Set());
const toastMessage = ref('');
const showToast = ref(false);
const viewMode = ref<'list' | 'json'>('list');
const hoveredIndex = ref<number | null>(null);
const hoveredRect = ref<{ top: number; height: number } | null>(null);

// --- Computed ---
const activeCollection = computed(() => collections.value[activeIndex.value] || null);

const filteredVariables = computed(() => {
  if (!activeCollection.value) return [];
  const vars = activeCollection.value.variables || [];
  if (!searchQuery.value) return vars;
  const q = searchQuery.value.toLowerCase();
  return vars.filter((v: any) => v.name.toLowerCase().includes(q));
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

const jsonContent = computed(() => {
  if (!activeCollection.value) return '';
  const result: Record<string, any> = {};
  
  activeCollection.value.variables.forEach((v: any) => {
    const parts = v.name.split('/');
    let current = result;
    
    parts.forEach((part: string, index: number) => {
      if (index === parts.length - 1) {
        const val = v.values.find((m: any) => m.modeId === activeMode.value)?.value || v.values[0]?.value;
        current[part] = {
          value: val,
          type: v.type.toLowerCase()
        };
      } else {
        if (!current[part]) current[part] = {};
        current = current[part];
      }
    });
  });
  
  return JSON.stringify(result, null, 2);
});

const currentModeName = computed(() => {
  if (!activeCollection.value || !activeMode.value) return 'tokens';
  const mode = activeCollection.value.modes.find((m: any) => m.modeId === activeMode.value);
  return mode ? mode.name : 'tokens';
});

// --- Methods ---
const selectCollection = (index: number) => {
  activeIndex.value = index;
  if (activeCollection.value?.modes?.length > 0) {
    activeMode.value = activeCollection.value.modes[0].modeId;
  } else {
    activeMode.value = null;
  }
};

const refresh = () => {
  parent.postMessage({ pluginMessage: { type: 'request-refresh' } }, '*');
};

const copyValue = (text: string, label: string) => {
  if (!text || text === 'N/A') return;
  
  const handleSuccess = () => {
    toastMessage.value = `${label} copied!`;
    showToast.value = true;
    setTimeout(() => { showToast.value = false; }, 2000);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(handleSuccess).catch(() => {
      fallbackCopy(text, handleSuccess);
    });
  } else {
    fallbackCopy(text, handleSuccess);
  }
};

const fallbackCopy = (text: string, onSuccess: () => void) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  document.body.appendChild(textArea);
  textArea.select();
  try {
    document.execCommand('copy');
    onSuccess();
  } catch (err) {
    console.error('Fallback copy failed', err);
  }
  document.body.removeChild(textArea);
};

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
  
  toastMessage.value = `Downloaded ${currentModeName.value}.json`;
  showToast.value = true;
  setTimeout(() => { showToast.value = false; }, 2000);
};

const toggleGroup = (groupName: string) => {
  if (collapsedGroups.value.has(groupName)) {
    collapsedGroups.value.delete(groupName);
  } else {
    collapsedGroups.value.add(groupName);
  }
};

const toggleSmartGroups = () => {
  if (anyGroupsExpanded.value) {
    Object.keys(groupedVariables.value).forEach(g => collapsedGroups.value.add(g));
  } else {
    collapsedGroups.value.clear();
  }
};

const anyGroupsExpanded = computed(() => {
  const groupNames = Object.keys(groupedVariables.value);
  if (groupNames.length === 0) return false;
  return groupNames.some(g => !collapsedGroups.value.has(g));
});

const handleWindowResize = (e: MouseEvent) => {
  const startX = e.clientX;
  const startY = e.clientY;
  const startW = window.innerWidth;
  const startH = window.innerHeight;

  const onMove = (ev: MouseEvent) => {
    const width = startW + (ev.clientX - startX);
    const height = startH + (ev.clientY - startY);
    parent.postMessage({ pluginMessage: { type: 'resize-ui', width, height } }, '*');
  };

  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
};

const handleSidebarResize = (e: MouseEvent) => {
  const startX = e.clientX;
  const startW = sidebarWidth.value;

  const onMove = (ev: MouseEvent) => {
    const w = startW + (ev.clientX - startX);
    sidebarWidth.value = Math.max(120, Math.min(300, w));
  };

  const onUp = () => {
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  };

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
};

const handleSidebarHover = (i: number | null, e?: MouseEvent) => {
  if (!isSidebarCollapsed.value) {
    hoveredIndex.value = null;
    return;
  }
  hoveredIndex.value = i;
  if (i !== null && e) {
    const target = (e.currentTarget as HTMLElement);
    const rect = target.getBoundingClientRect();
    hoveredRect.value = { top: rect.top, height: rect.height };
  }
};

// --- Lifecycle ---
onMounted(() => {
  refresh();
  window.onmessage = (event) => {
    const msg = event.data.pluginMessage;
    if (msg.type === 'render-list') {
      collections.value = msg.data || [];
      if (activeIndex.value >= collections.value.length) {
        activeIndex.value = 0;
      }
      if (activeCollection.value?.modes?.length > 0 && !activeMode.value) {
        activeMode.value = activeCollection.value.modes[0].modeId;
      }
    }
  };

  // Detect Figma Theme (assuming injected into <html>)
  const isDark = document.documentElement.classList.contains('figma-dark');
  // You can also use matchMedia as fallback or for system theme
});

watch(activeCollection, (newCol) => {
  if (newCol?.modes?.length > 0 && (!activeMode.value || !newCol.modes.find((m:any) => m.modeId === activeMode.value))) {
    activeMode.value = newCol.modes[0].modeId;
  }
});

</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden bg-figma-bg text-figma-text select-none">
    <div class="flex flex-1 overflow-hidden">
      <!-- Sidebar -->
      <aside 
        class="flex flex-col border-r border-figma-border bg-black/5"
        :style="{ width: isSidebarCollapsed ? '48px' : sidebarWidth + 'px' }"
      >
        <div class="flex items-center justify-between h-11 px-3 border-b border-figma-border">
          <span v-if="!isSidebarCollapsed" class="text-[11px] font-semibold text-figma-text/60 tracking-wider">Collections</span>
          <button @click="isSidebarCollapsed = !isSidebarCollapsed" class="p-1 hover:bg-white/10 rounded transition-colors">
            <PanelLeftClose v-if="!isSidebarCollapsed" :size="14" />
            <PanelLeftOpen v-else :size="14" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto pt-2">
          <div 
            v-for="(col, i) in collections" 
            :key="i"
            @click="selectCollection(i)"
            @mouseenter="handleSidebarHover(i, $event)"
            @mouseleave="handleSidebarHover(null)"
            class="flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group relative"
            :class="[
              activeIndex === i ? 'bg-figma-accent/20 text-figma-accent border-l-2 border-figma-accent' : 'hover:bg-white/5 border-l-2 border-transparent'
            ]"
          >
            <Library v-if="col.status === 'not-imported'" :size="14" class="opacity-40" />
            <Package v-else :size="14" class="opacity-70" />
            
            <div v-if="!isSidebarCollapsed" class="flex-1 min-w-0">
              <div class="text-[12px] truncate font-medium">{{ col.collectionName.split('/').pop() }}</div>
              <div class="text-[10px] opacity-50">{{ col.variables.length }} vars</div>
            </div>
          </div>
        </div>

        <!-- Tooltip simulation (Moved outside overflow container) -->
        <div 
          v-if="isSidebarCollapsed && hoveredIndex !== null && collections[hoveredIndex]" 
          class="fixed left-12 px-3 py-1.5 bg-[#2C2C2C] border border-[#3C3C3C] text-white rounded-md flex flex-col gap-0 z-[999] whitespace-nowrap shadow-[0_4px_12px_rgba(0,0,0,0.5)] pointer-events-none"
          :style="{ top: (hoveredRect?.top || 0) + (hoveredRect?.height || 0) / 2 + 'px', transform: 'translateY(-50%)' }"
        >
          <div class="text-[11px] font-medium leading-tight text-white">{{ collections[hoveredIndex].collectionName.split('/').pop() }}</div>
          <div class="text-[9px] text-white/40 leading-tight">{{ collections[hoveredIndex].variables.length }} vars</div>
        </div>

        <!-- Sidebar Resizer -->
        <div 
          v-if="!isSidebarCollapsed"
          @mousedown="handleSidebarResize"
          class="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-figma-accent/30 transition-colors"
        ></div>
      </aside>

      <!-- Main Panel -->
      <main class="flex-1 flex flex-col min-w-0">
        <!-- Toolbar -->
        <header class="h-11 border-b border-figma-border flex items-center px-3 gap-3 bg-figma-bg z-10">
          <div class="flex-1 flex items-center gap-2 max-w-sm">
            <div class="relative flex-1">
              <Search :size="13" class="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40" />
              <input 
                v-model="searchQuery"
                type="text" 
                placeholder="Search variables..."
                class="w-full bg-white/5 border border-figma-border rounded-md pl-8 pr-3 py-1 text-[12px] focus:outline-none focus:border-figma-accent transition-all"
              />
            </div>
          </div>

          <div v-if="activeCollection?.modes?.length > 0" class="flex items-center gap-1.5 ml-1">
            <select 
              v-model="activeMode"
              class="bg-white/5 border border-figma-border rounded-md px-2 py-1 text-[11px] focus:outline-none appearance-none cursor-pointer hover:border-figma-accent min-w-[100px]"
            >
              <option v-for="mode in activeCollection.modes" :key="mode.modeId" :value="mode.modeId">
                {{ mode.name }}
              </option>
            </select>
          </div>

          <!-- Spacer to push buttons to the right -->
          <div class="flex-1"></div>

          <div class="flex items-center gap-0.5 pl-2">
            <button 
              @click="toggleSmartGroups" 
              :title="anyGroupsExpanded ? 'Collapse All' : 'Expand All'" 
              class="p-1.5 hover:bg-white/10 rounded transition-colors" 
            >
              <ChevronsDownUp v-if="anyGroupsExpanded" :size="16" />
              <ChevronsUpDown v-else :size="16" />
            </button>
            <button 
              @click="viewMode = viewMode === 'list' ? 'json' : 'list'" 
              :title="viewMode === 'list' ? 'Switch to JSON view' : 'Switch to List view'"
              class="p-1.5 hover:bg-white/10 rounded transition-colors mr-1"
            >
              <Braces v-if="viewMode === 'list'" :size="15" />
              <List v-else :size="15" />
            </button>
            <button @click="refresh" title="Refresh" class="p-1.5 hover:bg-white/10 rounded transition-colors">
              <RefreshCcw :size="14" />
            </button>
          </div>
        </header>

        <!-- Variable List -->
        <div class="flex-1 overflow-y-auto p-2 space-y-4 pt-4 custom-scrollbar">
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
            <div v-if="viewMode === 'list'" class="space-y-4">
              <div v-for="(vars, groupName) in groupedVariables" :key="groupName" class="rounded-lg overflow-hidden">
                <div 
                  @click="toggleGroup(groupName)"
                  class="flex items-center gap-2 px-3 py-1.5 bg-white/5 cursor-pointer hover:bg-white/10 transition-colors"
                >
                  <ChevronDown v-if="!collapsedGroups.has(groupName)" :size="14" class="opacity-40" />
                  <ChevronRight v-else :size="14" class="opacity-40" />
                  <span class="text-[11px] font-semibold text-figma-text/70 uppercase tracking-tight flex-1">{{ groupName }}</span>
                  <span class="text-[10px] bg-white/10 px-1.5 py-0.5 rounded opacity-50">{{ vars.length }}</span>
                </div>

                <div v-show="!collapsedGroups.has(groupName)" class="bg-black/10">
                  <div 
                    v-for="v in vars" 
                    :key="v.name"
                    class="flex items-center gap-3 px-4 py-2.5 group hover:bg-[#3E3E42] transition-colors"
                  >
                    <!-- Icon / Color Swatch -->
                    <div v-if="v.type === 'COLOR'" class="relative group/swatch">
                      <div 
                        class="w-5 h-5 rounded-md border border-figma-border shadow-sm cursor-pointer transition-transform hover:scale-110"
                        :style="{ backgroundColor: v.values.find((m:any) => m.modeId === activeMode)?.value || v.values[0]?.value }"
                        @click="copyValue(v.values.find((m:any) => m.modeId === activeMode)?.value || v.values[0]?.value, 'Color')"
                      ></div>
                    </div>
                    <div v-else class="w-5 h-5 flex items-center justify-center rounded-md bg-white/5 border border-figma-border text-[9px] font-bold opacity-60">
                      {{ v.type === 'BOOLEAN' ? 'B' : v.type === 'FLOAT' ? '#' : 'T' }}
                    </div>

                    <!-- Name -->
                    <div class="flex-1 min-w-0" @click="copyValue(v.name.split('/').pop() || '', 'Name')">
                      <div class="text-[12px] truncate font-medium cursor-pointer hover:text-figma-accent transition-colors">
                        {{ v.name.split('/').pop() }}
                      </div>
                    </div>

                    <!-- Value -->
                    <div 
                      class="font-mono text-[10px] px-2 py-1 bg-black/20 rounded border border-white/5 opacity-60 hover:opacity-100 hover:bg-figma-accent hover:text-white transition-all cursor-pointer truncate max-w-[140px]"
                      @click="copyValue(v.values.find((m:any) => m.modeId === activeMode)?.value || v.values[0]?.value, 'Value')"
                      :title="v.values.find((m:any) => m.modeId === activeMode)?.value"
                    >
                      {{ v.values.find((m:any) => m.modeId === activeMode)?.value || 'N/A' }}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- JSON View -->
            <div v-else class="h-full flex flex-col pt-0 pb-4">
              <div class="flex items-center justify-between mb-2 px-1">
                <span class="text-[10px] uppercase font-bold tracking-widest opacity-30">Tokens JSON</span>
                <div class="flex items-center gap-2">
                  <button 
                    @click="downloadJson"
                    class="text-[10px] flex items-center gap-1.5 px-2 py-1 hover:bg-white/10 rounded transition-colors border border-white/10"
                  >
                    <Download :size="12" /> Download JSON
                  </button>
                  <button 
                    @click="copyValue(jsonContent, 'JSON')"
                    class="text-[10px] flex items-center gap-1.5 px-2 py-1 hover:bg-white/10 rounded transition-colors border border-white/10"
                  >
                    <Copy :size="12" /> Copy JSON
                  </button>
                </div>
              </div>
              <pre class="flex-1 bg-black/30 p-4 rounded-lg border border-white/5 text-[11px] font-mono overflow-auto selection:bg-figma-accent/30 custom-scrollbar">{{ jsonContent }}</pre>
            </div>
          </template>
        </div>
      </main>
    </div>

    <!-- Footer -->
    <footer class="h-8 border-t border-figma-border flex items-center justify-between px-3 text-[10px] opacity-40 bg-figma-bg select-none">
      <div class="flex items-center gap-2">
        <span>V2T v1.0.0</span>
        <span class="w-1 h-1 rounded-full bg-green-500"></span>
      </div>
      <div class="flex items-center gap-3">
        <span>Ready</span>
      </div>
    </footer>

    <!-- Resize Handle -->
    <div 
      @mousedown="handleWindowResize"
      class="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-50 flex items-center justify-center opacity-30 hover:opacity-100 transition-opacity"
    >
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M7 1V7H1" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>

    <!-- Toast -->
    <Transition name="fade">
      <div v-if="showToast" class="fixed bottom-12 left-1/2 -translate-x-1/2 px-4 py-2 bg-figma-accent text-white rounded-full text-[12px] font-medium shadow-2xl flex items-center gap-2 z-[100]">
        <Check :size="14" />
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>

<style>
.fade-enter-active, .fade-leave-active { transition: all 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translate(-50%, 10px); }

.custom-scrollbar::-webkit-scrollbar { width: 8px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(128, 128, 128, 0.2); border-radius: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(128, 128, 128, 0.4); }

select option {
  background-color: #2C2C2C;
  color: #CCC;
}

html.figma-light select option {
  background-color: #FFF;
  color: #333;
}
</style>
