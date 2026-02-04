<script setup lang="ts">
import { ref } from 'vue';
import { 
  Search, 
  Layers, 
  Palette, 
  Hash, 
  Type, 
  ToggleLeft, 
  ChevronDown, 
  Check, 
  FoldVertical, 
  UnfoldVertical, 
  LayoutList, 
  LayoutGrid, 
  Code, 
  RefreshCcw,
  PanelLeftOpen
} from 'lucide-vue-next';
import { TypeFilterOption } from '../../types';

interface Props {
  searchQuery: string;
  searchTypeFilter: string;
  typeFilterOptions: TypeFilterOption[];
  viewMode: 'list' | 'grid' | 'json';
  anyGroupsExpanded: boolean;
  isSidebarCollapsed: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits([
  'update:searchQuery',
  'update:searchTypeFilter',
  'update:viewMode',
  'update:isSidebarCollapsed',
  'refresh',
  'toggle-smart-groups'
]);

const isTypeFilterOpen = ref(false);

const setTypeFilter = (val: string) => {
  emit('update:searchTypeFilter', val);
  isTypeFilterOpen.value = false;
};

const setViewMode = (val: 'list' | 'grid' | 'json') => {
  emit('update:viewMode', val);
};

const setIsSidebarCollapsed = (val: boolean) => {
  emit('update:isSidebarCollapsed', val);
};

</script>

<template>
  <header class="h-11 border-b border-figma-border flex items-center px-3 gap-3 bg-figma-bg z-10 shrink-0">
    <!-- Sidebar toggle button (show when collapsed) -->
    <button 
      v-if="isSidebarCollapsed"
      @click="setIsSidebarCollapsed(false)" 
      class="p-1.5 hover:bg-white/10 rounded transition-colors text-white/40 hover:text-white"
    >
      <PanelLeftOpen :size="14" />
    </button>
    
    <div class="flex-1 flex items-center gap-1">
      <div class="relative flex-1 min-w-[160px] max-w-[220px]">
        <Search :size="13" class="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40" />
        <input 
          :value="searchQuery"
          @input="$emit('update:searchQuery', ($event.target as HTMLInputElement).value)"
          type="text" 
          placeholder="Search variables..."
          class="w-full bg-white/5 border border-figma-border rounded-md pl-8 pr-3 py-1 text-[12px] text-white/70 focus:text-white focus:outline-none focus:border-figma-accent transition-all placeholder:text-white/20"
        />
      </div>
      
      <!-- Type Filter Dropdown -->
      <div class="relative">
        <button 
          @click="isTypeFilterOpen = !isTypeFilterOpen"
          class="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-figma-border rounded-md text-[11px] hover:bg-white/10 transition-colors w-[102px]"
          :class="searchTypeFilter !== 'ALL' ? 'text-figma-accent border-figma-accent/50' : 'text-white/60'"
        >
          <Layers v-if="searchTypeFilter === 'ALL'" :size="14" />
          <Palette v-else-if="searchTypeFilter === 'Color'" :size="14" />
          <Hash v-else-if="searchTypeFilter === 'Number'" :size="14" />
          <Type v-else-if="searchTypeFilter === 'String'" :size="14" />
          <ToggleLeft v-else-if="searchTypeFilter === 'Boolean'" :size="14" />
          <span class="flex-1 text-left">{{ typeFilterOptions.find(t => t.value === searchTypeFilter)?.label }}</span>
          <ChevronDown :size="10" />
        </button>
        
        <!-- Click outside overlay -->
        <div 
          v-if="isTypeFilterOpen" 
          class="fixed inset-0 z-40"
          @click="isTypeFilterOpen = false"
        ></div>
        
        <!-- Dropdown Menu -->
        <div 
          v-if="isTypeFilterOpen" 
          class="absolute top-full left-0 mt-1 py-1 w-[130px] bg-[#2C2C2C] border border-[#3C3C3C] rounded-lg shadow-xl z-50 overflow-hidden"
        >
          <div 
            v-for="opt in typeFilterOptions" 
            :key="opt.value"
            @click="setTypeFilter(opt.value)"
            class="flex items-center gap-2.5 px-3 py-1 text-[11px] hover:bg-figma-accent hover:text-white cursor-pointer transition-colors"
            :class="searchTypeFilter === opt.value ? 'text-figma-accent font-medium' : 'text-white/70'"
          >
            <Layers v-if="opt.value === 'ALL'" :size="14" />
            <Palette v-else-if="opt.value === 'Color'" :size="14" />
            <Hash v-else-if="opt.value === 'Number'" :size="14" />
            <Type v-else-if="opt.value === 'String'" :size="14" />
            <ToggleLeft v-else-if="opt.value === 'Boolean'" :size="14" />
            <span class="flex-1">{{ opt.label }}</span>
            <Check v-if="searchTypeFilter === opt.value" :size="12" />
          </div>
        </div>
      </div>
    </div>

    <!-- Spacer to push buttons to the right -->
    <div class="flex-1"></div>

    <div class="flex items-center gap-0.5 pl-2">
      <button 
        @click="$emit('toggle-smart-groups')" 
        :title="anyGroupsExpanded ? 'Collapse All' : 'Expand All'" 
        class="p-1.5 hover:bg-white/10 rounded transition-colors text-white/40 hover:text-white" 
      >
        <FoldVertical v-if="anyGroupsExpanded" :size="15" />
        <UnfoldVertical v-else :size="15" />
      </button>
      
      <!-- Segmented Control for View Mode -->
      <div class="flex bg-black/40 p-0.5 rounded-lg border border-white/5 shrink-0">
        <button 
          @click="setViewMode('list')"
          :title="'List View'"
          :class="viewMode === 'list' ? 'bg-[#333] text-white shadow-md' : 'text-white/20 hover:text-white/40'"
          class="p-1.5 rounded-md transition-all duration-200"
        >
          <LayoutList :size="14" />
        </button>
        <button 
          @click="setViewMode('grid')"
          :title="'Grid View'"
          :class="viewMode === 'grid' ? 'bg-[#333] text-white shadow-md' : 'text-white/20 hover:text-white/40'"
          class="p-1.5 rounded-md transition-all duration-200"
        >
          <LayoutGrid :size="14" />
        </button>
        <button 
          @click="setViewMode('json')"
          :title="'JSON View'"
          :class="viewMode === 'json' ? 'bg-[#333] text-white shadow-md' : 'text-white/20 hover:text-white/40'"
          class="p-1.5 rounded-md transition-all duration-200"
        >
          <Code :size="14" />
        </button>
      </div>
      
      <button 
        @click="$emit('refresh')" 
        title="Refresh" 
        class="p-1.5 hover:bg-white/10 rounded transition-colors text-white/40 hover:text-white"
      >
        <RefreshCcw :size="14" />
      </button>
    </div>
  </header>
</template>
