import { ref, Ref } from 'vue';

export interface HistoryItem {
  variableId: string;
  modeId: string;
  oldValue?: any;
  oldName?: string;
  oldDescription?: string;
  oldAlias?: { id: string; name: string } | null; // null 表示無 alias，undefined 表示未變更
  varType: string;
  label: string;
}

export function useHistory(
  collections: Ref<any[]>,
  activeMode: Ref<string | null>,
  pickerTarget: Ref<any | null>,
  showToastWithTimer: (msg: string) => void
) {
  const lastChange = ref<HistoryItem | null>(null);

  const setLastChange = (item: HistoryItem) => {
    lastChange.value = item;
  };

  const undoLastChange = () => {
    if (!lastChange.value) return;
    const { variableId, modeId, oldValue, oldDescription, oldName, oldAlias, varType } = lastChange.value;

    const postToFigma = (type: string, data: any) => {
      parent.postMessage({ pluginMessage: { type, variableId, ...data } }, '*');
    };

    // 如果之前有 alias，需要恢復 alias 連結
    if (oldAlias !== undefined) {
      if (oldAlias) {
        // 恢復 alias 連結
        postToFigma('set-variable-alias', { modeId, targetVariableId: oldAlias.id });
      } else if (oldValue !== undefined) {
        // 之前沒有 alias，只恢復純色值
        postToFigma('update-variable', { modeId, newValue: oldValue, varType });
      }
    } else if (oldValue !== undefined) {
      // 沒有 alias 變更，只恢復值
      postToFigma('update-variable', { modeId, newValue: oldValue, varType });
    }

    if (oldName !== undefined) {
      postToFigma('update-name', { newName: oldName });
      
      // Update local data
      const coll = collections.value.find((c: any) => c.variables.some((v: any) => v.id === variableId));
      if (coll) {
        const variable = coll.variables.find((v: any) => v.id === variableId);
        if (variable) variable.name = oldName;
      }
      
      // Sync picker if open
      if (pickerTarget.value && pickerTarget.value.id === variableId) {
        pickerTarget.value.name = oldName;
      }
    }

    if (oldDescription !== undefined) {
      postToFigma('update-description', { description: oldDescription });

      // Update local data
      const coll = collections.value.find((c: any) => c.variables.some((v: any) => v.id === variableId));
      if (coll) {
        const variable = coll.variables.find((v: any) => v.id === variableId);
        if (variable) variable.description = oldDescription;
      }
    }

    showToastWithTimer("Restored previous state");
    lastChange.value = null;
  };

  return {
    lastChange,
    setLastChange,
    undoLastChange
  };
}
