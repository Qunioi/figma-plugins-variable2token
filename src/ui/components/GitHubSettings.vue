<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { 
  Github, 
  X, 
  Save, 
  ExternalLink,
  ShieldCheck,
  FolderLock,
  LogOut,
  User,
  Check,
  Loader2,
  Trash2,
  HelpCircle,
  GitBranch
} from 'lucide-vue-next';

interface Props {
  visible: boolean;
  settings: {
    githubAccount?: {
      token: string;
      username: string;
      avatarUrl: string;
    };
    githubRepo?: string;
    githubPath?: string;
  };
}

const props = defineProps<Props>();
const emit = defineEmits(['close', 'save', 'logout']);

const inputToken = ref('');
const isValidating = ref(false);
const localSettings = ref({
  githubRepo: props.settings.githubRepo || '',
  githubPath: props.settings.githubPath || 'assets/tokens/',
  githubBranch: (props.settings as any).githubBranch || 'main'
});

// 當視窗開啟時，確保資料與全域同步
watch(() => props.visible, (isShown) => {
  if (isShown) {
    localSettings.value = {
      githubRepo: props.settings.githubRepo || '',
      githubPath: props.settings.githubPath || 'assets/tokens/',
      githubBranch: (props.settings as any).githubBranch || 'main'
    };
  }
});

// 魔法連結：預填描述並勾選 repo 權限
const MAGIC_LINK = "https://github.com/settings/tokens/new?description=Figma_Variable2Token&scopes=repo";

const validateAndLogin = async () => {
  const token = inputToken.value.trim();
  if (!token) return;
  isValidating.value = true;
  
  try {
    const res = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    
    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.message || `HTTP ${res.status}`);
    }
    
    const userData = await res.json();
    
    emit('save', {
      ...localSettings.value,
      githubAccount: {
        token: token,
        username: userData.login,
        avatarUrl: userData.avatar_url
      }
    });
    inputToken.value = '';
  } catch (err: any) {
    let errorMsg = err.message;
    if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      errorMsg = "無法連接到 GitHub (網路錯誤)。請檢查 manifest.json 是否已允許 api.github.com，或您的網路環境是否有防火牆攔截。";
    }
    alert(`連動失敗：${errorMsg}\n\n請確保 Token 符合以下條件：\n1. 以 'ghp_' 開頭\n2. 具備 'repo' 權限\n3. Token 尚未過期`);
  } finally {
    isValidating.value = false;
  }
};

const handleSaveRepo = () => {
  emit('save', { ...localSettings.value });
};
</script>

<template>
  <transition name="modal">
    <div v-if="visible" class="fixed inset-0 z-[10000] flex items-center justify-center p-6">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="$emit('close')"></div>
      
      <div class="relative w-full max-w-[400px] bg-[#1E1E1E] border border-white/5 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden text-white/90">
        <!-- 標題 -->
        <div class="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/5">
          <div class="flex items-center gap-2">
            <Github :size="16" class="text-white/80" />
            <span class="text-[13px] font-bold">GitHub 同步設定</span>
          </div>
          <button @click="$emit('close')" class="p-1 hover:bg-white/10 rounded-md transition-colors">
            <X :size="16" class="text-white/40" />
          </button>
        </div>
        
        <div class="p-5 flex flex-col gap-6">
          <!-- 帳號連動區塊 -->
          <div class="flex flex-col gap-3">
            <label class="text-[11px] font-bold text-white/40 uppercase tracking-widest px-1">帳號連動</label>
            
            <!-- 已登入狀態 -->
            <div v-if="settings.githubAccount" class="flex items-center gap-4 bg-white/5 p-4 rounded-xl border border-white/5">
              <img :src="settings.githubAccount.avatarUrl" class="w-12 h-12 rounded-full ring-2 ring-figma-accent/10 object-cover" />
              <div class="flex-1 min-w-0">
                <div class="text-[14px] font-bold text-white flex items-center gap-1.5">
                  {{ settings.githubAccount.username }}
                  <Check :size="12" class="text-figma-accent" />
                </div>
                <div class="text-[11px] text-white/40 italic">已成功連動 GitHub 帳號</div>
              </div>
              <button @click="$emit('logout')" class="p-2 hover:bg-red-500/10 text-red-400/60 hover:text-red-400 rounded-lg transition-colors" title="中斷帳號連動">
                <LogOut :size="16" />
              </button>
            </div>

            <!-- 未登入狀態：流程引導 -->
            <div v-else class="flex flex-col gap-4">
              <div class="bg-white/[0.03] p-4 rounded-xl border border-white/5 flex flex-col gap-3">
                <div class="flex items-start gap-3">
                  <div class="w-6 h-6 rounded-full bg-figma-accent/20 text-figma-accent flex items-center justify-center text-[12px] font-bold shrink-0">1</div>
                  <div class="flex-1">
                    <div class="text-[12px] font-medium">生成您的魔法 Token</div>
                    <a :href="MAGIC_LINK" target="_blank" class="text-[11px] text-figma-accent hover:underline flex items-center gap-1 mt-1 font-medium">
                      點此前往 GitHub 自動生成 <ExternalLink :size="10" />
                    </a>
                  </div>
                </div>
                <div class="w-px h-2 bg-white/10 ml-3"></div>
                <div class="flex items-start gap-3">
                  <div class="w-6 h-6 rounded-full bg-figma-accent/20 text-figma-accent flex items-center justify-center text-[12px] font-bold shrink-0">2</div>
                  <div class="flex-1">
                    <div class="text-[12px] font-medium">貼上並進行連動</div>
                    <div class="flex gap-2 mt-2">
                       <input 
                        v-model="inputToken"
                        type="password"
                        placeholder="在此貼上 ghp_ 開頭的字串"
                        class="flex-1 bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white focus:border-figma-accent focus:outline-none placeholder:text-white/10"
                      />
                      <button 
                        @click="validateAndLogin"
                        :disabled="isValidating || !inputToken"
                        class="bg-figma-accent text-white px-3 py-1.5 rounded-lg text-[11px] font-bold hover:brightness-110 disabled:opacity-30 flex items-center gap-1"
                      >
                        <Loader2 v-if="isValidating" :size="12" class="animate-spin" />
                        <span v-else>連動</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 倉庫設定區塊 -->
          <div class="flex flex-col gap-4" :class="{ 'opacity-20 pointer-events-none': !settings.githubAccount }">
            <label class="text-[11px] font-bold text-white/40 uppercase tracking-widest px-1">倉庫與路徑設定</label>
            
            <div class="grid grid-cols-1 gap-4">
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2 px-1 text-[11px] text-white/40">
                  <Github :size="12" /> 目標倉庫 (帳號/名稱)
                </div>
                <input 
                  v-model="localSettings.githubRepo"
                  type="text"
                  placeholder="例如：quni/my-tokens"
                  class="w-full bg-black/30 border border-white/5 rounded-lg px-3 py-2 text-[12px] focus:border-figma-accent focus:outline-none transition-all placeholder:text-white/10"
                />
              </div>

              <div class="flex flex-col gap-2">
                <div class="flex items-center justify-between px-1">
                  <div class="flex items-center gap-2 text-[11px] text-white/40">
                    <FolderLock :size="12" /> JSON 文件路徑
                  </div>
                  <div class="group relative">
                    <HelpCircle :size="12" class="text-white/20 cursor-help" />
                    <div class="absolute bottom-full right-0 mb-2 w-48 p-2 bg-black border border-white/10 rounded text-[10px] text-white/60 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 leading-relaxed shadow-xl">
                      定義檔案儲存在 GitHub 中的位置。<br/>例如：`tokens.json` 或 `data/tokens.json`
                    </div>
                  </div>
                </div>
                <input 
                  v-model="localSettings.githubPath"
                  type="text"
                  placeholder="例如：tokens.json"
                  class="w-full bg-black/30 border border-white/5 rounded-lg px-3 py-2 text-[12px] focus:border-figma-accent focus:outline-none transition-all placeholder:text-white/10"
                />
              </div>

              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2 px-1 text-[11px] text-white/40">
                  <GitBranch :size="12" /> 預設分支 (Branch)
                </div>
                <input 
                  v-model="localSettings.githubBranch"
                  type="text"
                  placeholder="例如：main"
                  class="w-full bg-black/30 border border-white/5 rounded-lg px-3 py-2 text-[12px] focus:border-figma-accent focus:outline-none transition-all placeholder:text-white/10"
                />
              </div>
            </div>
          </div>
        </div>
        
        <!-- 底部按鈕 -->
        <div class="p-4 bg-white/5 border-t border-white/5 flex gap-2">
          <button 
            @click="handleSaveRepo"
            :disabled="!settings.githubAccount"
            class="w-full bg-figma-accent text-white h-10 rounded-xl text-[13px] font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-30 shadow-lg shadow-figma-accent/10"
          >
            <Save :size="16" />
            儲存目前設定
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.modal-enter-active, .modal-leave-active { transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1); }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .relative, .modal-leave-to .relative { transform: scale(0.96) translateY(10px); opacity: 0; }
</style>
