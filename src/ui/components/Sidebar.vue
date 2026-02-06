<script setup lang="ts">
import { computed } from 'vue';
import { 
  PanelLeftClose, 
  ChevronDown, 
  ChevronRight 
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
  'handle-hover'
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
              <div class="text-[10px] opacity-20 font-mono">{{ group.children.length }}</div>
            </div>
          </div>

          <!-- Children -->
          <div v-if="!collapsedSidebarFolders.has(group.name)" class="ml-4">
            <template v-for="(child, cIdx) in group.children" :key="cIdx">
              <div 
                @click="selectCollection(child.originalIndex)"
                @mouseenter="handleSidebarHover(child.originalIndex, $event)"
                @mouseleave="handleSidebarHover(null)"
                class="flex items-center h-8 cursor-pointer transition-all group/item relative mr-2 rounded-md"
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
                  class="text-[11px] truncate flex-1 pl-3 select-none"
                  @click.stop="() => {
                    selectCollection(child.originalIndex);
                    if (child.modes?.length > 1) {
                      toggleSidebarFolder('child_' + child.originalIndex);
                    }
                  }"
                >{{ child.displayName }}</div>
              </div>

              <!-- Modes Tree for folder children -->
              <div v-if="!collapsedSidebarFolders.has('child_' + child.originalIndex) && child.modes?.length > 1" class="ml-4 relative">
                <div 
                  v-for="(mode, mIdx) in child.modes" 
                  :key="mode.modeId"
                  @click.stop="selectMode(child.originalIndex, mode.modeId)"
                  class="flex items-center h-8 cursor-pointer transition-all relative mr-2 ml-4 rounded-md"
                  :class="[
                    activeIndex === child.originalIndex && activeMode === mode.modeId ? 'bg-white/[0.08] text-white font-medium' : 'text-white/40 hover:bg-white/5'
                  ]"
                >
                  <div class="absolute -left-3 h-full flex flex-col items-center">
                    <div class="w-[1px] bg-white/5" :class="mIdx === child.modes.length - 1 ? 'h-1/2' : 'h-full'"></div>
                    <div class="absolute top-1/2 left-0 w-2 h-[1px] bg-white/5"></div>
                  </div>
                  <div class="text-[11px] truncate flex-1 pl-3">{{ mode.name }}</div>
                </div>
              </div>
            </template>
          </div>
        </template>

        <!-- Flat Item (Collection Header) -->
        <div v-else class="mb-1">
          <div 
            @click="selectCollection(group.originalIndex)"
            class="flex items-center gap-2 px-3 h-9 cursor-pointer transition-all group/flat relative rounded-md mx-1"
            :class="[
              activeIndex === group.originalIndex ? 'text-white' : 'text-white/50 hover:bg-white/5'
            ]"
          >
            <div class="flex-1 flex items-center justify-between min-w-0">
              <div 
                class="text-[12px] truncate select-none"
                @click.stop="() => {
                  selectCollection(group.originalIndex);
                  if (collections[group.originalIndex]?.modes?.length > 1) {
                    toggleSidebarFolder('flat_' + group.originalIndex);
                  }
                }"
              >{{ group.displayName }}</div>
              <div class="text-[10px] opacity-20 font-mono">{{ collections[group.originalIndex]?.modes?.length || 0 }}</div>
            </div>
          </div>

          <!-- Modes Tree for flat items -->
          <div v-if="!collapsedSidebarFolders.has('flat_' + group.originalIndex) && collections[group.originalIndex]?.modes?.length > 1" class="ml-3 relative">
            <div 
              v-for="(mode, mIdx) in collections[group.originalIndex].modes" 
              :key="mode.modeId"
              @click.stop="selectMode(group.originalIndex, mode.modeId)"
              class="flex items-center h-7 cursor-pointer transition-all relative mr-2 ml-4 rounded-md"
              :class="[
                activeIndex === group.originalIndex && activeMode === mode.modeId ? 'bg-white/[0.08] text-white font-medium' : 'text-white/40 hover:bg-white/5'
              ]"
            >
              <div class="absolute -left-3 h-full flex flex-col items-center">
                <div class="w-[1px] bg-white/5" :class="mIdx === collections[group.originalIndex].modes.length - 1 ? 'h-1/2' : 'h-full'"></div>
                <div class="absolute top-1/2 left-0 w-2 h-[1px] bg-white/5"></div>
              </div>
              <div class="text-[11px] truncate flex-1 pl-2">{{ mode.name }}</div>
            </div>
          </div>
        </div>
      </template>
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
