<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { 
  X, 
  GitBranch, 
  CloudUpload, 
  FileJson, 
  Github,
  Check,
  Folder,
  ChevronRight,
  ChevronDown,
  Minus,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Search,
  Download
} from 'lucide-vue-next';

interface Mode {
  modeId: string;
  name: string;
}

interface Collection {
  collectionName: string;
  modes: Mode[];
  variables: any[];
}

interface Props {
  visible: boolean;
  githubSettings: {
    githubAccount?: {
      token: string;
      username: string;
      avatarUrl: string;
    };
    githubRepo?: string;
    githubBranch?: string;
    githubPath?: string;
  };
  collections: Collection[];
  activeCollectionIndex: number;
  syncKey?: number;
  mode?: 'push' | 'pull';
}

import { useVariableLogic } from '../../composables/useVariableLogic';

const props = defineProps<Props>();
const emit = defineEmits(['close', 'push', 'pull']);

const { getMappedType, serializeJson } = useVariableLogic();

const activeTab = ref<'files' | 'commit' | 'diff'>('files');
const commitMessage = ref('從 Figma 更新變數 Token');
const isCommitEdited = ref(false);
const branch = ref(props.githubSettings.githubBranch || 'main');
const lastCommit = ref<{ message: string; author: string; date: string } | null>(null);

// 選中的檔案狀態
const selectedFiles = ref<Record<string, string[]>>({});
const collapsedCollections = ref<Set<string>>(new Set());

// --- Diff 相關狀態 ---
const isCheckingRemote = ref(false);
const remoteContents = ref<Record<string, string>>({}); // path -> content
const diffResults = ref<Record<string, { type: 'new' | 'diff' | 'identical' }>>({});
const activeDiffFile = ref<{ path: string, local: string, remote: string, collectionName: string, modeId: string, modeName: string } | null>(null);

const modalTitle = computed(() => props.mode === 'pull' ? 'Pull from GitHub' : 'Push to GitHub');

onMounted(() => {
  selectedFiles.value = {};
  checkForChanges();
  fetchLatestCommit();
  commitMessage.value = suggestedCommit.value;
});

// 當分支改變時重新檢查
watch(branch, () => {
  checkForChanges();
  fetchLatestCommit();
});

watch(() => props.syncKey, () => {
  checkForChanges();
});

watch(() => props.visible, (visible) => {
  if (visible) {
    selectedFiles.value = {};
    fetchLatestCommit();
  }
});

const getFinalPath = (colName: string, modeName: string) => {
  const collectionPath = colName;
  const fileName = `${modeName}.tokens.json`;
  const githubPath = props.githubSettings.githubPath || 'assets/tokens/';
  return `${githubPath.endsWith('/') ? githubPath : githubPath + '/'}${collectionPath}/${fileName}`.replace(/\/+/g, '/');
};

const getStatusByPath = (path: string) => {
  return diffResults.value[path] || { type: 'new' as const };
};

const getLocalContent = (col: Collection, modeId: string) => {
  return serializeJson(col.variables, modeId);
};

const pruneSyncedSelections = () => {
  const nextSelected: Record<string, string[]> = {};
  props.collections.forEach(col => {
    const selected = selectedFiles.value[col.collectionName] || [];
    const next = selected.filter(modeId => {
      const mode = col.modes.find(m => m.modeId === modeId);
      if (!mode) return false;
      const status = getStatusByPath(getFinalPath(col.collectionName, mode.name));
      return status.type !== 'identical';
    });
    if (next.length > 0) nextSelected[col.collectionName] = next;
  });
  selectedFiles.value = nextSelected;
};

const selectDiffFiles = () => {
  const nextSelected: Record<string, string[]> = {};
  props.collections.forEach(col => {
    const diffModes = col.modes
      .filter(m => getStatusByPath(getFinalPath(col.collectionName, m.name)).type === 'diff')
      .map(m => m.modeId);
    if (diffModes.length > 0) nextSelected[col.collectionName] = diffModes;
  });
  selectedFiles.value = nextSelected;
};

const fetchLatestCommit = async () => {
  const token = props.githubSettings.githubAccount?.token;
  const repo = props.githubSettings.githubRepo;
  const targetBranch = branch.value || props.githubSettings.githubBranch || 'main';

  if (!token || !repo || !targetBranch) {
    lastCommit.value = null;
    return;
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/commits/${targetBranch}`, {
      headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
    });

    if (res.status !== 200) {
      lastCommit.value = null;
      return;
    }

    const data = await res.json();
    const commit = data?.commit;
    lastCommit.value = commit ? {
      message: commit.message || '',
      author: commit.author?.name || 'Unknown',
      date: commit.author?.date || ''
    } : null;
  } catch (e) {
    lastCommit.value = null;
  }
};

const normalizeTokensJson = (raw: string) => {
  try {
    const data = JSON.parse(raw);
    const walk = (node: any): any => {
      if (!node || typeof node !== 'object') return node;
      const result: any = Array.isArray(node) ? [] : {};
      for (const [key, val] of Object.entries(node)) {
        if (key.startsWith('$')) continue;
        if (val && typeof val === 'object') {
          const vObj = val as any;
          if ('value' in vObj || '$value' in vObj) {
            result[key] = {
              value: 'value' in vObj ? vObj.value : vObj.$value,
              type: 'type' in vObj ? vObj.type : vObj.$type
            };
            if ('description' in vObj || '$description' in vObj) {
              const desc = 'description' in vObj ? vObj.description : vObj.$description;
              if (desc) result[key].description = desc;
            }
          } else {
            result[key] = walk(vObj);
          }
        } else {
          result[key] = val;
        }
      }
      return result;
    };

    return JSON.stringify(walk(data), null, 2);
  } catch (e) {
    return raw;
  }
};

const checkForChanges = async () => {
  if (!props.githubSettings.githubAccount?.token || !props.githubSettings.githubRepo) return;
  
  isCheckingRemote.value = true;
  const token = props.githubSettings.githubAccount.token;
  const repo = props.githubSettings.githubRepo;
  
  const newDiffResults: Record<string, any> = {};
  const newRemoteContents: Record<string, string> = {};

  for (const col of props.collections) {
    for (const mode of col.modes) {
      const path = getFinalPath(col.collectionName, mode.name);
      const localJson = getLocalContent(col, mode.modeId);
      
      try {
        const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${branch.value}`, {
          headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        
        if (res.status === 200) {
          const data = await res.json();
          const remoteRaw = decodeURIComponent(escape(atob(data.content)));
          const remoteJson = normalizeTokensJson(remoteRaw);
          newRemoteContents[path] = remoteJson;
          
          if (remoteJson === localJson) {
            newDiffResults[path] = { type: 'identical' };
          } else {
            newDiffResults[path] = { type: 'diff' };
          }
        } else {
          newDiffResults[path] = { type: 'new' };
        }
      } catch (e) {
        newDiffResults[path] = { type: 'new' };
      }
    }
  }
  
  remoteContents.value = newRemoteContents;
  diffResults.value = newDiffResults;
  selectDiffFiles();
  isCheckingRemote.value = false;
};

const openDiff = (col: Collection, mode: Mode) => {
  const path = getFinalPath(col.collectionName, mode.name);
  const status = diffResults.value[path];
  if (!status || status.type === 'identical') return;

  activeDiffFile.value = {
    path: path,
    local: getLocalContent(col, mode.modeId),
    remote: remoteContents.value[path] || '',
    collectionName: col.collectionName,
    modeId: mode.modeId,
    modeName: mode.name
  };
  activeTab.value = 'diff';
};

const toggleFolder = (name: string) => {
  if (collapsedCollections.value.has(name)) {
    collapsedCollections.value.delete(name);
  } else {
    collapsedCollections.value.add(name);
  }
};

const toggleMode = (colName: string, modeId: string) => {
  const col = props.collections.find(c => c.collectionName === colName);
  const mode = col?.modes.find(m => m.modeId === modeId);
  if (col && mode) {
    const status = getStatusByPath(getFinalPath(colName, mode.name));
    if (status.type === 'identical') return;
  }
  if (!selectedFiles.value[colName]) {
    selectedFiles.value[colName] = [];
  }
  const index = selectedFiles.value[colName].indexOf(modeId);
  if (index > -1) {
    selectedFiles.value[colName].splice(index, 1);
  } else {
    selectedFiles.value[colName].push(modeId);
  }
};

const toggleCollection = (col: Collection) => {
  const selectableModes = col.modes.filter(m => getStatusByPath(getFinalPath(col.collectionName, m.name)).type !== 'identical');
  if (selectableModes.length === 0) return;
  const currentSelected = selectedFiles.value[col.collectionName] || [];
  if (currentSelected.length === selectableModes.length) {
    selectedFiles.value[col.collectionName] = [];
  } else {
    selectedFiles.value[col.collectionName] = selectableModes.map(m => m.modeId);
  }
};

const getCollectionState = (col: Collection) => {
  const selectableModes = col.modes.filter(m => getStatusByPath(getFinalPath(col.collectionName, m.name)).type !== 'identical');
  const selected = selectedFiles.value[col.collectionName] || [];
  if (selectableModes.length === 0) return 'none';
  if (selected.length === 0) return 'none';
  if (selected.length === selectableModes.length) return 'all';
  return 'some';
};

const isModeSelected = (colName: string, modeId: string) => {
  return selectedFiles.value[colName]?.includes(modeId);
};

const getDiffStatus = (colName: string, modeName: string) => {
  const path = getFinalPath(colName, modeName);
  return getStatusByPath(path);
};

const handlePull = async (col: Collection, mode: Mode) => {
  const path = getFinalPath(col.collectionName, mode.name);

  let remote = remoteContents.value[path];
  if (!remote) {
    const token = props.githubSettings.githubAccount?.token;
    const repo = props.githubSettings.githubRepo;
    const targetBranch = branch.value || props.githubSettings.githubBranch || 'main';

    if (!token || !repo) return;

    try {
      const res = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${targetBranch}`, {
        headers: { 'Authorization': `token ${token}`, 'Accept': 'application/vnd.github.v3+json' }
      });

      if (res.status !== 200) return;

      const data = await res.json();
      remote = decodeURIComponent(escape(atob(data.content)));
      remoteContents.value[path] = remote;
    } catch (e) {
      console.error('Failed to fetch remote content for pull:', e);
      return;
    }
  }

  if (!remote) return;

  emit('pull', {
    collectionName: col.collectionName,
    modeId: mode.modeId,
    tokensJson: remote,
    modeName: mode.name
  });
};

const handlePullFromDiff = () => {
  if (!activeDiffFile.value) return;
  handlePull(
    { collectionName: activeDiffFile.value.collectionName, modes: [{ modeId: activeDiffFile.value.modeId, name: activeDiffFile.value.modeName }], variables: [] },
    { modeId: activeDiffFile.value.modeId, name: activeDiffFile.value.modeName }
  );
};

const totalSelectedCount = computed(() => {
  return Object.values(selectedFiles.value).reduce((sum, modes) => sum + modes.length, 0);
});

const suggestedCommit = computed(() => {
  const parts: string[] = [];
  props.collections.forEach(col => {
    const selected = selectedFiles.value[col.collectionName] || [];
    if (selected.length === 0) return;
    const modeNames = selected
      .map(id => col.modes.find(m => m.modeId === id)?.name)
      .filter(Boolean) as string[];
    if (modeNames.length > 0) {
      parts.push(`${col.collectionName}(${modeNames.join(', ')})`);
    }
  });

  if (parts.length === 0) return '從 Figma 更新變數 Token';
  return `更新 tokens：${parts.join('; ')}`;
});

watch(commitMessage, (val) => {
  if (val !== suggestedCommit.value) {
    isCommitEdited.value = true;
  }
});

watch([selectedFiles, diffResults], () => {
  if (!isCommitEdited.value) {
    commitMessage.value = suggestedCommit.value;
  }
}, { deep: true });

const hasActualChangesSelected = computed(() => {
  let hasChanges = false;
  props.collections.forEach(col => {
    const selectedModes = selectedFiles.value[col.collectionName] || [];
    selectedModes.forEach(modeId => {
      const mode = col.modes.find(m => m.modeId === modeId);
      if (mode) {
        const status = getDiffStatus(col.collectionName, mode.name);
        if (status.type !== 'identical') hasChanges = true;
      }
    });
  });
  return hasChanges;
});

// --- Simple Line Diffing Logic ---
const diffLines = computed(() => {
  if (!activeDiffFile.value) return [];
  const oldLines = activeDiffFile.value.remote.split('\n');
  const newLines = activeDiffFile.value.local.split('\n');
  
  // 這裡使用一個極簡的對照方式 (僅呈現新舊內容，不進行複雜的 LCS 演算法)
  // 如果是全新檔案
  if (!activeDiffFile.value.remote) {
    return newLines.map(line => ({ type: 'add', content: line }));
  }

  // 為了呈現，我們這裡做一個簡單的對位顯示
  const result: { type: 'add' | 'remove' | 'same', content: string }[] = [];
  const maxLines = Math.max(oldLines.length, newLines.length);
  
  for(let i = 0; i < maxLines; i++) {
    if (oldLines[i] === newLines[i]) {
      result.push({ type: 'same', content: oldLines[i] });
    } else {
      if (oldLines[i] !== undefined) result.push({ type: 'remove', content: oldLines[i] });
      if (newLines[i] !== undefined) result.push({ type: 'add', content: newLines[i] });
    }
  }
  return result;
});

const handlePush = () => {
  if (totalSelectedCount.value === 0) return;
  
  const tasks: any[] = [];
  props.collections.forEach(col => {
    const selectedModes = selectedFiles.value[col.collectionName] || [];
    selectedModes.forEach(modeId => {
      const mode = col.modes.find(m => m.modeId === modeId);
      if (mode) {
        tasks.push({
          path: getFinalPath(col.collectionName, mode.name),
          content: getLocalContent(col, mode.modeId),
          collectionName: col.collectionName,
          modeName: mode.name
        });
      }
    });
  });

  emit('push', {
    message: commitMessage.value,
    branch: branch.value,
    tasks: tasks
  });
};
</script>

<template>
  <transition name="modal">
    <div v-if="visible" class="fixed inset-0 z-[10000] flex items-center justify-center p-6 text-white/90">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="$emit('close')"></div>
      
      <div class="relative w-full max-w-[540px] bg-[#1E1E1E] border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
        <!-- 標題 -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/5">
          <div class="flex items-center gap-2">
            <span class="text-[13px] font-bold font-mono">{{ modalTitle }}</span>
          </div>
          <button @click="$emit('close')" class="p-1 hover:bg-white/10 rounded-md transition-colors">
            <X :size="16" class="text-white/40" />
          </button>
        </div>

        <!-- 頁籤 (不含 Diff 頁籤，Diff 是覆蓋上去的暫時狀態) -->
        <div v-if="activeTab !== 'diff'" class="px-4 pt-3 flex items-center gap-1 border-b border-white/5 bg-white/[0.02]">
          <button 
            @click="activeTab = 'files'"
            class="px-4 py-1.5 text-[11px] font-medium rounded-t-lg transition-all border-b-2"
            :class="activeTab === 'files' ? 'text-figma-accent border-figma-accent bg-figma-accent/5' : 'text-white/40 border-transparent hover:text-white/60'"
          >
            選擇變數集合 ({{ totalSelectedCount }})
          </button>
          <button 
            @click="activeTab = 'commit'"
            class="px-4 py-1.5 text-[11px] font-medium rounded-t-lg transition-all border-b-2"
            :class="activeTab === 'commit' ? 'text-figma-accent border-figma-accent bg-figma-accent/5' : 'text-white/40 border-transparent hover:text-white/60'"
          >
            提交資訊
          </button>
          
          <div v-if="isCheckingRemote" class="ml-auto flex items-center gap-2 pr-2 animate-pulse">
            <Loader2 :size="10" class="animate-spin text-figma-accent" />
            <span class="text-[9px] text-figma-accent/60 uppercase font-bold tracking-tighter">Comparing...</span>
          </div>
        </div>

        <!-- 內容 -->
        <div class="flex flex-col min-h-[300px] max-h-[calc(100vh-120px)] overflow-hidden">
          
          <!-- 1. 檔案清單 -->
          <div v-if="activeTab === 'files'" class="flex-1 overflow-y-auto p-2 flex flex-col custom-scrollbar bg-black/10">
            <div v-for="col in collections" :key="col.collectionName" class="mb-1">
              <div class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group cursor-pointer" @click="toggleFolder(col.collectionName)">
                <div class="w-4 h-4 flex items-center justify-center">
                  <ChevronDown v-if="!collapsedCollections.has(col.collectionName)" :size="14" class="text-white/20 group-hover:text-white/60" />
                  <ChevronRight v-else :size="14" class="text-white/20 group-hover:text-white/60" />
                </div>
                <div @click.stop="toggleCollection(col)" class="w-4 h-4 rounded border flex items-center justify-center transition-all bg-black/40"
                  :class="getCollectionState(col) !== 'none' ? 'bg-white border-white' : 'border-white/10 group-hover:border-white/20'">
                  <Check v-if="getCollectionState(col) === 'all'" :size="10" class="text-black" strokeWidth="4" />
                  <Minus v-else-if="getCollectionState(col) === 'some'" :size="10" class="text-black" strokeWidth="4" />
                </div>
                <Folder :size="14" class="text-white/60" />
                <span class="text-[12px] font-medium text-white/80">{{ col.collectionName }}</span>
              </div>

              <!-- Modes -->
              <div v-if="!collapsedCollections.has(col.collectionName)" class="ml-6 flex flex-col gap-0.5 mt-0.5 border-l border-white/5 pl-2">
                <div v-for="mode in col.modes" :key="mode.modeId" @click="toggleMode(col.collectionName, mode.modeId)"
                  class="flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer group"
                  :class="getDiffStatus(col.collectionName, mode.name).type === 'identical' ? 'opacity-40 cursor-not-allowed' : 'hover:bg-white/5'"
                >
                  <div class="w-4 h-4 rounded border flex items-center justify-center transition-all bg-black/40 shrink-0"
                    :class="[
                      isModeSelected(col.collectionName, mode.modeId) ? 'bg-white border-white' : 'border-white/10 group-hover:border-white/20',
                      getDiffStatus(col.collectionName, mode.name).type === 'identical' ? 'opacity-40' : ''
                    ]">
                    <Check v-if="isModeSelected(col.collectionName, mode.modeId)" :size="10" class="text-black" strokeWidth="4" />
                  </div>
                  <FileJson :size="14" class="opacity-50" />
                  <span class="text-[12px] flex-1" :class="isModeSelected(col.collectionName, mode.modeId) ? 'text-white' : 'text-white/40'">{{ mode.name }}</span>
                  
                  <div class="flex items-center gap-2">
                    <button
                      v-if="getDiffStatus(col.collectionName, mode.name).type === 'diff'"
                      @click.stop="handlePull(col, mode)"
                      class="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide transition-all translate-y-0 active:translate-y-px bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20"
                      title="套用遠端版本"
                    >
                      <span class="inline-flex items-center gap-1">
                        <Download :size="10" /> Pull
                      </span>
                    </button>
                    <div
                      v-if="getDiffStatus(col.collectionName, mode.name).type !== 'new' || (props.mode === 'push' && !isCheckingRemote)"
                      @click.stop="openDiff(col, mode)"
                      class="px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide transition-all translate-y-0 active:translate-y-px"
                      :class="{
                        'bg-green-500/10 text-green-400 border border-green-500/20 cursor-pointer hover:bg-green-500/20': getDiffStatus(col.collectionName, mode.name).type === 'new',
                        'bg-amber-500/10 text-red-400 border border-amber-500/20 cursor-pointer hover:bg-amber-500/20': getDiffStatus(col.collectionName, mode.name).type === 'diff',
                        'bg-white/5 text-white/20 pointer-events-none': getDiffStatus(col.collectionName, mode.name).type === 'identical'
                      }"
                    >
                      {{ getDiffStatus(col.collectionName, mode.name).type === 'identical' ? 'Synced' : getDiffStatus(col.collectionName, mode.name).type }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. 提交資訊 -->
          <div v-if="activeTab === 'commit'" class="flex-1 p-5 flex flex-col gap-6 animate-in slide-in-from-bottom-2 duration-300">
             <div class="space-y-2">
              <label class="text-[10px] font-bold text-white/60 uppercase tracking-widest px-1">Repo Target</label>
              <div class="bg-figma-accent/5 border border-figma-accent/10 px-3 py-2.5 rounded-lg text-[12px] flex items-center gap-2">
                <Github :size="14" class="opacity-50" />
                {{ githubSettings.githubRepo }}
              </div>
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-bold text-white/60 uppercase tracking-widest px-1">Commit Message</label>
              <textarea v-model="commitMessage" class="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-[12px] focus:border-figma-accent/50 focus:outline-none min-h-[120px] resize-none"></textarea>
            </div>
            <div class="space-y-2">
              <label class="text-[10px] font-bold text-white/60 uppercase tracking-widest px-1">Branch</label>
              <div class="relative">
                <GitBranch :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                <input 
                  v-model="branch" 
                  class="w-full bg-black/40 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-[12px] focus:border-figma-accent/50 focus:outline-none" 
                  :title="lastCommit ? `Last commit: ${lastCommit.message}\nBy: ${lastCommit.author}\nAt: ${lastCommit.date}` : ''"
                />
              </div>
            </div>
          </div>

          <!-- 3. Diff View -->
          <div v-if="activeTab === 'diff' && activeDiffFile" class="flex-1 overflow-hidden flex flex-col bg-[#0d0d0d] animate-in fade-in duration-300">
            <div class="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
              <div class="flex items-center gap-2 text-[11px]">
                <button @click="activeTab = 'files'" class="p-1 hover:bg-white/10 rounded-md -ml-1 transition-colors">
                  <ArrowLeft :size="14" />
                </button>
                <span class="text-white/40 uppercase font-bold tracking-widest text-[9px]">DIFFERENCE:</span>
                <span class="text-indigo-400 font-mono">{{ activeDiffFile.path.split('/').pop() }}</span>
                <button
                  @click="handlePullFromDiff"
                  class="ml-2 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide transition-all bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20"
                  title="套用遠端版本"
                >
                  <span class="inline-flex items-center gap-1">
                    <Download :size="10" /> Pull
                  </span>
                </button>
              </div>
              <div class="flex gap-4 text-[9px] uppercase font-bold">
                 <div class="flex items-center gap-1.5 text-red-400/60"><div class="w-2 h-2 bg-red-500/20 border border-red-500/40 rounded-sm"></div> REMOTE</div>
                 <div class="flex items-center gap-1.5 text-green-400/60"><div class="w-2 h-2 bg-green-500/20 border border-green-500/40 rounded-sm"></div> LOCAL</div>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto p-4 font-mono text-[11px] custom-scrollbar leading-relaxed bg-black/40">
              <div v-for="(line, idx) in diffLines" :key="idx" 
                class="flex gap-3 px-2 border-l-2"
                :class="{
                  'bg-green-500/10 border-green-500/50 text-green-400/90': line.type === 'add',
                  'bg-red-500/10 border-red-500/40 text-red-400/70': line.type === 'remove',
                  'border-transparent text-white/20': line.type === 'same'
                }"
              >
                <div class="w-6 text-right select-none opacity-30">{{ idx + 1 }}</div>
                <div class="w-4 select-none opacity-50">{{ line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ' }}</div>
                <pre class="whitespace-pre-wrap flex-1">{{ line.content }}</pre>
              </div>
            </div>
          </div>

        </div>
        
        <!-- 下方列 -->
        <div class="p-4 bg-white/5 border-t border-white/5 flex items-center justify-between">
          <div v-if="activeTab === 'diff'" class="text-[11px] text-white/40 italic">
             正在瀏覽變更內容，您可以點擊左上角返回
          </div>
          <div v-else-if="!hasActualChangesSelected && totalSelectedCount > 0" class="flex items-center gap-2 text-amber-400/80">
            <AlertCircle :size="14" />
            <span class="text-[10px] font-medium">內容與遠端一致</span>
          </div>
          <div v-else class="flex flex-col">
            <span class="text-[10px] text-white/40">Ready to Deploy</span>
            <span class="text-[13px] font-bold">{{ totalSelectedCount }} <span class="text-[10px] font-normal opacity-30">files</span></span>
          </div>
          
          <div class="flex gap-2">
            <button @click="$emit('close')" class="px-4 py-2 rounded-lg text-[11px] font-bold text-white/40 hover:bg-white/5 transition-all active:scale-[0.98]">Cancel</button>
            <button 
              v-if="activeTab !== 'diff'"
              @click="handlePush"
              :disabled="totalSelectedCount === 0 || (!hasActualChangesSelected)"
              class="bg-figma-accent text-black/70 px-6 py-2 rounded-lg text-[12px] font-bold hover:bg-figma-accent/80 active:scale-[0.98] transition-all flex items-center gap-2 disabled:opacity-20 disabled:grayscale"
            >
              <CloudUpload :size="16" />
              Push
            </button>
            <button v-else @click="activeTab = 'files'" class="bg-white/10 px-6 py-2 rounded-lg text-[11px] font-bold hover:bg-white/20 transition-all active:scale-[0.98]">
              Back to List
            </button>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .relative, .modal-leave-to .relative { transform: scale(0.95); opacity: 0; }
.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
</style>
