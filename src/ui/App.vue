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
  Code,
  List,
  Download,
  FoldVertical,
  UnfoldVertical,
  Pipette,
  X,
  LayoutGrid,
  LayoutList,
  Plus,
  Settings2,
  Link
} from 'lucide-vue-next';

// --- Demo Data Imports ---
const demoFiles = import.meta.glob('../demo/**/*.tokens.json', { eager: true });

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
const pickerTarget = ref<{
  id: string, 
  name: string, 
  type: string, 
  initialName: string, 
  initialValue: string,
  initialDescription: string,
  alias?: { id: string, name: string }
} | null>(null);
const pickerHsv = ref({ h: 0, s: 0, v: 0, a: 1 });
const pickerColorMode = ref<'RGB' | 'Hex' | 'CSS'>('RGB');
const pickerTab = ref<'Custom' | 'Libraries'>('Custom');
const pickerInputName = ref('');
const pickerInputValue = ref('');
const pickerDescription = ref('');
const pickerShowAliasList = ref(false);
const pickerShowAdvanced = ref(false);
const pickerAliasQuery = ref('');
const isLibraryGrid = ref(false);
const isVariableInfoExpanded = ref(false);
const librarySearchQuery = ref('');
const libraryFilter = ref('All libraries');
const isColorModeDropdownOpen = ref(false);
const collapsedLibraryGroups = ref<Set<string>>(new Set());
const selectedVariableId = ref<string | null>(null);

const toggleLibraryGroup = (name: string) => {
  if (collapsedLibraryGroups.value.has(name)) {
    collapsedLibraryGroups.value.delete(name);
  } else {
    collapsedLibraryGroups.value.add(name);
  }
};

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
  pickerVisible.value = true;
  selectedVariableId.value = v.id;
  
  const modeVal = v.values.find((m: any) => m.modeId === activeMode.value) || v.values[0];
  const isAlias = !!modeVal?.alias;
  
  let currentVal = modeVal?.value;
  let aliasInfo = modeVal?.alias || undefined;

  // 只有 COLOR 類型才需要處理 hex 格式
  if (v.type === 'COLOR') {
    if (isAlias && aliasInfo) {
      currentVal = modeVal.value;
    } else {
      currentVal = (modeVal?.value || '#000000').toUpperCase();
    }
  } else {
    // STRING / FLOAT 類型保持原始值
    currentVal = modeVal?.value ?? '';
  }

  pickerTarget.value = { 
    id: v.id, 
    name: v.name.split('/').pop() || '', 
    type: v.type,
    initialName: v.name.split('/').pop() || '',
    initialValue: v.type === 'COLOR' ? currentVal : String(currentVal),
    initialDescription: v.description || "",
    alias: aliasInfo
  };
  pickerInputName.value = pickerTarget.value.name;
  pickerInputValue.value = String(currentVal);
  pickerDescription.value = pickerTarget.value.initialDescription;
  pickerShowAdvanced.value = false;
  
  // 根據是否為 Alias 決定開啟哪個 Tab
  if (isAlias) {
    pickerTab.value = 'Libraries';
  } else {
    pickerTab.value = 'Custom';
  }
  
  // 如果是 alias，我們依然顯示它當前的解析色值方便調整
  const rgba = hexToRgba(currentVal);
  pickerHsv.value = rgbaToHsva(rgba);
  
  // Position calculation
  // 找到父層的列表項目元素，而不是只用點擊的小圖標
  const clickedElement = e.currentTarget as HTMLElement;
  const rowElement = clickedElement.closest('.flex.items-center.gap-3') as HTMLElement || clickedElement;
  const rect = rowElement.getBoundingClientRect();
  
  const pickerWidth = 260; // 與 CSS w-[260px] 一致
  // 根據變數類型決定 picker 高度
  const pickerHeight = v.type === 'COLOR' ? 400 : 180;
  
  let top = rect.bottom + 4; // 縮減往下的間距
  let left = rect.left;

  // 如果下方空間不夠，就往上彈（直接貼緊元素上方）
  if (top + pickerHeight > window.innerHeight) {
    top = Math.max(10, rect.top - pickerHeight);
  }

  // 確保左右不超出
  if (left + pickerWidth > window.innerWidth) {
    left = window.innerWidth - pickerWidth - 10;
  }
  left = Math.max(10, left);
  
  pickerPos.value = { top, left };
  pickerVisible.value = true;
  isColorModeDropdownOpen.value = false;
};

const updateFromPicker = () => {
  if (!pickerTarget.value) return;
  const rgba = hsvaToRgba(pickerHsv.value);
  const hex = rgbaToHex(rgba);
  // 使用靜默模式更新，拖拽中不顯示通知
  updateVariable(pickerTarget.value.id, hex, pickerTarget.value.type, undefined, undefined, true);
};

const handleValueInput = (val: string) => {
  if (!pickerTarget.value) return;
  const type = pickerTarget.value.type;
  let finalValue: any = val;
  if (type === 'FLOAT') {
    finalValue = parseFloat(val);
    if (isNaN(finalValue)) return;
  }
  updateVariable(pickerTarget.value.id, finalValue, type, undefined, undefined, true);
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
  if (!pickerTarget.value || !pickerInputName.value) return;
  
  // 如果有名稱重複，不進行後續的存檔動作
  if (isDuplicateName.value) return;
  
  // 使用 initialName 作為 Undo 的參考點（開啟 Picker 時的原始名稱）
  const initialName = pickerTarget.value.initialName;
  const newName = pickerInputName.value;
  const newDescription = pickerDescription.value;
  const isNameChanged = newName !== initialName;
  const isDescChanged = newDescription !== pickerTarget.value.initialDescription;
  
  // Update name if changed from initial
  if (isNameChanged) {
    parent.postMessage({ 
      pluginMessage: { 
        type: 'update-name', 
        variableId: pickerTarget.value.id, 
        newName 
      } 
    }, '*');
    
    // 更新本地資料
    const coll = collections.value.find((c: any) => c.variables.some((v: any) => v.id === pickerTarget.value?.id));
    if (coll) {
      const variable = coll.variables.find((v: any) => v.id === pickerTarget.value?.id);
      if (variable) variable.name = newName;
    }
    pickerTarget.value.name = newName;
  }

  // Update description if changed
  if (isDescChanged) {
    parent.postMessage({
      pluginMessage: {
        type: 'update-description',
        variableId: pickerTarget.value.id,
        description: newDescription
      }
    }, '*');
    
    const coll = collections.value.find((c: any) => c.variables.some((v: any) => v.id === pickerTarget.value?.id));
    if (coll) {
      const variable = coll.variables.find((v: any) => v.id === pickerTarget.value?.id);
      if (variable) variable.description = newDescription;
    }
  }
  
  if (!silent && (isNameChanged || isDescChanged)) {
    lastChange.value = {
      variableId: pickerTarget.value.id,
      modeId: activeMode.value || '',
      oldName: isNameChanged ? initialName : undefined,
      oldDescription: isDescChanged ? pickerTarget.value.initialDescription : undefined,
      varType: pickerTarget.value.type,
      label: newName
    };
    showToastWithTimer(`Updated variable info`);
    
    // 更新 initialName/Description 為新值，這樣下次修改才能追蹤差異
    if (isNameChanged) pickerTarget.value.initialName = newName;
    if (isDescChanged) pickerTarget.value.initialDescription = newDescription;
  }
};

const setVariableAlias = (targetId: string) => {
  if (pickerTarget.value && activeMode.value) {
    // 邏輯上不能點擊自己 (Self-reference)
    if (targetId === pickerTarget.value.id) return;

    parent.postMessage({ 
      pluginMessage: { 
        type: 'set-variable-alias', 
        variableId: pickerTarget.value.id, 
        modeId: activeMode.value, 
        targetVariableId: targetId 
      } 
    }, '*');
    
    // 即時更新 UI
    const targetVar = allVariables.value.find(av => av.id === targetId);
    if (targetVar) {
      pickerTarget.value.alias = { id: targetId, name: targetVar.name.split('/').pop() || targetVar.name };
      const aliasColor = targetVar.values.find((m: any) => m.modeId === activeMode.value)?.value || targetVar.values[0]?.value;
      if (aliasColor) {
        pickerTarget.value.initialValue = aliasColor;
        const rgba = hexToRgba(aliasColor);
        pickerHsv.value = rgbaToHsva(rgba);
      }
    }
    
    pickerShowAliasList.value = false;
  }
};

const detachVariableAlias = () => {
  if (pickerTarget.value && activeMode.value) {
    const currentColor = pickerTarget.value.initialValue;
    // 將連結斷開，並套用當前的色碼
    parent.postMessage({ 
      pluginMessage: { 
        type: 'update-variable', 
        variableId: pickerTarget.value.id, 
        modeId: activeMode.value,
        newValue: currentColor,
        varType: 'COLOR'
      } 
    }, '*');

    pickerTarget.value.alias = undefined;
    if (currentColor) {
      const rgba = hexToRgba(currentColor);
      pickerHsv.value = rgbaToHsva(rgba);
    }
    showToastWithTimer('Variable detached and color preserved');
  }
};

const switchToCustomTab = () => {
  if (pickerTarget.value?.alias) {
    // 連結變數狀態下切換到 Custom，自動繼承顏色並斷開連結
    const currentColor = pickerTarget.value.initialValue;
    if (currentColor) {
      parent.postMessage({
        pluginMessage: {
          type: 'update-variable',
          variableId: pickerTarget.value.id,
          modeId: activeMode.value,
          newValue: currentColor,
          varType: 'COLOR'
        }
      }, '*');

      pickerTarget.value.alias = undefined;
      const rgba = hexToRgba(currentColor);
      pickerHsv.value = rgbaToHsva(rgba);
      showToastWithTimer('Converted alias to custom color');
    }
  }
  pickerTab.value = 'Custom';
};

const getDisplayValue = (v: any) => {
  const modeVal = v.values.find((m: any) => m.modeId === activeMode.value) || v.values[0];
  if (modeVal?.alias) {
    return modeVal.alias.name.split('/').pop() || modeVal.alias.name;
  }
  return modeVal?.value || 'N/A';
};

// 檢查是否有重複的變數名稱
const isDuplicateName = computed(() => {
  if (!pickerTarget.value || !pickerInputName.value) return false;
  const currentName = pickerInputName.value.trim();
  if (!currentName) return false;
  
  // 如果名稱跟原始名稱相同，不算重複
  if (currentName === pickerTarget.value.initialName) return false;
  
  // 檢查所有集合中的變數
  for (const col of collections.value) {
    for (const v of col.variables) {
      // 排除當前正在編輯的變數
      if (v.id === pickerTarget.value.id) continue;
      // 比對名稱 (可能是完整路徑或是結尾名稱)
      const varShortName = v.name.split('/').pop() || v.name;
      if (varShortName === currentName || v.name === currentName) {
        return true;
      }
    }
  }
  return false;
});

const cycleColorMode = (e?: MouseEvent) => {
  if (e) e.stopPropagation();
  isColorModeDropdownOpen.value = !isColorModeDropdownOpen.value;
};

const closePicker = () => {
  // 如果有重複名稱，禁止關閉
  if (isDuplicateName.value) {
    showToastWithTimer('變數名稱已存在，請修改後再關閉', 3000);
    // 自動將焦點移回名稱輸入框
    setTimeout(() => {
      document.getElementById('picker-name-input')?.focus();
    }, 0);
    return;
  }
  
  if (pickerTarget.value) {
    const nameChanged = pickerInputName.value !== pickerTarget.value.initialName;
    const descChanged = pickerDescription.value !== pickerTarget.value.initialDescription;
    
    // 根據變數類型判斷 value 是否有變化
    let valueChanged = false;
    if (pickerTarget.value.type === 'COLOR') {
      const currentHex8 = rgbaToHex8(hsvaToRgba(pickerHsv.value)).toUpperCase();
      const initialHex8 = rgbaToHex8(hexToRgba(pickerTarget.value.initialValue)).toUpperCase();
      valueChanged = currentHex8 !== initialHex8;
    } else {
      // 對於 STRING/FLOAT 類型，比較 pickerInputValue
      valueChanged = pickerInputValue.value !== pickerTarget.value.initialValue;
    }
    
    if (nameChanged || valueChanged || descChanged) {
       // 只有在真正有修改時才顯示通知並紀錄歷史
       lastChange.value = { 
         variableId: pickerTarget.value.id, 
         modeId: activeMode.value!, 
         oldValue: valueChanged ? pickerTarget.value.initialValue : undefined,
         oldName: nameChanged ? pickerTarget.value.initialName : undefined,
         oldDescription: descChanged ? pickerTarget.value.initialDescription : undefined,
         varType: pickerTarget.value.type, 
         label: pickerTarget.value.name 
       };

       // 如果名稱有變動，同步更新
       if (nameChanged) {
         handleRename(true);
       }

       // 如果描述有變動，離開時才同步
       if (descChanged) {
         handleUpdateDescription();
       }

       showToastWithTimer(`Updated ${pickerTarget.value.name}`);
    }
  }
  pickerVisible.value = false;
};

const handleUpdateDescription = () => {
  if (pickerTarget.value) {
    parent.postMessage({ 
      pluginMessage: { 
        type: 'update-description', 
        variableId: pickerTarget.value.id, 
        description: pickerDescription.value 
      } 
    }, '*');
  }
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

const handleAlphaInputRelative = (val: any) => {
  const alpha = parseFloat(val) / 100;
  pickerHsv.value.a = Math.max(0, Math.min(1, isNaN(alpha) ? 1 : alpha));
  updateFromPicker();
};

const pickerHex = computed({
  get: () => {
    if (pickerColorMode.value === 'Hex') {
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
let toastTimer: ReturnType<typeof setTimeout> | null = null;

// 統一管理 Toast 顯示與計時
const showToastWithTimer = (message: string, duration = 3000) => {
  if (toastTimer) clearTimeout(toastTimer);
  toastMessage.value = message;
  showToast.value = true;
  toastTimer = setTimeout(() => {
    showToast.value = false;
    toastTimer = null;
  }, duration);
};

const viewMode = ref<'list' | 'grid' | 'json'>('list');
const hoveredIndex = ref<number | null>(null);
const hoveredRect = ref<{ top: number; height: number } | null>(null);
const hoveredVariable = ref<any | null>(null);
const varHoveredRect = ref<{ top: number; left: number; height: number; width: number } | null>(null);
const hoverTimer = ref<any>(null);
const mousePos = ref({ x: 0, y: 0 });
const collapsedSidebarFolders = ref<Set<string>>(new Set());

// 歷史紀錄練習
const lastChange = ref<{ 
  variableId: string; 
  modeId: string; 
  oldValue?: any; 
  oldName?: string;
  oldDescription?: string;
  varType: string; 
  label: string 
} | null>(null);

// --- Computed ---
const activeCollection = computed(() => collections.value[activeIndex.value] || null);

const structuredCollections = computed(() => {
  const result: any[] = [];
  const groups: Record<string, any> = {};

  collections.value.forEach((col, index) => {
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

const tooltipPlacement = computed(() => {
  if (!mousePos.value.y) return 'top';
  // If the space above is less than 160px (approx tooltip height), show at bottom
  return mousePos.value.y < 160 ? 'bottom' : 'top';
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

const filteredLibraries = computed(() => {
  let result: any[] = [];
  
  // Flatten all variables
  collections.value.forEach(col => {
    if (libraryFilter.value === 'All libraries' || col.collectionName === libraryFilter.value) {
      col.variables.forEach((v: any) => {
        if (v.type === 'COLOR') {
          result.push({
            ...v,
            collectionName: col.collectionName,
            colorValue: v.values.find((m: any) => m.modeId === activeMode.value)?.value || v.values[0]?.value
          });
        }
      });
    }
  });

  if (librarySearchQuery.value) {
    const q = librarySearchQuery.value.toLowerCase();
    result = result.filter(v => 
      v.name.toLowerCase().includes(q) || 
      (v.description && v.description.toLowerCase().includes(q))
    );
  }

  return result;
});

// Group filtered libraries by collection for grid/list view headers if needed
const groupedLibraries = computed(() => {
  const groups: Record<string, any[]> = {};
  filteredLibraries.value.forEach(v => {
    const colName = v.collectionName;
    const parts = v.name.split('/');
    const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : 'General';
    const fullGroupName = `${colName} · ${folder}`;
    if (!groups[fullGroupName]) groups[fullGroupName] = [];
    groups[fullGroupName].push(v);
  });
  return groups;
});

const selectCollection = (index: number) => {
  activeIndex.value = index;
  if (collections.value[index]?.modes?.length > 0) {
    activeMode.value = collections.value[index].modes[0].modeId;
  }
};

const selectMode = (collectionIndex: number, modeId: string) => {
  activeIndex.value = collectionIndex;
  activeMode.value = modeId;
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
    showToastWithTimer(`Updated ${label}`);
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
  const { variableId, oldValue, oldDescription, oldName, varType } = lastChange.value;
  
  if (oldValue !== undefined) {
    updateVariable(variableId, oldValue, varType);
  }

  if (oldName !== undefined) {
    parent.postMessage({ 
      pluginMessage: { 
        type: 'update-name', 
        variableId: variableId, 
        newName: oldName 
      } 
    }, '*');
    
    // 更新本地資料
    const coll = collections.value.find(c => c.variables.some((v: any) => v.id === variableId));
    if (coll) {
      const variable = coll.variables.find((v: any) => v.id === variableId);
      if (variable) variable.name = oldName;
    }
    
    // 如果 Picker 正開啟該變數，同步更新 Picker 內的顯示
    if (pickerTarget.value && pickerTarget.value.id === variableId) {
      pickerTarget.value.name = oldName;
      pickerInputName.value = oldName;
    }
  }
  
  if (oldDescription !== undefined) {
    parent.postMessage({ 
      pluginMessage: { 
        type: 'update-description', 
        variableId: variableId, 
        description: oldDescription 
      } 
    }, '*');

    // 更新本地資料
    const coll = collections.value.find(c => c.variables.some(v => v.id === variableId));
    if (coll) {
      const variable = coll.variables.find(v => v.id === variableId);
      if (variable) variable.description = oldDescription;
    }
  }
  
  showToastWithTimer("Restored previous state");
  lastChange.value = null;
};

const anyGroupsExpanded = computed(() => {
  const groupNames = Object.keys(groupedVariables.value);
  if (groupNames.length === 0) return false;
  return groupNames.some(g => !collapsedGroups.value.has(g));
});

const anyLibraryGroupsExpanded = computed(() => {
  const allGroups = Object.keys(groupedLibraries.value);
  if (allGroups.length === 0) return false;
  return allGroups.some(g => !collapsedLibraryGroups.value.has(g));
});

const toggleLibrarySmartGroups = () => {
  if (anyLibraryGroupsExpanded.value) {
    Object.keys(groupedLibraries.value).forEach(g => collapsedLibraryGroups.value.add(g));
  } else {
    collapsedLibraryGroups.value.clear();
  }
};

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

const handleMouseMove = (e: MouseEvent) => {
  mousePos.value = { x: e.clientX, y: e.clientY };
};

const handleVariableHover = (e: MouseEvent | null, v: any | null) => {
  if (hoverTimer.value) {
    clearTimeout(hoverTimer.value);
    hoverTimer.value = null;
  }

  if (!v) {
    hoveredVariable.value = null;
    varHoveredRect.value = null;
    return;
  }

  if (e) {
    mousePos.value = { x: e.clientX, y: e.clientY };
    const target = (e.currentTarget as HTMLElement);
    const rect = target.getBoundingClientRect();
    varHoveredRect.value = { 
      top: rect.top, 
      left: rect.left, 
      height: rect.height,
      width: rect.width 
    };
  }

  // 提升反應速度至 150ms
  hoverTimer.value = setTimeout(() => {
    hoveredVariable.value = v;
  }, 150);
};

const getHoveredColor = () => {
  if (!hoveredVariable.value) return '';
  // 如果是扁平化的資源庫變數
  if (hoveredVariable.value.colorValue) return hoveredVariable.value.colorValue;
  
  // 如果是主列表變數，根據當前模式尋找值
  const modeVal = hoveredVariable.value.values?.find((m: any) => m.modeId === activeMode.value) || hoveredVariable.value.values?.[0];
  if (!modeVal) return '#000000';
  
  // 如果插件已經解析好了顏色值，直接返回
  return (modeVal.value || '#000000').toUpperCase();
};

const getHoveredAliasName = () => {
  if (!hoveredVariable.value) return null;
  const modeVal = hoveredVariable.value.values?.find((m: any) => m.modeId === activeMode.value) || hoveredVariable.value.values?.[0];
  return modeVal?.alias ? (modeVal.alias.name.split('/').pop() || modeVal.alias.name) : null;
};

const toggleSidebarFolder = (name: string) => {
  if (collapsedSidebarFolders.value.has(name)) {
    collapsedSidebarFolders.value.delete(name);
  } else {
    collapsedSidebarFolders.value.add(name);
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
  
  // --- Development Mock Data ---
  setTimeout(() => {
    if (collections.value.length === 0) {
      console.log('Building mock data from demo files...');
      
      const collectionsMap: Record<string, { collectionName: string, modes: any[], variableMap: Record<string, any> }> = {};

      const processNode = (node: any, path: string = '', modeId: string, variableMap: Record<string, any>) => {
        for (const [key, val] of Object.entries(node)) {
          if (key.startsWith('$')) continue;
          const currentPath = path ? `${path}/${key}` : key;
          
          if (val && typeof val === 'object' && !val.$value) {
            processNode(val, currentPath, modeId, variableMap);
          } else if (val && (val as any).$value !== undefined) {
            if (!variableMap[currentPath]) {
              variableMap[currentPath] = {
                id: (val as any).$extensions?.['com.figma.variableId'] || currentPath,
                name: currentPath,
                type: (val as any).$type?.toUpperCase() || 'STRING',
                values: []
              };
            }
            variableMap[currentPath].values.push({
              modeId: modeId,
              value: (val as any).$value
            });
          }
        }
      };

      // Parse glob results
      for (const [path, data] of Object.entries(demoFiles)) {
        // Path format: ../demo/CollectionName/ModeName.tokens.json
        const parts = path.split('/');
        const collectionName = parts[parts.length - 2];
        const modeName = parts[parts.length - 1].replace('.tokens.json', '');
        const modeId = `m_${collectionName}_${modeName}`;

        if (!collectionsMap[collectionName]) {
          collectionsMap[collectionName] = {
            collectionName: collectionName,
            modes: [],
            variableMap: {}
          };
        }

        collectionsMap[collectionName].modes.push({ modeId, name: modeName });
        processNode((data as any).default || data, '', modeId, collectionsMap[collectionName].variableMap);
      }

      collections.value = Object.values(collectionsMap).map(c => ({
        collectionName: c.collectionName,
        modes: c.modes,
        variables: Object.values(c.variableMap)
      }));
      
      // Auto-expand the first mock collection in dev mode
      if (collections.value.length > 0) {
        collapsedSidebarFolders.value.delete('flat_0'); 
        selectMode(0, collections.value[0].modes[0].modeId);
      }
    }
  }, 500);

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
        v-if="!isSidebarCollapsed"
        class="flex flex-col border-r border-figma-border bg-black/5"
        :style="{ width: sidebarWidth + 'px' }"
      >
        <div class="flex items-center justify-between h-11 px-3 border-b border-figma-border">
          <span class="text-[11px] text-figma-text/60">Collections</span>
          <button @click="isSidebarCollapsed = true" class="p-1 hover:bg-white/10 rounded transition-colors">
            <PanelLeftClose :size="14" />
          </button>
        </div>

        <div class="flex-1 overflow-y-auto">
          <template v-for="(group, gIdx) in structuredCollections" :key="gIdx">
            <!-- Folder Entry -->
            <template v-if="group.type === 'folder'">
              <div 
                @click="toggleSidebarFolder(group.name)"
                class="flex items-center px-3 h-9 cursor-pointer hover:bg-white/5 transition-colors group"
              >
                <div v-if="!isSidebarCollapsed" class="flex-1 flex items-center justify-between min-w-0 pr-1">
                  <div class="text-[12px] truncate font-medium text-white/90">{{ group.name }}</div>
                  <div class="text-[10px] opacity-30">{{ group.children.length }} items</div>
                </div>
              </div>

              <!-- Children -->
              <div v-if="!collapsedSidebarFolders.has(group.name) && !isSidebarCollapsed" class="ml-4">
                <div 
                  v-for="(child, cIdx) in group.children" 
                  :key="cIdx"
                  @click="selectCollection(child.originalIndex)"
                  @mouseenter="handleSidebarHover(child.originalIndex, $event)"
                  @mouseleave="handleSidebarHover(null)"
                  class="flex items-center h-8 cursor-pointer transition-all group relative mr-2 rounded-md"
                  :class="[
                    activeIndex === child.originalIndex ? 'bg-white/[0.08] text-white font-bold' : 'text-white/50 hover:bg-white/5'
                  ]"
                >
                  <!-- Tree lines logic -->
                  <div class="absolute -left-3 h-full flex flex-col items-center">
                    <!-- Vertical line: only top half if it's the last item -->
                    <div class="w-[1px] bg-white/20" :class="cIdx === group.children.length - 1 ? 'h-1/2' : 'h-full'"></div>
                    <!-- Horizontal dot/line -->
                    <div class="absolute top-1/2 left-0 w-3 h-[1px] bg-white/20"></div>
                  </div>
                  
                  <div class="text-[11px] truncate flex-1 pl-3">{{ child.displayName }}</div>

                  <!-- Modes Tree for folder children -->
                  <div v-if="!collapsedSidebarFolders.has('child_' + child.originalIndex) && collections[child.originalIndex]?.modes?.length >= 1" class="ml-4 relative">
                    <div 
                      v-for="(mode, mIdx) in collections[child.originalIndex].modes" 
                      :key="mode.modeId"
                      @click.stop="selectMode(child.originalIndex, mode.modeId)"
                      class="flex items-center h-8 cursor-pointer transition-all relative mr-2 ml-4 rounded-md"
                      :class="[
                        activeIndex === child.originalIndex && activeMode === mode.modeId ? 'bg-white/[0.08] text-white' : 'text-white/50 hover:bg-white/5'
                      ]"
                    >
                      <!-- Tree lines -->
                      <div class="absolute -left-3 h-full flex flex-col items-center">
                        <!-- Vertical line: only top half if it's the last item -->
                        <div class="w-[1px] bg-[#444]" :class="mIdx === collections[child.originalIndex].modes.length - 1 ? 'h-1/2' : 'h-full'"></div>
                        <!-- Horizontal dot/line -->
                        <div class="absolute top-1/2 left-0 w-3 h-[1px] bg-[#444]"></div>
                      </div>
                      
                      <div class="text-[11px] truncate flex-1 pl-3">{{ mode.name }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- Flat Item (Collection Header) -->
            <div 
              v-else
              @click="toggleSidebarFolder('flat_' + group.originalIndex)"
              class="flex items-center gap-2 px-3 py-2 cursor-pointer transition-all group relative rounded-md hover:bg-white/5"
            >
              <div v-if="!isSidebarCollapsed" class="flex-1 flex items-center justify-between min-w-0">
                <div class="text-[12px] truncate text-white/80">{{ group.displayName }}</div>
                <div class="text-[10px] text-[#666]">{{ collections[group.originalIndex]?.modes?.length || 0 }} items</div>
              </div>
            </div>

            <!-- Modes Tree for flat items -->
            <div v-if="!collapsedSidebarFolders.has('flat_' + group.originalIndex) && collections[group.originalIndex]?.modes?.length >= 1" class="ml-3 relative">
              <div 
                v-for="(mode, mIdx) in collections[group.originalIndex].modes" 
                :key="mode.modeId"
                @click.stop="selectMode(group.originalIndex, mode.modeId)"
                class="flex items-center h-7 cursor-pointer transition-all relative mr-2 ml-4 rounded-md"
                :class="[
                  activeIndex === group.originalIndex && activeMode === mode.modeId ? 'bg-white/[0.08] text-white' : 'text-white/50 hover:bg-white/5'
                ]"
              >
                <!-- Tree lines -->
                <div class="absolute -left-3 h-full flex flex-col items-center">
                  <!-- Vertical line: only top half if it's the last item -->
                  <div class="w-[1px] bg-[#444]" :class="mIdx === collections[group.originalIndex].modes.length - 1 ? 'h-1/2' : 'h-full'"></div>
                  <!-- Horizontal dot/line -->
                  <div class="absolute top-1/2 left-0 w-3 h-[1px] bg-[#444]"></div>
                </div>
                
                <div class="text-[11px] truncate flex-1 pl-2">{{ mode.name }}</div>
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
          v-if="!isSidebarCollapsed"
          @mousedown="handleSidebarResize"
          class="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-figma-accent/30 transition-colors"
        ></div>
      </aside>

      <!-- Main Panel -->
      <main class="flex-1 flex flex-col min-w-0">
        <!-- Toolbar -->
        <header class="h-11 border-b border-figma-border flex items-center px-3 gap-3 bg-figma-bg z-10">
          <!-- Sidebar toggle button (show when collapsed) -->
          <button 
            v-if="isSidebarCollapsed"
            @click="isSidebarCollapsed = false" 
            class="p-1.5 hover:bg-white/10 rounded transition-colors"
          >
            <PanelLeftOpen :size="14" />
          </button>
          
          <div class="flex-1 flex items-center gap-2 max-w-sm">
            <div class="relative flex-1">
              <Search :size="13" class="absolute left-2.5 top-1/2 -translate-y-1/2 opacity-40" />
              <input 
                v-model="searchQuery"
                type="text" 
                placeholder="Search variables..."
                class="w-full bg-white/5 border border-figma-border rounded-md pl-8 pr-3 py-1 text-[12px] text-white/70 focus:text-white focus:outline-none focus:border-figma-accent transition-all placeholder:text-white/20"
              />
            </div>
          </div>


          <!-- Spacer to push buttons to the right -->
          <div class="flex-1"></div>

          <div class="flex items-center gap-0.5 pl-2">
            <button 
              @click="toggleSmartGroups" 
              :title="anyGroupsExpanded ? 'Collapse All' : 'Expand All'" 
              class="p-1.5 hover:bg-white/10 rounded transition-colors" 
            >
              <FoldVertical v-if="anyGroupsExpanded" :size="15" />
              <UnfoldVertical v-else :size="15" />
            </button>
            <!-- Segmented Control for View Mode -->
            <div class="flex bg-black/40 p-0.5 rounded-lg border border-white/5 shrink-0">
              <button 
                @click="viewMode = 'list'"
                :title="'List View'"
                :class="viewMode === 'list' ? 'bg-[#333] text-white shadow-md' : 'text-white/20 hover:text-white/40'"
                class="p-1.5 rounded-md transition-all duration-200"
              >
                <LayoutList :size="14" />
              </button>
              <button 
                @click="viewMode = 'grid'"
                :title="'Grid View'"
                :class="viewMode === 'grid' ? 'bg-[#333] text-white shadow-md' : 'text-white/20 hover:text-white/40'"
                class="p-1.5 rounded-md transition-all duration-200"
              >
                <LayoutGrid :size="14" />
              </button>
              <button 
                @click="viewMode = 'json'"
                :title="'JSON View'"
                :class="viewMode === 'json' ? 'bg-[#333] text-white shadow-md' : 'text-white/20 hover:text-white/40'"
                class="p-1.5 rounded-md transition-all duration-200"
              >
                <Code :size="14" />
              </button>
            </div>
            <button @click="refresh" title="Refresh" class="p-1.5 hover:bg-white/10 rounded transition-colors">
              <RefreshCcw :size="14" />
            </button>
          </div>
        </header>

        <!-- Variable List -->
        <div class="flex-1 overflow-y-auto custom-scrollbar bg-figma-bg">
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
                    <div v-if="v.type === 'COLOR'" class="relative shrink-0">
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
                      {{ v.type === 'BOOLEAN' ? 'B' : v.type === 'FLOAT' ? '#' : 'T' }}
                    </div>

                    <!-- Name -->
                    <div class="flex-1 min-w-0 pointer-events-auto">
                      <div 
                        class="text-[12px] truncate font-medium text-white/60 hover:text-white cursor-pointer transition-colors inline-block"
                        @click.stop="copyValue(v.name.split('/').pop() || '', 'Name')"
                      >
                        {{ v.name.split('/').pop() }}
                      </div>
                    </div>

                    <!-- Value -->
                    <div 
                      class="font-mono text-[10px] px-2 py-1 rounded border transition-all truncate max-w-[140px] bg-black/20 border-white/5 text-white/40 group-hover:text-white/70 group-hover:border-white/10"
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
                      <div v-if="v.type === 'COLOR'" class="absolute inset-0" :style="{ backgroundColor: v.values.find((m:any) => m.modeId === activeMode)?.value || v.values[0]?.value }"></div>
                      <span v-else class="text-xs font-bold opacity-20 group-hover/card:opacity-40">{{ v.type === 'BOOLEAN' ? 'B' : v.type === 'FLOAT' ? '#' : 'T' }}</span>
                      
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
            <div v-else-if="viewMode === 'json'" class="h-full flex flex-col pt-0 pb-4">
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
        class="fixed z-[2000] w-[260px] bg-[#2C2C2C] border border-[#444] rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden text-white pointer-events-auto"
        :style="{ top: pickerPos.top + 'px', left: pickerPos.left + 'px' }"
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
              v-model="pickerInputName" 
              @blur="handleRename(false)"
              @keyup.enter="handleRename(false)"
              class="w-full bg-black/20 border rounded px-2 py-1.5 text-[11px] outline-none text-white/80 placeholder:text-white/20 transition-colors"
              :class="isDuplicateName ? 'border-red-500 focus:border-red-500' : 'border-white/10 focus:border-figma-accent'"
              placeholder="Name"
            />
            <div v-if="isDuplicateName" class="text-[9px] text-red-400 mt-0.5 flex items-center gap-1">
              <span>變數名稱已存在</span>
            </div>
          </div>
          <template v-if="pickerTab === 'Custom'">
            <template v-if="pickerTarget?.type === 'COLOR'">
              <!-- Color Display / Alias (Fig 2) -->
              <div class="px-0.5 mt-1">
                <div v-if="pickerTarget?.alias" class="flex items-center justify-between bg-white/[0.04] p-1 rounded-md border border-white/[0.06] group/alias">
                  <div class="flex items-center gap-2 px-1 py-0.5 bg-figma-accent/10 rounded border border-figma-accent/20">
                    <div class="w-2.5 h-2.5 rounded-sm shrink-0" :style="{ backgroundColor: pickerTarget.initialValue }"></div>
                    <span class="text-[10px] font-medium text-figma-accent truncate max-w-[120px]">{{ pickerTarget.alias.name }}</span>
                  </div>
                  <button 
                    @click="detachVariableAlias"
                    class="p-1 text-white/30 hover:text-white/80 hover:bg-white/5 rounded transition-all"
                    title="Detach variable"
                  >
                    <Link2Off :size="12" />
                  </button>
                </div>
                
                <div v-else class="relative w-full h-[150px] rounded-md overflow-hidden cursor-crosshair shrink-0"
                  :style="{ backgroundColor: `hsl(${pickerHsv.h}, 100%, 50%)` }"
                  @mousedown="handleSVMouse"
                >
                  <div class="absolute inset-0 bg-gradient-to-r from-white to-transparent"></div>
                  <div class="absolute inset-0 bg-gradient-to-t from-black to-transparent"></div>
                  <!-- Handle -->
                  <div 
                    class="absolute w-4 h-4 border-2 border-white rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.3)] -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    :style="{ left: pickerHsv.s + '%', top: (100 - pickerHsv.v) + '%' }"
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
                      :style="{ left: (pickerHsv.h / 360 * 100) + '%' }"
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
                      :style="{ left: (pickerHsv.a * 100) + '%' }"
                    ></div>
                  </div>
                </div>
              </div>

              <!-- Bottom Row: Mode & Inputs -->
              <div class="flex gap-1 items-center px-0.5 mt-0.5 relative">
                <!-- Mode Select -->
                <div class="w-[52px] shrink-0 h-[26px] relative">
                  <button 
                    @click.stop="cycleColorMode"
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
                  <!-- RGB Inputs -->
                  <div v-if="pickerColorMode === 'RGB'" class="w-full h-full grid grid-cols-3 gap-[2px]">
                    <input v-for="key in ['r','g','b']" :key="key"
                      :value="pickerRgba[key as keyof typeof pickerRgba]"
                      @input="(e: any) => handleRgbaInput(key, (e.target as HTMLInputElement).value)"
                      class="w-full h-full bg-black/20 border border-white/5 rounded text-[10px] text-center outline-none focus:bg-black/30 text-white/90"
                    />
                  </div>

                  <!-- Hex Input -->
                  <input 
                    v-else-if="pickerColorMode === 'Hex'"
                    v-model="pickerHex"
                    class="w-full h-full bg-black/20 border border-white/5 rounded px-2 text-[10px] outline-none focus:bg-black/30 font-mono uppercase text-white/90"
                  />

                  <!-- CSS Input -->
                  <input 
                    v-else
                    :value="`rgb(${pickerRgba.r} ${pickerRgba.g} ${pickerRgba.b}${pickerRgba.a < 1 ? ' / ' + pickerRgba.a.toFixed(2) : ''})`"
                    readonly
                    class="w-full h-full bg-black/20 border border-white/5 rounded px-2 text-[9px] outline-none opacity-60 font-mono text-white/80"
                  />
                </div>

                <!-- Alpha % (Hidden in CSS mode) -->
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

            <!-- Text / Number Input Area -->
            <template v-else>
              <div>
                <div class="text-[10px] text-white/40 font-medium px-0.5">Value</div>
                <input 
                  v-model="pickerInputValue" 
                  @input="handleValueInput(pickerInputValue)"
                  class="w-full bg-black/20 border border-white/10 rounded px-2 py-2 text-[11px] outline-none text-white/80 focus:border-figma-accent transition-colors"
                  :placeholder="pickerTarget?.type === 'FLOAT' ? '0' : 'Value text'"
                />
              </div>
            </template>



            <!-- Variable Info Toggle Section -->
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

              <!-- Expanded Info Fields -->
              <div v-if="isVariableInfoExpanded" class="space-y-3 px-1 pb-1 animate-in fade-in slide-in-from-top-1 duration-200">
                <div>
                  <textarea 
                    v-model="pickerDescription" 
                    @blur="handleRename(false)"
                    class="w-full bg-black/20 border border-white/10 rounded px-2 py-1.5 text-[11px] outline-none text-white/80 focus:border-figma-accent min-h-[60px] resize-none placeholder:text-white/20 transition-colors"
                    placeholder="描述"
                  ></textarea>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <!-- Libraries Tab Content -->
            <div class="flex flex-col h-[400px] -m-3 overflow-hidden bg-[#2C2C2C]">
              <!-- Library Toolbar (Modern Segmented Design) -->
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

                  <!-- Segmented Control -->
                  <div class="flex bg-black/40 p-0.5 rounded-lg border border-white/5 shrink-0">
                    <button 
                      @click="isLibraryGrid = false"
                      :class="!isLibraryGrid ? 'bg-[#333] text-white shadow-md' : 'text-white/20 hover:text-white/40'"
                      class="p-1.5 rounded-md transition-all duration-200"
                    >
                      <LayoutList :size="14" />
                    </button>
                    <button 
                      @click="isLibraryGrid = true"
                      :class="isLibraryGrid ? 'bg-[#333] text-white shadow-md' : 'text-white/20 hover:text-white/40'"
                      class="p-1.5 rounded-md transition-all duration-200"
                    >
                      <LayoutGrid :size="14" />
                    </button>
                  </div>

                  <!-- Fold/Unfold Button -->
                  <button 
                    @click="toggleLibrarySmartGroups" 
                    :title="anyLibraryGroupsExpanded ? 'Collapse All' : 'Expand All'" 
                    class="px-1 transition-colors text-white/40 hover:text-white/80" 
                  >
                    <FoldVertical v-if="anyLibraryGroupsExpanded" :size="15" />
                    <UnfoldVertical v-else :size="15" />
                  </button>
                </div>
              </div>

              <!-- Content Scroll Area -->
              <div class="flex-1 overflow-y-auto custom-scrollbar p-2">
                <div v-if="filteredLibraries.length === 0" class="flex flex-col items-center justify-center h-full opacity-20">
                  <Search :size="32" class="mb-2" />
                  <span class="text-[11px]">No matching variables</span>
                </div>

                <!-- Grid View -->
                <div v-else-if="isLibraryGrid" class="space-y-4">
                  <div v-for="(vars, groupFullName) in groupedLibraries" :key="groupFullName" class="space-y-2">
                    <div 
                      @click="toggleLibraryGroup(groupFullName as string)"
                      class="flex items-center gap-1 cursor-pointer group/header mb-1 px-1"
                    >
                      <ChevronDown v-if="!collapsedLibraryGroups.has(groupFullName as string)" :size="10" class="text-white/20 group-hover/header:text-white/40 transition-transform" />
                      <ChevronRight v-else :size="10" class="text-white/20 group-hover/header:text-white/40 transition-transform" />
                      <div class="text-[9px] text-white/30 group-hover/header:text-white/50 transition-colors">{{ groupFullName }}</div>
                      <div class="h-[1px] flex-1 bg-white/5 ml-2"></div>
                      <span class="text-[9px] opacity-10 font-mono">{{ vars.length }}</span>
                    </div>

                    
                    <div v-if="!collapsedLibraryGroups.has(groupFullName as string)" class="grid grid-cols-8 gap-1 pl-4 pr-1">
                      <div 
                        v-for="v in vars" :key="v.id"
                        @click="setVariableAlias(v.id)"
                        @mouseenter="handleVariableHover($event, v)"
                        @mousemove="handleMouseMove"
                        @mouseleave="handleVariableHover(null, null)"
                        class="aspect-square rounded-md shadow-sm transition-all duration-300 relative group/griditem overflow-visible"
                        :class="pickerTarget?.id === v.id ? 'cursor-not-allowed grayscale-[0.8] opacity-40' : 'cursor-pointer'"
                        :style="{ backgroundColor: v.colorValue }"
                      >
                        <!-- Active Glow Effect -->
                        <div v-if="pickerTarget?.alias?.id === v.id" class="absolute -inset-[1px] rounded-lg border-2 border-figma-accent z-10 scale-105 flex items-center justify-center bg-figma-accent/10">
                           <!-- <Check :size="10" class="text-white drop-shadow-md" /> -->
                        </div>
                        <div v-else-if="pickerTarget?.id !== v.id" class="absolute inset-0 rounded-md border border-white/10 group-hover/griditem:border-white/30 group-hover/griditem:scale-110 transition-all group-hover/griditem:shadow-lg"></div>
                        
                        <!-- Self Reference Disable Mark -->
                        <div v-if="pickerTarget?.id === v.id" class="absolute inset-0 flex items-center justify-center">
                          <X :size="12" class="text-red-500 stroke-[3px]" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- List View -->
                <div v-else class="space-y-4">
                  <div v-for="(vars, groupFullName) in groupedLibraries" :key="groupFullName" class="space-y-1">
                    <div 
                      @click="toggleLibraryGroup(groupFullName as string)"
                      class="flex items-center gap-1 cursor-pointer group/header mb-1 px-1"
                    >
                      <ChevronDown v-if="!collapsedLibraryGroups.has(groupFullName as string)" :size="10" class="text-white/20 group-hover/header:text-white/40 transition-transform" />
                      <ChevronRight v-else :size="10" class="text-white/20 group-hover/header:text-white/40 transition-transform" />
                      <div class="text-[9px] text-white/30 group-hover/header:text-white/50 transition-colors">{{ groupFullName }}</div>
                      <div class="h-[1px] flex-1 bg-white/5 ml-2"></div>
                      <span class="text-[9px] opacity-10 font-mono">{{ vars.length }}</span>
                    </div>

                    <div v-if="!collapsedLibraryGroups.has(groupFullName as string)">
                      <div 
                        v-for="v in vars" :key="v.id"
                        @click="setVariableAlias(v.id)"
                        @mouseenter="handleVariableHover($event, v)"
                        @mousemove="handleMouseMove"
                        @mouseleave="handleVariableHover(null, null)"
                        class="flex items-center gap-2.5 h-[28px] px-4 rounded-lg transition-all relative overflow-hidden"
                        :class="[
                          pickerTarget?.alias?.id === v.id ? 'bg-white/[0.02]' : 'hover:bg-white/5',
                          pickerTarget?.id === v.id ? 'cursor-not-allowed opacity-30 grayscale' : 'cursor-pointer group'
                        ]"
                      >
                        <!-- for active -->
                        <div class="w-4 h-4 rounded-md border border-white/10 shrink-0 shadow-sm" :style="{ backgroundColor: v.colorValue }"></div>
                        <span class="text-[11px] truncate flex-1 transition-colors" :class="pickerTarget?.alias?.id === v.id ? 'text-white font-bold' : 'text-white/60 group-hover:text-white/90'">{{ v.name.split('/').pop() }}</span>
                        
                        <Check v-if="pickerTarget?.alias?.id === v.id" :size="12" class="text-white shrink-0" />
                        <X v-if="pickerTarget?.id === v.id" :size="12" class="text-red-500/50 shrink-0" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </template>

    <!-- Variable Tooltip (Detailed Box Style) -->
    <transition name="tooltip-box">
      <div 
        v-if="hoveredVariable && mousePos.x" 
        class="fixed p-2.5 bg-[#1E1E1E] text-white rounded-lg shadow-[0_12px_32px_rgba(0,0,0,0.8)] z-[99999] pointer-events-none border border-white/10 flex flex-col gap-2 min-w-[140px] max-w-[200px]"
        :style="{ 
          top: tooltipPlacement === 'top' ? (mousePos.y - 12) + 'px' : (mousePos.y + 12) + 'px', 
          left: mousePos.x + 'px',
          transform: tooltipPlacement === 'top' ? 'translateX(-50%) translateY(-100%)' : 'translateX(-50%)' 
        }"
      >
        <!-- Name -->
        <div class="text-[11px] font-bold text-white/90 truncate leading-tight">
          {{ hoveredVariable.name.split('/').pop() }}
        </div>
        
        <!-- Color Info Area -->
        <div class="flex flex-col gap-1.5 px-2 py-2 bg-white/[0.03] rounded-md border border-white/5">
          <div class="flex items-center gap-2.5">
            <div 
              class="w-5 h-5 rounded border border-white/20 shrink-0 shadow-sm" 
              :style="{ backgroundColor: getHoveredColor() }"
            ></div>
            <div class="flex flex-col min-w-0">
              <!-- Linked Name (Alias) -->
              <div v-if="getHoveredAliasName()" class="flex items-center gap-1 min-w-0 mb-0.5">
                <Link :size="8" class="text-figma-accent shrink-0" />
                <span class="text-[10px] font-bold text-figma-accent truncate leading-none">{{ getHoveredAliasName() }}</span>
              </div>
              <span class="text-[9px] font-mono text-white/50 uppercase tracking-wider leading-none">{{ getHoveredColor() }}</span>
            </div>
          </div>
        </div>

        <!-- Description -->
        <div v-if="hoveredVariable.description" class="text-[9px] text-white/40 leading-relaxed break-words">
          {{ hoveredVariable.description }}
        </div>
        
        <!-- Arrow -->
        <div 
          v-if="tooltipPlacement === 'top'"
          class="absolute top-[calc(100%-1px)] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-[#1E1E1E]"
        ></div>
        <div 
          v-else
          class="absolute bottom-[calc(100%-1px)] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[6px] border-b-[#1E1E1E]"
        ></div>
      </div>
    </transition>
  </div>
</template>

<style>
.toast-enter-active, .toast-leave-active { transition: all 0.2s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translate(-50%, 10px); }

.tooltip-box-enter-active, .tooltip-box-leave-active { transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1); }
.tooltip-box-enter-from, .tooltip-box-leave-to { opacity: 0; scale: 0.95; }

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
