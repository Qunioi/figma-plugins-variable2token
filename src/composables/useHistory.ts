import { ref, Ref } from 'vue';

export interface HistoryItem {
  variableId: string;
  modeId: string;
  oldValue?: any;
  oldName?: string;
  oldDescription?: string;
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
    const { variableId, modeId, oldValue, oldDescription, oldName, varType } = lastChange.value;

    const postToFigma = (type: string, data: any) => {
      parent.postMessage({ pluginMessage: { type, variableId, ...data } }, '*');
    };

    if (oldValue !== undefined) {
      // Re-use the update logic but without adding to history again
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
