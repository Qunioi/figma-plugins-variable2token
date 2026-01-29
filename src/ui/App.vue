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

// --- Color Conversion Utilities ---
function hexToRgba(hex: string) {
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

function rgbaToHsva({ r, g, b, a }: { r: number, g: number, b: number, a: number }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0, s = max === 0 ? 0 : d / max, v = max;

  if (max !== min) {
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, v: v * 100, a };
}

function hsvaToRgba({ h, s, v, a }: { h: number, s: number, v: number, a: number }) {
  h /= 360; s /= 100; v /= 100;
  let r = 0, g = 0, b = 0;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255), a };
}

function rgbaToHex({ r, g, b, a }: { r: number, g: number, b: number, a: number }) {
  const f = (x: number) => Math.round(x).toString(16).padStart(2, '0').toUpperCase();
  if (a === 1) return `#${f(r)}${f(g)}${f(b)}`;
  return `#${f(r)}${f(g)}${f(b)}${f(a * 255)}`;
}

function rgbaToHex8({ r, g, b, a }: { r: number, g: number, b: number, a: number }) {
  const f = (x: number) => Math.round(x).toString(16).padStart(2, '0').toUpperCase();
  return `#${f(r)}${f(g)}${f(b)}${f(a * 255)}`;
}

function rgbaToHsla({ r, g, b, a }: { r: number, g: number, b: number, a: number }) {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case rn: h = (gn - bn) / d + (gn < bn ? 6 : 0); break;
      case gn: h = (bn - rn) / d + 2; break;
      case bn: h = (rn - gn) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100), a };
}

function hslaToRgba({ h, s, l, a }: { h: number, s: number, l: number, a: number }) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;

  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else if (300 <= h && h < 360) { r = c; g = 0; b = x; }

  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255), a };
}

// --- Custom Color Picker Internal State ---
const pickerVisible = ref(false);
const pickerPos = ref({ top: 0, left: 0 });
const pickerTarget = ref<{id: string, name: string, type: string, initialName: string, initialValue: string} | null>(null);
const pickerHsv = ref({ h: 0, s: 0, v: 0, a: 1 });
const pickerColorMode = ref<'RGBA' | 'HSLA' | 'HEX8'>('RGBA');
const pickerInputName = ref('');
const pickerShowAliasList = ref(false);
const pickerAliasQuery = ref('');

const allVariables = computed(() => {
  const vars: any[] = [];
  collections.value.forEach(col => {
    col.variables.forEach((v: any) => {
      if (v.type === 'COLOR') vars.push(v);
    });
  });
  return vars;
});

const filteredAliasVariables = computed(() => {
  const q = pickerAliasQuery.value.toLowerCase();
  return allVariables.value.filter(v => v.name.toLowerCase().includes(q));
});

const openPicker = (e: MouseEvent, v: any) => {
  const currentVal = (v.values.find((m: any) => m.modeId === activeMode.value)?.value || v.values[0]?.value || '#000000').toUpperCase();
  pickerTarget.value = { 
    id: v.id, 
    name: v.name.split('/').pop() || '', 
    type: v.type,
    initialName: v.name.split('/').pop() || '',
    initialValue: currentVal
  };
  pickerInputName.value = pickerTarget.value.name;
  
  const rgba = hexToRgba(currentVal);
  pickerHsv.value = rgbaToHsva(rgba);
  
  // Position calculation
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const pickerHeight = 440; // 包裝盒預估高度
  const pickerWidth = 280;
  
  let top = rect.bottom + 8;
  let left = rect.left;

  // 如果下方空間不夠，就往上彈
  if (top + pickerHeight > window.innerHeight) {
    top = Math.max(10, rect.top - pickerHeight - 8);
  }

  // 確保左右不超出
  if (left + pickerWidth > window.innerWidth) {
    left = window.innerWidth - pickerWidth - 10;
  }
  left = Math.max(10, left);
  
  pickerPos.value = { top, left };
  pickerVisible.value = true;
};

const updateFromPicker = () => {
  if (!pickerTarget.value) return;
  const rgba = hsvaToRgba(pickerHsv.value);
  const hex = rgbaToHex(rgba);
  // 使用靜默模式更新，拖拽中不顯示通知
  updateVariable(pickerTarget.value.id, hex, pickerTarget.value.type, undefined, undefined, true);
};

const resetPickerName = () => {
  if (pickerTarget.value) {
    pickerInputName.value = pickerTarget.value.initialName;
    handleRename(true); // 使用靜默模式
  }
};

const resetPickerColor = () => {
  if (pickerTarget.value) {
    const rgba = hexToRgba(pickerTarget.value.initialValue);
    pickerHsv.value = rgbaToHsva(rgba);
    updateFromPicker();
  }
};

const handleRename = (silent = false) => {
  if (pickerTarget.value && pickerInputName.value !== pickerTarget.value.name) {
    parent.postMessage({ 
      pluginMessage: { 
        type: 'rename-variable', 
        variableId: pickerTarget.value.id, 
        newName: pickerInputName.value 
      } 
    }, '*');
    pickerTarget.value.name = pickerInputName.value;
    
    if (!silent) {
      toastMessage.value = `Renamed ${pickerInputName.value}`;
      showToast.value = true;
    }
  }
};

const setVariableAlias = (targetId: string) => {
  if (pickerTarget.value && activeMode.value) {
    parent.postMessage({ 
      pluginMessage: { 
        type: 'set-variable-alias', 
        variableId: pickerTarget.value.id, 
        modeId: activeMode.value, 
        targetVariableId: targetId 
      } 
    }, '*');
    pickerShowAliasList.value = false;
    // Alias 更新後直接關閉通知可能較好，但這裡我們先保留邏輯
  }
};

const cycleColorMode = () => {
  const modes: ('RGBA' | 'HSLA' | 'HEX8')[] = ['RGBA', 'HSLA', 'HEX8'];
  const idx = modes.indexOf(pickerColorMode.value);
  pickerColorMode.value = modes[(idx + 1) % modes.length];
};

const closePicker = () => {
  if (pickerTarget.value) {
    const currentHex8 = rgbaToHex8(hsvaToRgba(pickerHsv.value)).toUpperCase();
    const initialHex8 = rgbaToHex8(hexToRgba(pickerTarget.value.initialValue)).toUpperCase();
    
    const nameChanged = pickerInputName.value !== pickerTarget.value.initialName;
    const colorChanged = currentHex8 !== initialHex8;
    
    if (nameChanged || colorChanged) {
       // 只有在真正有修改時才顯示通知並紀錄歷史
       lastChange.value = { 
         variableId: pickerTarget.value.id, 
         modeId: activeMode.value!, 
         oldValue: colorChanged ? pickerTarget.value.initialValue : undefined,
         varType: pickerTarget.value.type, 
         label: pickerTarget.value.name 
       };
       toastMessage.value = `Updated ${pickerTarget.value.name}`;
       showToast.value = true;
    }
  }
  pickerVisible.value = false;
};

// Handle dragging logic for SV Canvas
const handleSVMouse = (e: MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const update = (moveEvent: MouseEvent | { clientX: number, clientY: number }) => {
    let x = (moveEvent.clientX - rect.left) / rect.width;
    let y = (moveEvent.clientY - rect.top) / rect.height;
    pickerHsv.value.s = Math.max(0, Math.min(100, x * 100));
    pickerHsv.value.v = Math.max(0, Math.min(100, (1 - y) * 100));
    updateFromPicker();
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

// Handle Hue Slider
const handleHueMouse = (e: MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const update = (moveEvent: MouseEvent | { clientX: number }) => {
    let x = (moveEvent.clientX - rect.left) / rect.width;
    pickerHsv.value.h = Math.max(0, Math.min(360, x * 360));
    updateFromPicker();
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

// Handle Alpha Slider
const handleAlphaMouse = (e: MouseEvent) => {
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const update = (moveEvent: MouseEvent | { clientX: number }) => {
    let x = (moveEvent.clientX - rect.left) / rect.width;
    pickerHsv.value.a = Math.max(0, Math.min(1, x));
    updateFromPicker();
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

const pickerRgba = computed(() => hsvaToRgba(pickerHsv.value));
const pickerHsla = computed(() => {
  const rgba = hsvaToRgba(pickerHsv.value);
  return rgbaToHsla(rgba);
});

const handleRgbaInput = (key: string, val: any) => {
  const rgba = { ...pickerRgba.value, [key]: parseFloat(val) || 0 };
  pickerHsv.value = rgbaToHsva(rgba);
  updateFromPicker();
};

const handleHslaInput = (key: string, val: any) => {
  const hsla = { ...pickerHsla.value, [key]: parseFloat(val) || 0 };
  const rgba = hslaToRgba(hsla);
  pickerHsv.value = rgbaToHsva(rgba);
  updateFromPicker();
};

const pickerHex = computed({
  get: () => {
    if (pickerColorMode.value === 'HEX8') {
      return rgbaToHex8(pickerRgba.value);
    }
    return rgbaToHex(pickerRgba.value);
  },
  set: (val) => {
    if (/^#[0-9A-F]{3,8}$/i.test(val)) {
      const rgba = hexToRgba(val);
      pickerHsv.value = rgbaToHsva(rgba);
      updateFromPicker();
    }
  }
});

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

// 歷史紀錄練習
const lastChange = ref<{ variableId: string; modeId: string; oldValue: any; varType: string; label: string } | null>(null);

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

const documentColors = computed(() => {
  if (!activeCollection.value) return [];
  const colors = new Set<string>();
  activeCollection.value.variables.forEach((v: any) => {
    if (v.type === 'COLOR') {
      v.values.forEach((m: any) => {
        if (m.value && (m.value.startsWith('#') || m.value.startsWith('rgba'))) {
          colors.add(m.value);
        }
      });
    }
  });
  return Array.from(colors).slice(0, 12); // 取前 12 個作為預設色板
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
    lastChange.value = null; // 複製動作不觸發 Undo
    showToast.value = true;
    setTimeout(() => { if (toastMessage.value.includes('copied')) showToast.value = false; }, 2000);
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

const updateVariable = (vId: string, newValue: any, vType: string, oldValue?: any, label?: string, silent = false) => {
  if (!activeMode.value) return;

  // 紀錄歷史以便復原 (非靜默模式下才跳通知)
  if (!silent && oldValue !== undefined && label) {
    lastChange.value = { variableId: vId, modeId: activeMode.value, oldValue, varType: vType, label };
    toastMessage.value = `Updated ${label}`;
    showToast.value = true;
  }

  parent.postMessage({ 
    pluginMessage: { 
      type: 'update-variable', 
      variableId: vId, 
      modeId: activeMode.value, 
      newValue, 
      varType: vType 
    } 
  }, '*');
};

const undoLastChange = () => {
  if (!lastChange.value) return;
  const { variableId, oldValue, varType } = lastChange.value;
  updateVariable(variableId, oldValue, varType);
  
  toastMessage.value = "Restored previous color";
  lastChange.value = null;
  setTimeout(() => { showToast.value = false; }, 2000);
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
                    <div v-if="v.type === 'COLOR'" class="relative">
                      <div 
                        class="w-5 h-5 rounded-md border border-figma-border shadow-sm cursor-pointer transition-transform hover:scale-110 overflow-hidden"
                        :style="{ backgroundColor: v.values.find((m:any) => m.modeId === activeMode)?.value || v.values[0]?.value }"
                        @click="openPicker($event, v)"
                      >
                      </div>
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
      class="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-[3000] flex items-center justify-center opacity-30 hover:opacity-100 transition-opacity"
    >
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M7 1V7H1" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>

    <!-- Toast -->
    <transition name="toast">
      <div 
        v-if="showToast" 
        class="fixed bottom-12 left-1/2 -translate-x-1/2 bg-[#2C2C2C] border border-[#3C3C3C] text-white px-4 py-2.5 rounded-lg shadow-2xl z-[4000] flex items-center gap-3 min-w-[200px] justify-between"
      >
        <div class="flex items-center gap-2">
          <Check :size="14" class="text-green-400" />
          <span class="text-[12px] font-medium">{{ toastMessage }}</span>
        </div>
        <button 
          v-if="lastChange" 
          @click="undoLastChange"
          class="text-[11px] font-bold text-figma-accent hover:underline px-2 py-1 -mr-2"
        >
          UNDO
        </button>
      </div>
    </transition>

    <!-- Custom FIGMA Color Picker -->
    <template v-if="pickerVisible">
      <!-- Click Outside Overlay -->
      <div 
        class="fixed inset-0 z-[1999] bg-transparent cursor-default"
        @click="closePicker"
      ></div>

      <div 
        class="fixed z-[2000] w-[280px] bg-[#2C2C2C] border border-[#444] rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden text-white pointer-events-auto"
        :style="{ top: pickerPos.top + 'px', left: pickerPos.left + 'px' }"
      >
        <!-- Title -->
        <div class="px-4 py-3 border-b border-white/5 flex items-center justify-between">
          <span class="text-[12px] font-bold truncate pr-4">{{ pickerTarget?.name }}</span>
          <button @click="closePicker" class="opacity-40 hover:opacity-100 transition-opacity"><ChevronDown :size="14" /></button>
        </div>

        <!-- Content -->
        <div class="p-4 space-y-4 relative">
          <!-- Name Field -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-medium text-white/50">名稱</label>
              <button 
                v-if="pickerInputName !== pickerTarget?.initialName"
                @click="resetPickerName"
                class="text-[10px] text-figma-accent hover:underline flex items-center gap-1"
              >
                <RefreshCcw :size="10" /> Reset
              </button>
            </div>
            <input 
              v-model="pickerInputName" 
              @blur="handleRename(false)"
              @keyup.enter="handleRename(false)"
              class="w-full bg-white/5 border border-white/10 rounded px-2.5 py-1.5 text-[12px] outline-none focus:border-figma-accent"
            />
          </div>

          <!-- Color Field -->
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <label class="text-[11px] font-medium text-white/50">Color</label>
              <button 
                v-if="pickerTarget && rgbaToHex8(pickerRgba).toUpperCase() !== rgbaToHex8(hexToRgba(pickerTarget.initialValue)).toUpperCase()"
                @click="resetPickerColor"
                class="text-[10px] text-figma-accent hover:underline flex items-center gap-1"
              >
                <RefreshCcw :size="10" /> Reset
              </button>
            </div>
            
            <div class="relative">
              <div 
                @click="pickerShowAliasList = !pickerShowAliasList"
                class="flex items-center gap-2 bg-white/5 border border-white/10 rounded px-2 py-1.5 cursor-pointer hover:border-white/20 transition-colors"
                :class="{ 'border-figma-accent ring-1 ring-figma-accent': pickerShowAliasList }"
              >
                <div class="w-4 h-4 rounded-sm border border-white/10 shrink-0" :style="{ backgroundColor: pickerHex }"></div>
                <input 
                  v-model="pickerHex"
                  @click.stop
                  class="flex-1 bg-transparent text-[12px] outline-none font-mono min-w-0"
                />
                <ChevronDown :size="12" class="opacity-30 shrink-0" />
              </div>

              <!-- Alias Variable List -->
              <div 
                v-if="pickerShowAliasList" 
                class="absolute top-full left-0 w-full mt-1 bg-[#2C2C2C] border border-[#444] rounded shadow-xl z-20 max-h-48 flex flex-col overflow-hidden"
                @click.stop
              >
                <div class="p-1 border-b border-white/10">
                  <input 
                    v-model="pickerAliasQuery"
                    placeholder="Search color variables..."
                    class="w-full bg-black/20 border border-white/10 rounded px-2 py-1 text-[11px] outline-none focus:border-figma-accent"
                    autoFocus
                  />
                </div>
                <div class="overflow-y-auto custom-scrollbar">
                  <div 
                    v-for="v in filteredAliasVariables" 
                    :key="v.id"
                    @click="setVariableAlias(v.id)"
                    class="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 cursor-pointer text-[11px]"
                  >
                    <div class="w-3 h-3 rounded-sm border border-white/10" :style="{ backgroundColor: v.values[0]?.value }"></div>
                    <span class="flex-1 truncate opacity-70">{{ v.name }}</span>
                    <span class="text-[9px] opacity-30 font-mono">{{ v.values[0]?.value }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- SV Canvas -->
          <div 
            class="relative w-full h-32 rounded-md overflow-hidden cursor-crosshair"
            :style="{ backgroundColor: `hsl(${pickerHsv.h}, 100%, 50%)` }"
            @mousedown="handleSVMouse"
          >
            <div class="absolute inset-0 bg-gradient-to-r from-white to-transparent"></div>
            <div class="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
            
            <!-- Handle -->
            <div 
              class="absolute w-4 h-4 border-2 border-white rounded-full shadow-[0_0_4px_rgba(0,0,0,0.5)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
              :style="{ left: pickerHsv.s + '%', top: (100 - pickerHsv.v) + '%' }"
            ></div>
          </div>

          <!-- Hue Slider -->
          <div 
            class="relative h-3 rounded-full cursor-pointer rainbow-gradient"
            @mousedown="handleHueMouse"
          >
            <div 
              class="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-[#2C2C2C] rounded-full shadow-md -translate-x-1/2"
              :style="{ left: (pickerHsv.h / 360 * 100) + '%' }"
            ></div>
          </div>

          <!-- Alpha Slider -->
          <div 
            class="relative h-3 rounded-full cursor-pointer checkerboard overflow-hidden"
            @mousedown="handleAlphaMouse"
          >
            <div 
              class="absolute inset-0"
              :style="{ background: `linear-gradient(to right, transparent, rgba(${pickerRgba.r},${pickerRgba.g},${pickerRgba.b},1))` }"
            ></div>
            <div 
              class="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-[#2C2C2C] rounded-full shadow-md -translate-x-1/2"
              :style="{ left: (pickerHsv.a * 100) + '%' }"
            ></div>
          </div>

          <!-- Color Mode Inputs -->
          <div class="flex gap-1.5 items-stretch h-[28px]">
            <div v-if="pickerColorMode === 'RGBA'" class="flex flex-1 gap-1">
              <div v-for="key in ['r','g','b','a']" :key="key" class="flex-1">
                <input 
                  :value="pickerRgba[key as keyof typeof pickerRgba]"
                  @input="(e: any) => handleRgbaInput(key, e.target.value)"
                  class="w-full h-full bg-white/5 border border-white/10 rounded px-1 text-[11px] text-center outline-none focus:border-figma-accent"
                />
              </div>
            </div>
            <div v-else-if="pickerColorMode === 'HSLA'" class="flex flex-1 gap-1">
              <div v-for="key in ['h','s','l','a']" :key="key" class="flex-1">
                <input 
                  :value="pickerHsla[key as keyof typeof pickerHsla]"
                  @input="(e: any) => handleHslaInput(key, e.target.value)"
                  class="w-full h-full bg-white/5 border border-white/10 rounded px-1 text-[11px] text-center outline-none focus:border-figma-accent"
                />
              </div>
            </div>
            <div v-else class="flex flex-1">
              <input 
                v-model="pickerHex"
                class="w-full h-full bg-white/5 border border-white/10 rounded px-2 text-[11px] text-center outline-none focus:border-figma-accent font-mono uppercase"
              />
            </div>
            <button 
              @click="cycleColorMode"
              class="px-2 bg-white/5 border border-white/10 rounded text-[9px] text-white/50 hover:text-white hover:bg-white/10 transition-all font-bold shrink-0 min-w-[50px] uppercase flex items-center justify-center h-full"
            >
              {{ pickerColorMode }}
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style>
.toast-enter-active, .toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 10px); }

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

/* Color Picker Styles */
.rainbow-gradient {
  background: linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%);
}

.checkerboard {
  background-image: linear-gradient(45deg, #444 25%, transparent 25%), linear-gradient(-45deg, #444 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #444 75%), linear-gradient(-45deg, transparent 75%, #444 75%);
  background-size: 8px 8px;
  background-position: 0 0, 0 4px, 4px 4px, 4px 0;
  background-color: #2C2C2C;
}

html.figma-light .checkerboard {
  background-image: linear-gradient(45deg, #eee 25%, transparent 25%), linear-gradient(-45deg, #eee 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #eee 75%), linear-gradient(-45deg, transparent 75%, #eee 75%);
  background-color: #fff;
}
</style>
