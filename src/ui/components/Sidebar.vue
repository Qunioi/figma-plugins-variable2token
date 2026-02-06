<script setup lang="ts">
import { computed } from 'vue';
import { 
  PanelLeftClose, 
  ChevronDown, 
  ChevronRight,
  Plus
} from 'lucide-vue-next';

interface Props {
  isSidebarCollapsed: boolean;
  sidebarWidth: number;
  collections: any[];
  activeIndex: number;
  activeMode: string | null;
  collapsedSidebarFolders: Set<string>;
  hoveredIndex: number | null;
  hoveredRect: { top: number; height: number } | null;
}

const props = defineProps<Props>();
const emit = defineEmits([
  'update:isSidebarCollapsed',
  'update:sidebarWidth',
  'select-collection',
  'select-mode',
  'toggle-folder',
  'handle-resize',
  'handle-hover',
  'create-collection',
  'create-mode',
  'context-menu'
]);

const structuredCollections = computed(() => {
  const result: any[] = [];
  const groups: Record<string, any> = {};

  props.collections.forEach((col, index) => {
    const parts = col.collectionName.split('/');
    if (parts.length > 1) {
      const folderName = parts[0];
      const displayName = parts.slice(1).join('/');
      if (!groups[folderName]) {
        groups[folderName] = { 
          type: 'folder', 
          name: folderName, 
          children: [] 
        };
        result.push(groups[folderName]);
      }
      groups[folderName].children.push({ 
        ...col, 
        displayName, 
        originalIndex: index 
      });
    } else {
      result.push({ 
        type: 'item', 
        ...col, 
        displayName: col.collectionName, 
        originalIndex: index 
      });
    }
  });

  return result;
});

const toggleSidebarFolder = (name: string) => {
  emit('toggle-folder', name);
};

const selectCollection = (index: number) => {
  emit('select-collection', index);
};

const selectMode = (collectionIndex: number, modeId: string) => {
  emit('select-mode', collectionIndex, modeId);
};

const handleSidebarResize = (e: MouseEvent) => {
  emit('handle-resize', e);
};

const handleSidebarHover = (i: number | null, e?: MouseEvent) => {
  emit('handle-hover', i, e);
};

const setSidebarCollapsed = (val: boolean) => {
  emit('update:isSidebarCollapsed', val);
};

const getDisplayModes = (col: any) => {
  if (!col) return [];
  const isEmptyDefault = (col.variables?.length || 0) === 0 && (col.modes?.length || 0) === 1 && col.modes[0].name === 'Mode 1';
  return isEmptyDefault ? [] : (col.modes || []);
};

</script>

<template>
  <aside 
    v-if="!isSidebarCollapsed"
    class="flex flex-col border-r border-figma-border bg-black/5 relative group/sidebar"
    :style="{ width: sidebarWidth + 'px' }"
  >
    <div class="flex items-center justify-between h-11 px-3 border-b border-figma-border">
      <span class="text-[11px] text-figma-accent/60">Collections</span>
      <button @click="setSidebarCollapsed(true)" class="p-1 hover:bg-white/10 rounded transition-colors text-white/40 hover:text-white active:scale-[0.98]">
        <PanelLeftClose :size="14" />
      </button>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar">
      <template v-for="(group, gIdx) in structuredCollections" :key="gIdx">
        <!-- Folder Entry -->
        <template v-if="group.type === 'folder'">
          <div 
            @click="toggleSidebarFolder(group.name)"
            class="flex items-center px-3 h-9 cursor-pointer hover:bg-white/5 transition-colors group/folder"
          >
            <div class="flex-1 flex items-center justify-between min-w-0 pr-1">
              <div class="flex items-center gap-1.5 min-w-0">
                <ChevronDown v-if="!collapsedSidebarFolders.has(group.name)" :size="12" class="text-white/20 group-hover/folder:text-white/40" />
                <ChevronRight v-else :size="12" class="text-white/20 group-hover/folder:text-white/40" />
                <div class="text-[12px] truncate font-medium text-white/90">{{ group.name }}</div>
              </div>
              <div class="text-[10px] text-white/40 font-mono">{{ group.children.length }}</div>
            </div>
          </div>

          <!-- Children -->
          <div v-if="!collapsedSidebarFolders.has(group.name)" class="ml-4">
            <template v-for="(child, cIdx) in group.children" :key="cIdx">
              <div 
                @click="toggleSidebarFolder('child_' + child.originalIndex)"
                @mouseenter="handleSidebarHover(child.originalIndex, $event)"
                @mouseleave="handleSidebarHover(null)"
                class="flex items-center h-8 transition-all group/item relative mr-2 ml-2 rounded-md cursor-pointer"
                :class="[
                  activeIndex === child.originalIndex ? 'bg-white/[0.08] text-white font-bold' : 'text-white/50 hover:bg-white/5'
                ]"
              >
                <!-- Tree lines logic -->
                <div class="absolute -left-3 h-full flex flex-col items-center">
                  <div class="w-[1px] bg-white/10" :class="cIdx === group.children.length - 1 ? 'h-1/2' : 'h-full'"></div>
                  <div class="absolute top-1/2 left-0 w-3 h-[1px] bg-white/10"></div>
                </div>
                
                <div
                  v-if="getDisplayModes(child).length >= 1"
                  class="ml-1 h-5 w-5 flex items-center justify-center rounded text-white/40"
                >
                  <ChevronDown v-if="!collapsedSidebarFolders.has('child_' + child.originalIndex)" :size="12" />
                  <ChevronRight v-else :size="12" />
                </div>
                <div 
                  class="text-[11px] truncate flex-1 pl-2 select-none cursor-pointer"
                  @contextmenu.prevent.stop="emit('context-menu', $event, 'collection', { collectionName: child.collectionName })"
                >{{ child.displayName }}</div>
              </div>

              <!-- Modes Tree for folder children -->
              <div v-if="!collapsedSidebarFolders.has('child_' + child.originalIndex) && getDisplayModes(child).length >= 1" class="ml-4 relative">
                <div 
                  v-for="(mode, mIdx) in getDisplayModes(child)" 
                  :key="mode.modeId"
                  @click.stop="selectMode(child.originalIndex, mode.modeId)"
                  class="flex items-center h-8 cursor-pointer transition-all relative mr-2 ml-4 rounded-md"
                  :class="[
                    activeIndex === child.originalIndex && activeMode === mode.modeId ? 'bg-white/[0.08] text-white font-medium' : 'text-white/40 hover:bg-white/5'
                  ]"
                >
                  <div class="absolute -left-3 w-[1px] h-full">
                    <div class="w-full bg-white/5" :class="mIdx === getDisplayModes(child).length - 1 ? 'h-1/2' : 'h-full'"></div>
                    <div class="absolute top-1/2 left-0 w-3 h-[1px] bg-white/5"></div>
                  </div>
                  <div 
                    class="text-[11px] truncate flex-1 pl-3 font-normal"
                    @click.stop="selectMode(child.originalIndex, mode.modeId)"
                    @contextmenu.prevent.stop="emit('context-menu', $event, 'mode', { collectionName: child.collectionName, mode, varCount: child.variables?.length || 0 })"
                  >{{ mode.name }}</div>
                </div>
              </div>
            </template>
          </div>
        </template>

        <!-- Flat Item (Collection Header) -->
        <div v-else class="mb-1">
          <div 
            @click="toggleSidebarFolder('flat_' + group.originalIndex)"
            class="flex items-center gap-2 pl-2 h-6 mt-2 transition-all group/flat relative rounded-md mx-1"
            :class="[
              activeIndex === group.originalIndex ? 'text-white' : 'text-white/50 hover:bg-white/5'
            ]"
          >
            <div class="flex-1 flex items-center justify-between min-w-0">
              <div 
                class="text-[12px] truncate select-none cursor-pointer"
                @contextmenu.prevent.stop="emit('context-menu', $event, 'collection', { collectionName: group.collectionName, varCount: collections[group.originalIndex]?.variables?.length || 0 })"
              >{{ group.displayName }}</div>
              <div class="flex items-center gap-1">
                <div
                  v-if="getDisplayModes(collections[group.originalIndex]).length > 0"
                  class="text-[10px] text-white/40 font-mono"
                >{{ getDisplayModes(collections[group.originalIndex]).length }}</div>
                <div
                  v-if="getDisplayModes(collections[group.originalIndex]).length >= 1"
                  class="h-5 w-5 flex items-center justify-center text-white/40"
                >
                  <ChevronDown v-if="!collapsedSidebarFolders.has('flat_' + group.originalIndex)" :size="12" />
                  <ChevronRight v-else :size="12" />
                </div>
              </div>
            </div>
          </div>

          <!-- Modes Tree for flat items -->
          <div v-if="!collapsedSidebarFolders.has('flat_' + group.originalIndex) && getDisplayModes(collections[group.originalIndex]).length >= 1" class="ml-3 relative">
            <div 
              v-for="(mode, mIdx) in getDisplayModes(collections[group.originalIndex])" 
              :key="mode.modeId"
              @click.stop="selectMode(group.originalIndex, mode.modeId)"
              class="flex items-center h-8 cursor-pointer transition-all relative mr-2 ml-4 rounded-md"
              :class="[
                activeIndex === group.originalIndex && activeMode === mode.modeId ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:bg-white/5'
              ]"
            >
              <div class="absolute -left-3 w-[1px] h-full">
                <div class="w-full bg-white/5" :class="mIdx === getDisplayModes(collections[group.originalIndex]).length - 1 ? 'h-1/2' : 'h-full'"></div>
                <div class="absolute top-1/2 h-[1px] bg-white/5" :class="mIdx === getDisplayModes(collections[group.originalIndex]).length - 1 ? 'left-0 w-[12px]' : 'left-[1px] w-[11px]'"></div>
              </div>
              <div 
                class="text-[11px] truncate flex-1 pl-2 font-normal"
                @click.stop="selectMode(group.originalIndex, mode.modeId)"
                @contextmenu.prevent.stop="emit('context-menu', $event, 'mode', { collectionName: collections[group.originalIndex].collectionName, mode, varCount: collections[group.originalIndex]?.variables?.length || 0 })"
              >{{ mode.name }}</div>
            </div>
          </div>
        </div>
      </template>
      
      <!-- New Set Button inside list -->
      <div class="px-1 pb-4">
        <div 
          @click="emit('create-collection')"
          class="flex items-center h-8 border border-transparent cursor-pointer transition-all rounded-md text-white/20 hover:text-white/60 hover:border-white/5 group/newset mx-1"
        >
          <div class="flex items-center gap-1 pl-1">
            <Plus :size="10" />
            <div class="text-[11px]">New Collection</div>
          </div>
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
      @mousedown="handleSidebarResize"
      class="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-figma-accent/30 transition-colors z-20"
    ></div>
  </aside>
</template>
