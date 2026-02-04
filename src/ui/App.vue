<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import VueJsonPretty from 'vue-json-pretty';
import 'vue-json-pretty/lib/styles.css';
import { 
  Check,
  PanelLeftOpen,
  ChevronDown,
  ChevronRight,
  Settings2,
} from 'lucide-vue-next';
import { useColorConversion } from '../composables/useColorConversion';
import type { 
  Variable, 
  Collection, 
  Mode, 
  VariableType, 
  PickerTarget,
  JsonThemeOption,
  TypeFilterOption
} from '../types';
import ColorPicker from './components/ColorPicker.vue';
import Sidebar from './components/Sidebar.vue';
import VariableList from './components/VariableList.vue';
import Toolbar from './components/Toolbar.vue';
import Footer from './components/Footer.vue';
import { useHistory } from '../composables/useHistory';



// --- Color Conversion ---
const { 
  hexToRgba, 
  rgbaToHsva, 
  hsvaToRgba, 
  rgbaToHex, 
  rgbaToHex8, 
  rgbaToHsla, 
  hslaToRgba 
} = useColorConversion();

// --- Demo Data Imports ---
const demoFiles = import.meta.glob('../demo/**/*.tokens.json', { eager: true });

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
// --- Variable State ---
const collections = ref<any[]>([]);
const activeIndex = ref(0);
const activeMode = ref<string | null>(null);
const searchQuery = ref('');
const searchTypeFilter = ref<'ALL' | 'Color' | 'Number' | 'String' | 'Boolean'>('ALL');
const typeFilterOptions: TypeFilterOption[] = [
  { value: 'ALL', label: 'All', icon: null },
  { value: 'Color', label: 'Colors', icon: '🎨' },
  { value: 'Number', label: 'Numbers', icon: '#' },
  { value: 'String', label: 'Strings', icon: 'T' },
  { value: 'Boolean', label: 'Booleans', icon: 'B' },
];

const pickerInputName = ref('');
const pickerInputValue = ref('');
const pickerDescription = ref('');
const pickerShowAdvanced = ref(false);
const selectedVariableId = ref<string | null>(null);

const isSidebarCollapsed = ref(false);
const sidebarWidth = ref(180);
const collapsedGroups = ref<Set<string>>(new Set());
const toastMessage = ref('');
const showToast = ref(false);
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const showToastWithTimer = (message: string, duration = 3000) => {
  if (toastTimer) clearTimeout(toastTimer);
  toastMessage.value = message;
  showToast.value = true;
  toastTimer = setTimeout(() => {
    showToast.value = false;
    toastTimer = null;
  }, duration);
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

// Redundant computed removed


const openPicker = (e: MouseEvent, v: any) => {
  pickerVisible.value = true;
  selectedVariableId.value = v.id;
  
  const modeVal = v.values.find((m: any) => m.modeId === activeMode.value) || v.values[0];
  const isAlias = !!modeVal?.alias;
  
  let currentVal = modeVal?.value;
  let aliasInfo = modeVal?.alias || undefined;

  // 只有 Color 類型才需要處理 hex 格式
  if (v.type === 'Color') {
    if (isAlias && aliasInfo) {
      currentVal = modeVal.value;
    } else {
      currentVal = (modeVal?.value || '#000000').toUpperCase();
    }
  } else {
    // String / Number / Boolean 類型保持原始值
    currentVal = modeVal?.value ?? '';
  }

  pickerTarget.value = { 
    id: v.id, 
    name: v.name.split('/').pop() || '', 
    type: v.type,
    initialName: v.name.split('/').pop() || '',
    initialValue: v.type === 'Color' ? currentVal : String(currentVal),
    initialDescription: v.description || "",
    alias: aliasInfo
  };
  pickerInputName.value = pickerTarget.value.name;
  pickerInputValue.value = String(currentVal);
  pickerDescription.value = pickerTarget.value.initialDescription;
  pickerShowAdvanced.value = false;
  
  const rgba = hexToRgba(currentVal);
  pickerHsv.value = rgbaToHsva(rgba);
  
  // Position calculation
  const pickerWidth = 260;
  const pickerHeight = v.type === 'Color' ? 400 : 180;
  
  let top = 100;
  let left = window.innerWidth / 2 - pickerWidth / 2;
  
  if (e && e.currentTarget) {
    const clickedElement = e.currentTarget as HTMLElement;
    const rowElement = clickedElement.closest('.flex.items-center.gap-3') as HTMLElement || clickedElement;
    const rect = rowElement.getBoundingClientRect();
    top = rect.bottom + 4;
    left = rect.left;
  } else if (e && (e.clientX || e.clientY)) {
    top = e.clientY + 10;
    left = e.clientX - pickerWidth / 2;
  } else {
    // Fallback to current mouse position
    top = mousePos.value.y + 10;
    left = mousePos.value.x - pickerWidth / 2;
  }
  
  if (top + pickerHeight > window.innerHeight) {
    top = Math.max(10, top - pickerHeight - 20);
  }

  if (left + pickerWidth > window.innerWidth) {
    left = window.innerWidth - pickerWidth - 10;
  }
  left = Math.max(10, left);
  
  pickerPos.value = { top, left };
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

// switchToCustomTab logic moved to ColorPicker


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

// Redundant functions removed for ColorPicker component


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

// Redundant color properties moved to ColorPicker



// Redundant state removed


const viewMode = ref<'list' | 'grid' | 'json'>('list');

// --- JSON Theme ---
const jsonThemeOptions = [
  { value: 'vscode', label: 'VS Code' },
  { value: 'monokai', label: 'Monokai' },
  { value: 'dracula', label: 'Dracula' },
  { value: 'github', label: 'GitHub Dark' },
  { value: 'one-dark', label: 'One Dark' },
  { value: 'nord', label: 'Nord' },
  { value: 'tokyo-night', label: 'Tokyo Night' },
  { value: 'catppuccin', label: 'Catppuccin' }
];
const jsonTheme = ref<string>('vscode');
// Hover and UI State kept for global positioning and sidebar sync
const hoveredIndex = ref<number | null>(null);
const hoveredRect = ref<{ top: number; height: number } | null>(null);
const hoveredVariable = ref<any | null>(null);
const varHoveredRect = ref<{ top: number; left: number; height: number; width: number } | null>(null);
const hoverTimer = ref<any>(null);
const mousePos = ref({ x: 0, y: 0 });
const collapsedSidebarFolders = ref<Set<string>>(new Set());


// --- History Management ---
const { lastChange, setLastChange, undoLastChange } = useHistory(
  collections,
  activeMode,
  pickerTarget,
  showToastWithTimer
);

// --- Computed ---
const activeCollection = computed(() => collections.value[activeIndex.value] || null);

const groupedVariables = computed(() => {
  if (!activeCollection.value) return {};
  const vars = activeCollection.value.variables || [];
  const groups: Record<string, any[]> = {};
  vars.forEach((v: any) => {
    const parts = v.name.split('/');
    const groupName = parts.length > 1 ? parts.slice(0, -1).join('/') : 'General';
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(v);
  });
  return groups;
});

const anyGroupsExpanded = computed(() => {
  const groupNames = Object.keys(groupedVariables.value);
  if (groupNames.length === 0) return false;
  return groupNames.some(g => !collapsedGroups.value.has(g));
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

// Redundant downloadJson and toggleGroup removed


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
    setLastChange({ variableId: vId, modeId: activeMode.value, oldValue, varType: vType, label });
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

// undoLastChange removed, moved to useHistory composable

const toggleGroup = (groupName: string) => {
  if (collapsedGroups.value.has(groupName)) {
    collapsedGroups.value.delete(groupName);
  } else {
    collapsedGroups.value.add(groupName);
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

//
// 根據路徑在集合中尋找變數
const findVariableByPath = (path: string): any | null => {
  if (!activeCollection.value) return null;
  
  // path 是 JSON 中的路徑，例如 "Color.Primary"
  // 集合中的變數名稱是 "Color/Primary"
  const targetName = path.replace(/\./g, '/');
  
  return activeCollection.value.variables.find((v: any) => v.name === targetName) || null;
};

// 處理 JSON node 點擊 - vue-json-pretty 的 nodeClick 事件
const handleJsonNodeClick = (node: any, pathFromArgs: string, e: MouseEvent) => {
  const path = (typeof node === 'string' ? node : node?.path) || pathFromArgs || '';
  const pathParts = path.split('.').filter((p: string) => p !== 'root' && p !== 'value' && p !== 'type');
  
  const variable = findVariableByPath(pathParts.join('.'));
  
  if (variable) {
    // 清除 hover 狀態
    if (hoverTimer.value) {
      clearTimeout(hoverTimer.value);
      hoverTimer.value = null;
    }
    hoveredVariable.value = null;
    
    // 開啟編輯器
    openPicker(e, variable);
  }
};

// 處理 JSON node hover
const handleJsonNodeMouseover = (node: any, pathFromArgs: string, e: MouseEvent) => {
  // Try to get path from various possible structures
  const path = (typeof node === 'string' ? node : node?.path) || pathFromArgs || '';
  const pathParts = path.split('.').filter((p: string) => p !== 'root' && p !== 'value' && p !== 'type');
  
  const variable = findVariableByPath(pathParts.join('.'));
  
  if (variable) {
    // 嘗試從事件、node 或全局 mousePos 取得位置
    const clientX = e?.clientX || (node as any)?.event?.clientX || mousePos.value.x;
    const clientY = e?.clientY || (node as any)?.event?.clientY || mousePos.value.y;
    
    mousePos.value = { x: clientX, y: clientY };
    
    if (hoverTimer.value) {
      clearTimeout(hoverTimer.value);
    }
    
    hoverTimer.value = setTimeout(() => {
      hoveredVariable.value = variable;
    }, 200);
  }
};

// 清除 JSON hover 狀態
const clearJsonHover = () => {
  if (hoverTimer.value) {
    clearTimeout(hoverTimer.value);
    hoverTimer.value = null;
  }
  hoveredVariable.value = null;
};

// 即時追蹤 JSON 區域的滑鼠位置
const handleJsonMouseMove = (e: MouseEvent) => {
  mousePos.value = { x: e.clientX, y: e.clientY };
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

const mapFigmaType = (type: string): VariableType => {
  switch (type) {
    case 'COLOR': return 'Color';
    case 'FLOAT': return 'Number';
    case 'STRING': return 'String';
    case 'BOOLEAN': return 'Boolean';
    default: return type as VariableType;
  }
};

// --- Lifecycle ---
onMounted(() => {
  refresh();
  window.onmessage = (event) => {
    const msg = event.data.pluginMessage;
    if (msg && msg.type === 'render-list') {
      // 映射採集到的數據類型
      const rawCollections = msg.data || [];
      collections.value = rawCollections.map((col: any) => ({
        ...col,
        variables: col.variables.map((v: any) => ({
          ...v,
          type: mapFigmaType(v.type)
        }))
      }));
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
          
          if (val && typeof val === 'object' && !(val as any).$value) {
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
      <Sidebar 
        v-model:is-sidebar-collapsed="isSidebarCollapsed"
        v-model:sidebar-width="sidebarWidth"
        :collections="collections"
        :active-index="activeIndex"
        :active-mode="activeMode"
        :collapsed-sidebar-folders="collapsedSidebarFolders"
        :hovered-index="hoveredIndex"
        :hovered-rect="hoveredRect"
        @select-collection="selectCollection"
        @select-mode="selectMode"
        @toggle-folder="toggleSidebarFolder"
        @handle-resize="handleSidebarResize"
        @handle-hover="handleSidebarHover"
      />


      <!-- Main Panel -->
      <main class="flex-1 flex flex-col min-w-0">
        <!-- Toolbar Component -->
        <Toolbar 
          v-model:search-query="searchQuery"
          v-model:search-type-filter="searchTypeFilter"
          :type-filter-options="typeFilterOptions"
          v-model:view-mode="viewMode"
          :any-groups-expanded="anyGroupsExpanded"
          v-model:is-sidebar-collapsed="isSidebarCollapsed"
          @refresh="refresh"
          @toggle-smart-groups="toggleSmartGroups"
        />


        <!-- Variable List Component -->
        <VariableList 
          :active-collection="collections[activeIndex]"
          :active-mode="activeMode"
          :search-query="searchQuery"
          :search-type-filter="searchTypeFilter"
          v-model:view-mode="viewMode"
          v-model:jsonTheme="jsonTheme"
          :json-theme-options="jsonThemeOptions"
          :hovered-variable="hoveredVariable"
          :mouse-pos="mousePos"
          :tooltip-placement="mousePos.y < 160 ? 'bottom' : 'top'"
          :collapsed-groups="collapsedGroups"
          @copy-value="copyValue"
          @open-picker="openPicker"
          @variable-hover="handleVariableHover"
          @mouse-move="handleMouseMove"
          @toggle-group="toggleGroup"
          @json-node-click="handleJsonNodeClick"
          @json-node-mouseover="handleJsonNodeMouseover"
          @clear-json-hover="clearJsonHover"
          @json-mouse-move="handleJsonMouseMove"
        />

      </main>
    </div>

        <!-- Footer Component -->
        <Footer version="1.0.0" status="Ready" />

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
    <ColorPicker 
      :visible="pickerVisible"
      :pos="pickerPos"
      :target="pickerTarget"
      v-model:hsv="pickerHsv"
      :all-variables="allVariables"
      :is-duplicate-name="isDuplicateName"
      :collections="collections"
      @close="closePicker"
      @rename="handleRename"
      @update-description="handleUpdateDescription"
      @set-alias="setVariableAlias"
      @detach-alias="detachVariableAlias"
      @value-input="handleValueInput"
      @variable-hover="handleVariableHover"
      @mouse-move="handleMouseMove"
    />


<!-- Tooltip and logic moved to VariableList.vue -->

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

/* JSON Theme Base */
.vjs-tree {
  font-size: 13px !important;
  font-family: 'Fira Code', 'SF Mono', 'Monaco', 'Menlo', 'Consolas', monospace !important;
  font-feature-settings: "liga" 1, "calt" 1; /* Enable ligatures */
}

/* Custom Scrollbar for all */
.custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
.custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2); }
</style>
