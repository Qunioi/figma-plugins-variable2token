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
import { useVariableLogic } from '../composables/useVariableLogic';
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
import PushModal from './components/PushModal.vue';
import GitHubSettingsModal from './components/GitHubSettings.vue';
import PullConfirmModal from './components/PullConfirmModal.vue';
import SimpleEditor from './components/SimpleEditor.vue';
import ContextMenu from './components/ContextMenu.vue';
import DeleteConfirmModal from './components/DeleteConfirmModal.vue';
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

const { getMappedType, serializeJson } = useVariableLogic();

// --- Demo Data Imports ---
const demoFiles = import.meta.glob('../collections/**/*.tokens.json', { eager: true });

// --- Custom Color Picker Internal State ---
const pickerVisible = ref(false);
const pickerInitialTab = ref<'Custom' | 'Libraries'>('Custom');
const pickerPos = ref({ top: 0, left: 0 });
const pickerTarget = ref<{
  id: string, 
  name: string, 
  type: string, 
  initialName: string, 
  initialValue: string,
  initialDescription: string,
  originalName: string,      // 視窗開啟時的原始名稱
  originalValue: string,     // 視窗開啟時的原始值
  originalDescription: string, // 視窗開啟時的原始描述
  originalAlias?: { id: string, name: string } | null, // 視窗開啟時的原始 alias
  alias?: { id: string, name: string }
} | null>(null);
const pickerHsv = ref({ h: 0, s: 0, v: 0, a: 1 });
// --- Variable State ---
const collections = ref<any[]>([]);
const activeIndex = ref(0);
const activeMode = ref<string | null>(null);
const defaultModeByCollection = ref<Record<string, string>>({});
const searchQuery = ref('');
const searchTypeFilter = ref<'ALL' | 'COLOR' | 'NUMBER' | 'STRING' | 'BOOLEAN'>('ALL');
const typeFilterOptions: TypeFilterOption[] = [
  { value: 'ALL', label: 'All', icon: null },
  { value: 'COLOR', label: 'Colors', icon: '🎨' },
  { value: 'NUMBER', label: 'Numbers', icon: '#' },
  { value: 'STRING', label: 'Strings', icon: 'T' },
  { value: 'BOOLEAN', label: 'Booleans', icon: 'B' },
];

const pickerInputName = ref('');
const pickerInputValue = ref('');
const pickerDescription = ref('');
const pickerShowAdvanced = ref(false);
const selectedVariableId = ref<string | null>(null);

const isSidebarCollapsed = ref(false);
const sidebarWidth = ref(180);
const collapsedGroups = ref<Set<string>>(new Set());
const githubSettings = ref({
  githubAccount: undefined as { token: string, username: string, avatarUrl: string } | undefined,
  githubRepo: '',
  githubPath: 'assets/tokens/',
  githubBranch: 'main'
});
const isPushModalOpen = ref(false);
const pushModalMode = ref<'push' | 'pull'>('push');
const isGithubSettingsInAppOpen = ref(false);
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

// --- Simple Editor for Collections & Modes ---
const simpleEditor = ref({
  visible: false,
  pos: { top: 0, left: 0 },
  title: '',
  name: '',
  valueLabel: '',
  value: '',
  options: [] as string[],
  onSave: (newName: string, newValue: string) => {}
});

// --- Context Menu & Delete State ---
const contextMenu = ref({
  visible: false,
  pos: { x: 0, y: 0 },
  type: 'collection' as 'collection' | 'mode',
  data: {} as any,
  deleteDisabled: false
});

const deleteModal = ref({
  visible: false,
  itemPath: '',
  itemType: 'Collection' as 'Collection' | 'Mode',
  onConfirm: () => {}
});

const pullConfirm = ref({
  visible: false,
  collectionName: '',
  modeId: '',
  modeName: '',
  tokensJson: ''
});
const pullSyncKey = ref(0);

const handleContextMenu = (e: MouseEvent, type: 'collection' | 'mode', data: any) => {
  const deleteDisabled = false;
  
  contextMenu.value = {
    visible: true,
    pos: { x: e.clientX, y: e.clientY },
    type,
    data,
    deleteDisabled
  };
};

const handleDuplicateFromMenu = () => {
  const { data } = contextMenu.value;
  const collectionNames = collections.value.map(c => c.collectionName);
  const sourceCollection = collections.value.find(c => c.collectionName === data.collectionName);
  const sourceVariableIds = sourceCollection?.variables?.map((v: any) => v.id) || [];
  const sourceVariablesPayload = (sourceCollection?.variables || []).map((v: any) => ({
    id: v.id,
    name: v.name,
    type: v.type,
    description: v.description || '',
    valuesByMode: Object.fromEntries((v.values || []).map((m: any) => [m.modeId, m.value])),
    aliasesByMode: Object.fromEntries((v.values || []).map((m: any) => [m.modeId, m.alias?.name || null]))
  }));
  const tempTokensJson = sourceCollection ? serializeJson(sourceCollection.variables || [], data.mode.modeId, { includeDescription: true }) : '';

  console.log('[V2T][UI] Duplicate Mode: prepare payload', {
    sourceCollectionName: data.collectionName,
    modeId: data.mode.modeId,
    variables: sourceVariablesPayload.length,
    tokenJsonSize: tempTokensJson?.length || 0
  });

  simpleEditor.value = {
    visible: true,
    pos: { top: contextMenu.value.pos.y, left: contextMenu.value.pos.x },
    title: 'Duplicate Mode to...',
    name: data.mode.name,
    valueLabel: 'Target Collection',
    value: data.collectionName,
    options: collectionNames,
    onSave: (newName: string, targetCollectionName: string) => {
      console.log('[V2T][UI] Duplicate Mode: send to main', {
        sourceCollectionName: data.collectionName,
        targetCollectionName,
        modeId: data.mode.modeId,
        newName
      });
      parent.postMessage({ 
        pluginMessage: { 
          type: 'duplicate-mode', 
          modeId: data.mode.modeId, 
          sourceCollectionName: data.collectionName, 
          targetCollectionName,
          newName,
          sourceVariableIds,
          sourceVariablesPayload,
          tempTokensJson
        } 
      }, '*');
    }
  };
};

const handleDuplicateCollectionFromMenu = () => {
  const { data } = contextMenu.value;

  simpleEditor.value = {
    visible: true,
    pos: { top: contextMenu.value.pos.y, left: contextMenu.value.pos.x },
    title: 'Duplicate Collection',
    name: data.collectionName,
    valueLabel: 'Status',
    value: 'All modes & variables will be copied',
    options: [],
    onSave: (newName: string) => {
      parent.postMessage({ 
        pluginMessage: { 
          type: 'duplicate-collection', 
          sourceName: data.collectionName, 
          newName 
        } 
      }, '*');
    }
  };
};

const handleEditFromMenu = () => {
  const { type, data, pos } = contextMenu.value;
  // 模擬觸發原本的 editor 開啟邏輯，但位置改用滑鼠位置
  const fakeEvent = { currentTarget: { getBoundingClientRect: () => ({ left: pos.x, bottom: pos.y, width: 0 }) } } as any;
  if (type === 'collection') {
    openCollectionEditor(fakeEvent, data.collectionName);
  } else {
    openModeEditor(fakeEvent, data.collectionName, data.mode);
  }
};

const handleDeleteFromMenu = () => {
  const { type, data } = contextMenu.value;
  if (type === 'collection') {
    deleteModal.value = {
      visible: true,
      itemPath: data.collectionName,
      itemType: 'Collection',
      onConfirm: () => {
        parent.postMessage({ pluginMessage: { type: 'delete-collection', collectionName: data.collectionName } }, '*');
      }
    };
  } else {
    const fullPath = `${data.collectionName}/${data.mode.name}`;
    deleteModal.value = {
      visible: true,
      itemPath: fullPath,
      itemType: 'Mode',
      onConfirm: () => {
        parent.postMessage({ pluginMessage: { type: 'delete-mode', collectionName: data.collectionName, modeId: data.mode.modeId } }, '*');
      }
    };
  }
};

const openCollectionEditor = (e: MouseEvent, collectionName: string) => {
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  
  let left = rect.left;
  if (left + 220 > window.innerWidth) {
    left = window.innerWidth - 230;
  }

  // 對於 Collection，我們允許更改名稱，但目前不提供對其父級（Folder）的更改
  simpleEditor.value = {
    visible: true,
    pos: { top: rect.bottom + 5, left },
    title: 'Edit Collection',
    name: collectionName,
    valueLabel: 'Type',
    value: 'Variable Collection',
    options: [],
    onSave: (newName: string) => {
      parent.postMessage({ pluginMessage: { type: 'rename-collection', oldName: collectionName, newName } }, '*');
    }
  };
};

const openModeEditor = (e: MouseEvent, collectionName: string, mode: any) => {
  const target = e.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();

  let left = rect.left;
  if (left + 220 > window.innerWidth) {
    left = window.innerWidth - 230;
  }

  // 獲取所有可選的 Collection 名稱
  const collectionNames = collections.value.map(c => c.collectionName);

  simpleEditor.value = {
    visible: true,
    pos: { top: rect.bottom + 5, left },
    title: 'Edit Mode',
    name: mode.name,
    valueLabel: 'Collection',
    value: collectionName,
    options: collectionNames,
    onSave: (newName: string, newCollection: string) => {
      // 如果 Collection 改變了，發送到 main.ts 處理移動邏輯
      if (newCollection !== collectionName) {
        parent.postMessage({ 
          pluginMessage: { 
            type: 'move-mode', 
            modeId: mode.modeId, 
            oldCollection: collectionName, 
            newCollection,
            newName 
          } 
        }, '*');
      } else {
        parent.postMessage({ pluginMessage: { type: 'rename-mode', collectionName, modeId: mode.modeId, newName } }, '*');
      }
    }
  };
};

const allVariables = computed(() => {
  const vars: any[] = [];
  collections.value.forEach(col => {
    col.variables.forEach((v: any) => {
      if (v.type?.toUpperCase() === 'COLOR') vars.push(v);
    });
  });
  return vars;
});

const jsonDataForActiveCollection = computed(() => {
  const activeCol = collections.value[activeIndex.value];
  if (!activeCol) return {};
  
  const result: Record<string, any> = {};
  activeCol.variables.forEach((v: any) => {
    const parts = v.name.split('/');
    let current = result;
    parts.forEach((part: string, index: number) => {
      if (index === parts.length - 1) {
        const val = v.values.find((m: any) => m.modeId === activeMode.value)?.value || v.values[0]?.value;
        const mappedType = getMappedType(v.type);
        current[part] = { value: val, type: mappedType };
      } else {
        if (!current[part]) current[part] = {};
        current = current[part];
      }
    });
  });
  return result;
});

// Redundant computed removed


const openPicker = (e: MouseEvent, v: any) => {
  pickerVisible.value = true;
  selectedVariableId.value = v.id;
  
  const modeVal = v.values.find((m: any) => m.modeId === activeMode.value) || v.values[0];
  const isAlias = !!modeVal?.alias;
  
  let currentVal = modeVal?.value;
  let aliasInfo = modeVal?.alias || undefined;

  const isColorType = v.type?.toUpperCase() === 'COLOR';
  // 只有 COLOR 類型才需要處理 hex 格式
  if (isColorType) {
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
    type: v.type?.toUpperCase() || v.type,
    initialName: v.name.split('/').pop() || '',
    initialValue: isColorType ? currentVal : String(currentVal),
    initialDescription: v.description || "",
    originalName: v.name.split('/').pop() || '',
    originalValue: isColorType ? currentVal : String(currentVal),
    originalDescription: v.description || "",
    originalAlias: aliasInfo || null, // 記錄開啟時的原始 alias
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
  const pickerHeight = isColorType ? 400 : 180;
  
  let top = 100;
  let left = window.innerWidth / 2 - pickerWidth / 2;
  let clickY = 0;
  let clickX = 0;
  
  if (e && e.currentTarget) {
    const clickedElement = e.currentTarget as HTMLElement;
    const rowElement = clickedElement.closest('.flex.items-center.gap-3') as HTMLElement || clickedElement;
    const rect = rowElement.getBoundingClientRect();
    clickY = rect.bottom;
    clickX = rect.left;
  } else if (e && (e.clientX || e.clientY)) {
    clickY = e.clientY;
    clickX = e.clientX;
  } else {
    // Fallback to current mouse position
    clickY = mousePos.value.y;
    clickX = mousePos.value.x;
  }
  
  // 優先顯示在點擊位置下方
  top = clickY + 10;
  left = clickX - pickerWidth / 2;
  
  // 檢查是否超出底部，如果是則顯示在點擊位置上方
  if (top + pickerHeight > window.innerHeight - 10) {
    top = clickY - pickerHeight - 10;
    // 確保不會超出頂部
    if (top < 10) {
      top = 10;
    }
  }

  // 檢查左右邊界
  if (left + pickerWidth > window.innerWidth - 10) {
    left = window.innerWidth - pickerWidth - 10;
  }
  if (left < 10) {
    left = 10;
  }
  
  pickerPos.value = { top, left };
  
  // 根據變數是否為連結變數（alias）決定初始標籤頁
  // - 有 alias → Libraries 標籤
  // - 純色碼 → Custom 標籤
  pickerInitialTab.value = pickerTarget.value?.alias ? 'Libraries' : 'Custom';
  pickerVisible.value = true;
};
const handleUpdateTarget = (newTarget: any) => {
  pickerTarget.value = newTarget;
  if (newTarget) {
    pickerInputName.value = newTarget.name;
    pickerDescription.value = newTarget.initialDescription;
  }
};

const updateFromPicker = () => {
  if (!pickerTarget.value || pickerTarget.value.type?.toUpperCase() !== 'COLOR') return;
  const rgba = hsvaToRgba(pickerHsv.value);
  const hex = rgbaToHex8(rgba); // 使用 hex8 以支援透明度
  
  // 僅更新本地狀態，不發送給 Figma
  pickerTarget.value.initialValue = hex.toUpperCase();
};

// 增加監聽，確保選色器操作能反映在本地 state
watch(pickerHsv, () => {
  if (pickerVisible.value && pickerTarget.value?.type?.toUpperCase() === 'COLOR') {
    updateFromPicker();
  }
}, { deep: true });

const handleValueInput = (val: string) => {
  if (!pickerTarget.value) return;
  
  // 僅更新本地目標狀態，確保 ColorPicker 內的輸入框同步，不發送給 Figma
  pickerTarget.value = {
    ...pickerTarget.value,
    initialValue: val
  };
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

    // 只更新本地 UI，不立即發送到 Figma
    const targetVar = allVariables.value.find(av => av.id === targetId);
    if (targetVar) {
      pickerTarget.value.alias = { id: targetId, name: targetVar.name.split('/').pop() || targetVar.name };
      const aliasColor = targetVar.values.find((m: any) => m.modeId === activeMode.value)?.value || targetVar.values[0]?.value;
      if (aliasColor) {
        pickerTarget.value.initialValue = aliasColor;
        const rgba = hexToRgba(aliasColor);
        pickerHsv.value = rgbaToHsva(rgba);
      }
      
      showToastWithTimer(`Linked to ${targetVar.name}`);
    }
  }
};

const detachVariableAlias = () => {
  if (pickerTarget.value && activeMode.value) {
    const currentColor = pickerTarget.value.initialValue;
    
    // 只更新本地 UI，不立即發送到 Figma
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
  const val = modeVal?.value;
  if (val === undefined || val === null) return 'N/A';
  
  // 針對 Boolean 類型進行特殊處理，確保顯示 'true' / 'false' 而非空白
  if (v.type?.toUpperCase() === 'BOOLEAN') {
    return (val === true || val === 1 || val === 'true') ? 'true' : 'false';
  }
  
  return String(val);
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
    setTimeout(() => {
      document.getElementById('picker-name-input')?.focus();
    }, 0);
    return;
  }
  
  if (pickerTarget.value) {
    const nameChanged = pickerInputName.value !== pickerTarget.value.originalName;
    const descChanged = pickerDescription.value !== pickerTarget.value.originalDescription;
    
    // 檢查 alias 是否變更
    const originalAlias = pickerTarget.value.originalAlias;
    const currentAlias = pickerTarget.value.alias;
    const aliasChanged = (originalAlias?.id !== currentAlias?.id);
    
    // 比較最終值與開啟時的原始值
    let valueChanged = false;
    let finalValue: any;

     const isColorType = pickerTarget.value.type?.toUpperCase() === 'COLOR';
     if (isColorType) {
       // 顏色類型：從選色器的 HSV 值計算最終顏色
       const rgba = hsvaToRgba(pickerHsv.value);
       finalValue = rgbaToHex8(rgba).toUpperCase();
       valueChanged = finalValue !== pickerTarget.value.originalValue.toUpperCase();
    } else {
       // 其他類型（String/Number/Boolean）：直接使用 initialValue
       finalValue = pickerTarget.value.initialValue;
       valueChanged = finalValue !== pickerTarget.value.originalValue;
    }
    
    if (nameChanged || valueChanged || descChanged || aliasChanged) {
       // 1. 建立 Undo 紀錄（使用最原始的值）
       setLastChange({ 
         variableId: pickerTarget.value.id, 
         modeId: activeMode.value!, 
         oldValue: (valueChanged || aliasChanged) ? pickerTarget.value.originalValue : undefined,
         oldName: nameChanged ? pickerTarget.value.originalName : undefined,
         oldDescription: descChanged ? pickerTarget.value.originalDescription : undefined,
         oldAlias: aliasChanged ? originalAlias : undefined,
         varType: pickerTarget.value.type?.toUpperCase() || pickerTarget.value.type, 
         label: pickerInputName.value 
       });

       // 2. 送出所有變更至 Figma
       if (aliasChanged) {
         // Alias 變更處理
         if (currentAlias) {
           // 設置新的 alias 連結
           parent.postMessage({
             pluginMessage: {
               type: 'set-variable-alias',
               variableId: pickerTarget.value.id,
               modeId: activeMode.value,
               targetVariableId: currentAlias.id
             }
           }, '*');
         } else {
           // 切斷 alias，恢復純色值
           parent.postMessage({
             pluginMessage: {
               type: 'update-variable',
               variableId: pickerTarget.value.id,
               modeId: activeMode.value,
               newValue: finalValue,
               varType: pickerTarget.value.type?.toUpperCase() || pickerTarget.value.type
             }
           }, '*');
         }
       } else if (valueChanged) {
         // 只有純色值變更（沒有 alias 變更）
         updateVariable(pickerTarget.value.id, finalValue, pickerTarget.value.type?.toUpperCase() || pickerTarget.value.type, undefined, undefined, true);
       }

       if (nameChanged) {
         parent.postMessage({ 
           pluginMessage: { 
             type: 'update-name', 
             variableId: pickerTarget.value.id, 
             newName: pickerInputName.value 
           } 
         }, '*');
       }

       if (descChanged) {
          parent.postMessage({ 
            pluginMessage: { 
              type: 'update-description', 
              variableId: pickerTarget.value.id, 
              description: pickerDescription.value 
            } 
          }, '*');
       }

       showToastWithTimer(`已更新變數: ${pickerInputName.value}`);
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
  const col = collections.value[index];
  const isEmptyDefaultMode = col?.variables?.length === 0 && col?.modes?.length === 1 && col.modes[0].name === 'Mode 1';
  if (col?.modes?.length > 0 && !isEmptyDefaultMode) {
    activeMode.value = col.modes[0].modeId;
  } else {
    activeMode.value = null;
  }
};

const selectMode = (collectionIndex: number, modeId: string) => {
  activeIndex.value = collectionIndex;
  activeMode.value = modeId;
  const col = collections.value[collectionIndex];
  if (col?.collectionName) {
    defaultModeByCollection.value[col.collectionName] = modeId;
  }
};

const refresh = () => {
  parent.postMessage({ pluginMessage: { type: 'request-refresh' } }, '*');
};

const createCollection = () => {
  parent.postMessage({ pluginMessage: { type: 'create-collection' } }, '*');
};

const createMode = (collectionName: string) => {
  parent.postMessage({ pluginMessage: { type: 'create-mode', collectionName } }, '*');
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
    showToastWithTimer(`已更新 ${label}`);
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
const handleJsonNodeClick = (node: any, pathFromArgs: string, e?: MouseEvent) => {
  // vue-json-pretty 可能不傳遞事件對象，我們使用 node 信息來判斷
  const path = (typeof node === 'string' ? node : node?.path) || pathFromArgs || '';
  
  // 分割路徑並處理
  let pathParts = path.split('.');
  
  // 移除開頭的 'root'
  if (pathParts[0] === 'root') {
    pathParts = pathParts.slice(1);
  }
  
  // 移除結尾的 '$value', '$type', '$description'（這些是屬性內容，點擊它們也要能定位到主變數）
  if (pathParts.length > 0) {
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart === '$value' || lastPart === '$type' || lastPart === '$description' || lastPart === 'value' || lastPart === 'type') {
      pathParts = pathParts.slice(0, -1);
    }
  }
  
  // 如果路徑為空，說明點擊的是根節點或無效節點
  if (pathParts.length === 0) {
    return;
  }
  
  const variablePath = pathParts.join('.');
  const variable = findVariableByPath(variablePath);
  
  // 只有找到變數且該變數有 values 屬性（是實際的變數，不是父節點）時才開啟編輯器
  if (variable && variable.values) {
    // 清除 hover 狀態
    if (hoverTimer.value) {
      clearTimeout(hoverTimer.value);
      hoverTimer.value = null;
    }
    hoveredVariable.value = null;
    
    // 如果沒有事件對象，創建一個模擬的事件對象使用當前鼠標位置
    const mockEvent = e || {
      clientX: mousePos.value.x,
      clientY: mousePos.value.y,
      target: null,
      currentTarget: null
    } as any;
    
    // 開啟編輯器
    openPicker(mockEvent, variable);
  }
};

// 處理 JSON node hover
const handleJsonNodeMouseover = (node: any, pathFromArgs: string, e: MouseEvent) => {
  // Try to get path from various possible structures
  const path = (typeof node === 'string' ? node : node?.path) || pathFromArgs || '';
  const pathParts = path.split('.').filter((p: string) => p !== 'root' && p !== 'value' && p !== 'type' && p !== '$value' && p !== '$type' && p !== '$description');
  
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

const normalizeVariableType = (type: string): VariableType => {
  const upper = (type || '').toUpperCase();
  if (upper === 'NUMBER') return 'NUMBER';
  if (upper === 'COLOR' || upper === 'NUMBER' || upper === 'STRING' || upper === 'BOOLEAN') {
    return upper as VariableType;
  }
  return upper as VariableType;
};

const mapFigmaType = (type: string): VariableType => normalizeVariableType(type);

// --- Lifecycle ---
const isInitialLoading = ref(true);

onMounted(() => {
  refresh();
  window.onmessage = (event) => {
    const msg = event.data.pluginMessage;
    if (msg && msg.type === 'render-list') {
      const oldLen = collections.value.length;
      // 映射採集到的數據類型
      const rawCollections = msg.data || [];
      collections.value = rawCollections.map((col: any) => ({
        ...col,
        variables: col.variables.map((v: any) => ({
          ...v,
          type: mapFigmaType(v.type)
        }))
      }));

      // 如果新增了集合且非初始讀取，自動選中並展開
      if (collections.value.length > oldLen && !isInitialLoading.value) {
        activeIndex.value = collections.value.length - 1;
        const newCol = collections.value[activeIndex.value];
        const isEmptyDefaultMode = newCol?.variables?.length === 0 && newCol?.modes?.length === 1 && newCol.modes[0].name === 'Mode 1';
        if (newCol.modes?.length > 0 && !isEmptyDefaultMode) {
          activeMode.value = newCol.modes[0].modeId;
        } else {
          activeMode.value = null;
        }
        // 展開側邊欄對應項
        collapsedSidebarFolders.value.delete('flat_' + activeIndex.value);
      }

      // 套用儲存的設定
      if (msg.settings) {
        if (msg.settings.jsonTheme) jsonTheme.value = msg.settings.jsonTheme;
        if (msg.settings.viewMode) viewMode.value = msg.settings.viewMode;
        if (msg.settings.defaultModeByCollection) {
          defaultModeByCollection.value = msg.settings.defaultModeByCollection;
        }
        
        // 確保整塊正確套用，不被 watch 覆寫
        const savedGithub = { ...githubSettings.value };
        if (msg.settings.githubAccount) savedGithub.githubAccount = msg.settings.githubAccount;
        if (msg.settings.githubRepo) savedGithub.githubRepo = msg.settings.githubRepo;
        if (msg.settings.githubPath) savedGithub.githubPath = msg.settings.githubPath;
        if (msg.settings.githubBranch) savedGithub.githubBranch = msg.settings.githubBranch;

        try {
          const sessionToken = sessionStorage.getItem('v2t_github_token');
          if (sessionToken && savedGithub.githubAccount && !savedGithub.githubAccount.token) {
            savedGithub.githubAccount = {
              ...savedGithub.githubAccount,
              token: sessionToken
            };
          }
        } catch (e) {
          // ignore sessionStorage errors
        }
        
        githubSettings.value = savedGithub;
      }
      
      // 標記載入完成，之後的變化才會觸發儲存
      setTimeout(() => {
        isInitialLoading.value = false;
      }, 100);

      if (activeIndex.value >= collections.value.length) {
        activeIndex.value = 0;
      }
      if (activeCollection.value?.modes?.length > 0) {
        const isEmptyDefaultMode = activeCollection.value?.variables?.length === 0 && activeCollection.value?.modes?.length === 1 && activeCollection.value.modes[0].name === 'Mode 1';
        const savedModeId = defaultModeByCollection.value[activeCollection.value.collectionName];
        const savedExists = savedModeId && activeCollection.value.modes.find((m: any) => m.modeId === savedModeId);
        if (savedExists) {
          activeMode.value = savedModeId;
        } else if (!activeMode.value || !activeCollection.value.modes.find((m: any) => m.modeId === activeMode.value)) {
          if (!isEmptyDefaultMode) {
            activeMode.value = activeCollection.value.modes[0].modeId;
          }
        }
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
                type: normalizeVariableType((val as any).$type || 'STRING'),
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
        // Path format: ../collections/CollectionName/ModeName.tokens.json
        const trimmed = path.replace(/^\.\.\/collections\//, '');
        const parts = trimmed.split('/');
        const collectionName = parts[0];
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
    const isEmptyDefaultMode = newCol?.variables?.length === 0 && newCol?.modes?.length === 1 && newCol.modes[0].name === 'Mode 1';
    if (!isEmptyDefaultMode) {
      activeMode.value = newCol.modes[0].modeId;
    } else {
      activeMode.value = null;
    }
  }
});

// 監聽設定變化並自動儲存
watch([jsonTheme, viewMode, githubSettings, defaultModeByCollection], ([newTheme, newViewMode, newGithub, newDefaultModes]) => {
  if (isInitialLoading.value) return;
  
  // 使用 JSON 序列化確保移除所有 Proxy 轉為純 JS 物件
  const settingsToSave = JSON.parse(JSON.stringify({ 
    jsonTheme: newTheme,
    viewMode: newViewMode,
    defaultModeByCollection: newDefaultModes,
    ...newGithub
  }));

  if (settingsToSave.githubAccount?.token) {
    delete settingsToSave.githubAccount.token;
  }

  if (settingsToSave.githubAccount?.token) {
    delete settingsToSave.githubAccount.token;
  }

  parent.postMessage({ 
    pluginMessage: { 
      type: 'save-settings', 
      settings: settingsToSave
    } 
  }, '*');
}, { deep: true });

const updateGithubSettings = (newSettings: any) => {
  if (newSettings?.githubAccount?.token) {
    try {
      sessionStorage.setItem('v2t_github_token', newSettings.githubAccount.token);
    } catch (e) {
      // ignore sessionStorage errors
    }
  }
  githubSettings.value = { 
    ...githubSettings.value,
    ...newSettings 
  };
  showToastWithTimer('GitHub 帳號資訊已同步');
};

const handleLogout = () => {
  try {
    sessionStorage.removeItem('v2t_github_token');
  } catch (e) {
    // ignore sessionStorage errors
  }
  githubSettings.value.githubAccount = undefined;
  showToastWithTimer('已登出 GitHub 帳號');
};

const pullFromGithub = async () => {
  const account = githubSettings.value.githubAccount;
  const repo = githubSettings.value.githubRepo;
  const branch = githubSettings.value.githubBranch || 'main';
  const githubPath = githubSettings.value.githubPath || 'assets/tokens/';

  lastChange.value = null;

  const activeCol = collections.value[activeIndex.value];
  const activeModeObj = activeCol?.modes?.find((m: any) => m.modeId === activeMode.value);

  if (!activeCol || !activeModeObj) {
    showToastWithTimer('請先選擇要同步的 Collection 與 Mode');
    return;
  }

  if (!account?.token || !repo) {
    isGithubSettingsInAppOpen.value = true;
    showToastWithTimer('請先設定 GitHub 連動資訊');
    return;
  }

  const filePath = `${githubPath.endsWith('/') ? githubPath : githubPath + '/'}${activeCol.collectionName}/${activeModeObj.name}.tokens.json`.replace(/\/+/g, '/');

  showToastWithTimer('正在從 GitHub 拉取...');

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`, {
      headers: { 'Authorization': `token ${account.token}`, 'Accept': 'application/vnd.github.v3+json' }
    });

    if (res.status !== 200) {
      showToastWithTimer('找不到遠端檔案或權限不足');
      return;
    }

    const data = await res.json();
    const remoteJson = decodeURIComponent(escape(atob(data.content)));

    parent.postMessage({
      pluginMessage: {
        type: 'pull-from-github',
        collectionName: activeCol.collectionName,
        modeId: activeModeObj.modeId,
        tokensJson: remoteJson
      }
    }, '*');
  } catch (error) {
    console.error('GitHub Pull failed:', error);
    showToastWithTimer('拉取失敗，請檢查網路或倉庫設定');
  }
};

const pullFromGithubPayload = (payload: { collectionName: string; modeId: string; tokensJson: string }) => {
  if (!payload?.tokensJson) return;
  lastChange.value = null;
  showToastWithTimer('正在套用 GitHub 版本...');
  parent.postMessage({
    pluginMessage: {
      type: 'pull-from-github',
      collectionName: payload.collectionName,
      modeId: payload.modeId,
      tokensJson: payload.tokensJson
    }
  }, '*');
};

const openPullConfirm = (payload: { collectionName: string; modeId: string; modeName?: string; tokensJson: string }) => {
  if (!payload?.tokensJson) return;
  pullConfirm.value = {
    visible: true,
    collectionName: payload.collectionName,
    modeId: payload.modeId,
    modeName: payload.modeName || payload.modeId,
    tokensJson: payload.tokensJson
  };
};

const confirmPull = () => {
  const payload = {
    collectionName: pullConfirm.value.collectionName,
    modeId: pullConfirm.value.modeId,
    tokensJson: pullConfirm.value.tokensJson
  };
  pullConfirm.value.visible = false;
  pullFromGithubPayload(payload);
  pullSyncKey.value += 1;
  refresh();
};

const syncPushToGithub = async (pushData: { message: string, branch: string, tasks: { path: string, content: string, collectionName: string, modeName: string }[] }) => {
  const account = githubSettings.value.githubAccount;
  const { githubRepo } = githubSettings.value;

  lastChange.value = null;

  if (!account?.token || !githubRepo || !pushData.tasks.length) {
    if (!account?.token) isGithubSettingsInAppOpen.value = true;
    return;
  }

  isPushModalOpen.value = false;
  const total = pushData.tasks.length;
  let successCount = 0;

  for (let i = 0; i < total; i++) {
    const task = pushData.tasks[i];
    showToastWithTimer(`正在推送 (${i + 1}/${total}): ${task.modeName}...`, 10000);

    try {
      // 1. 獲取現有檔案的 SHA
      const getRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${task.path}?ref=${pushData.branch}`, {
        headers: { 'Authorization': `token ${account.token}`, 'Accept': 'application/vnd.github.v3+json' }
      });

      let sha = undefined;
      if (getRes.status === 200) {
        const data = await getRes.json();
        sha = data.sha;
      }

      // 2. 推送更新
      const putRes = await fetch(`https://api.github.com/repos/${githubRepo}/contents/${task.path}`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${account.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: pushData.message,
          content: btoa(unescape(encodeURIComponent(task.content))),
          sha: sha,
          branch: pushData.branch
        })
      });

      if (putRes.ok) {
        successCount++;
      } else {
        const err = await putRes.json();
        console.error(`GitHub Error for ${task.path}:`, err);
      }
    } catch (error: any) {
      console.error(`Failed to sync ${task.path}:`, error);
    }
  }

  if (successCount === total) {
    lastChange.value = null;
    showToastWithTimer(`成功推送全部 ${total} 個檔案`);
  } else if (successCount > 0) {
    lastChange.value = null;
    showToastWithTimer(`部分推送成功 (${successCount}/${total})`);
  } else {
    alert('推送失敗，請檢查網路或倉庫設定。');
  }
};

</script>

<template>
  <div class="flex flex-col h-screen overflow-hidden bg-figma-bg select-none">
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
        @create-collection="createCollection"
        @create-mode="createMode"
        @context-menu="handleContextMenu"
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
        <!-- 第一碼: 正式版本 -->
        <!-- 第二碼: 測試版本 -->
        <!-- 第三碼: 小修改測試版本 -->
        <Footer 
          version="0.1.2" 
          :github-settings="githubSettings"
          @open-github-settings="isGithubSettingsInAppOpen = true"
          @open-push-modal="pushModalMode = 'push'; isPushModalOpen = true"
          @open-pull-modal="pushModalMode = 'pull'; isPushModalOpen = true"
        />

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
      :active-mode="activeMode"
      :initial-tab="pickerInitialTab"
      @close="closePicker"
      @update:target="handleUpdateTarget"
      @rename="handleRename"
      @update-description="handleUpdateDescription"
      @set-alias="setVariableAlias"
      @detach-alias="detachVariableAlias"
      @value-input="handleValueInput"
      @variable-hover="handleVariableHover"
      @mouse-move="handleMouseMove"
    />


<!-- Tooltip and logic moved to VariableList.vue -->
    
    <!-- GitHub Settings Modal -->
    <GitHubSettingsModal 
      :visible="isGithubSettingsInAppOpen"
      :settings="githubSettings"
      @close="isGithubSettingsInAppOpen = false"
      @save="updateGithubSettings"
      @logout="handleLogout"
    />

    <!-- Push Modal -->
    <PushModal 
      v-if="isPushModalOpen"
      :visible="isPushModalOpen"
      :github-settings="githubSettings"
      :collections="collections"
      :active-collection-index="activeIndex"
      :sync-key="pullSyncKey"
      :mode="pushModalMode"
      @close="isPushModalOpen = false"
      @push="syncPushToGithub"
      @pull="openPullConfirm"
    />

    <PullConfirmModal
      :visible="pullConfirm.visible"
      :collection-name="pullConfirm.collectionName"
      :mode-name="pullConfirm.modeName"
      @close="pullConfirm.visible = false"
      @confirm="confirmPull"
    />

    <!-- Simple Editor for Collections & Modes -->
    <SimpleEditor 
      :visible="simpleEditor.visible"
      :pos="simpleEditor.pos"
      :title="simpleEditor.title"
      :name="simpleEditor.name"
      :value-label="simpleEditor.valueLabel"
      :value="simpleEditor.value"
      :options="simpleEditor.options"
      @close="simpleEditor.visible = false"
      @save="simpleEditor.onSave"
    />

    <!-- Context Menu -->
    <ContextMenu 
      :visible="contextMenu.visible"
      :pos="contextMenu.pos"
      :type="contextMenu.type"
      :delete-disabled="contextMenu.deleteDisabled"
      @close="contextMenu.visible = false"
      @edit="handleEditFromMenu"
      @delete="handleDeleteFromMenu"
      @add-mode="() => createMode(contextMenu.data.collectionName)"
      @duplicate-mode="handleDuplicateFromMenu"
      @duplicate-collection="handleDuplicateCollectionFromMenu"
    />

    <!-- Delete Confirm Modal -->
    <DeleteConfirmModal 
      :visible="deleteModal.visible"
      :item-path="deleteModal.itemPath"
      :item-type="deleteModal.itemType"
      @close="deleteModal.visible = false"
      @confirm="deleteModal.onConfirm"
    />

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
