<script setup lang="ts">
import { 
  GitBranch, 
  Download, 
  Upload, 
  ExternalLink,
  Github
} from 'lucide-vue-next';

interface Props {
  version: string;
  githubSettings: {
    githubAccount?: {
      username: string;
      avatarUrl: string;
    };
    githubRepo?: string;
    githubBranch?: string;
  };
}

defineProps<Props>();
const emit = defineEmits(['open-github-settings', 'open-push-modal', 'pull']);
</script>

<template>
  <footer class="h-10 border-t border-white/5 flex items-center justify-between px-3 bg-[#1A1A1A] select-none shrink-0 z-50">
    <!-- Left: Branch & Repo Info -->
    <div class="flex items-center gap-3">
      <div 
        v-if="githubSettings.githubAccount"
        class="flex items-center gap-2 px-2 py-1 rounded bg-white/[0.03] border border-white/5 hover:border-figma-accent/30 transition-all cursor-pointer group"
        @click="$emit('open-github-settings')"
      >
        <GitBranch :size="12" class="text-figma-accent" />
        <span class="text-[11px] font-medium text-white/50 group-hover:text-white/80 transition-colors">
          {{ githubSettings.githubBranch || 'main' }}
        </span>
      </div>
      
      <div class="flex items-center gap-1.5 ml-1">
        <button 
          v-if="githubSettings.githubAccount"
          @click="$emit('pull')"
          class="p-1.5 text-white/30 hover:text-white hover:bg-white/5 rounded transition-all"
          title="從 GitHub 下載 (Pull)"
        >
          <Download :size="13" />
        </button>
        <button 
          v-if="githubSettings.githubAccount"
          @click="$emit('open-push-modal')"
          class="p-1.5 text-white/30 hover:text-figma-accent hover:bg-figma-accent/5 rounded transition-all"
          title="推送到 GitHub (Push)"
        >
          <Upload :size="13" />
        </button>
      </div>
    </div>

    <!-- Right: Version & Profile -->
    <div class="flex items-center gap-4">
      <div class="flex items-center gap-2">
        <div v-if="githubSettings.githubAccount" class="flex items-center gap-2 group cursor-pointer" @click="$emit('open-github-settings')">
          <img :src="githubSettings.githubAccount.avatarUrl" class="w-4 h-4 rounded-full ring-1 ring-white/10" />
          <span class="text-[10px] text-white/30 group-hover:text-white/60 transition-colors">{{ githubSettings.githubAccount.username }}</span>
        </div>
        <div v-else class="text-[10px] text-white/20 flex items-center gap-1 cursor-pointer hover:text-white/40" @click="$emit('open-github-settings')">
          <Github :size="10" />
          <span>未連動帳號</span>
        </div>
      </div>

      <div class="h-3 w-[1px] bg-white/5"></div>

      <div class="flex items-center gap-2 opacity-30 hover:opacity-100 transition-opacity">
        <span class="text-[10px]">V{{ version }}</span>
        <div class="w-1 h-1 rounded-full bg-figma-accent shadow-[0_0_4px_rgba(24,160,251,0.5)]"></div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
footer {
  box-shadow: 0 -2px 10px rgba(0,0,0,0.2);
}
</style>
