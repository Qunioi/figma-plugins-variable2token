/// <reference types="@figma/plugin-typings" />

// 顯示 UI
figma.showUI(__html__, { width: 800, height: 640, themeColors: true });

// 解析變數值 (處理 Alias)，防止無窮迴圈
async function resolveValue(value: any, modeId: string, visited: Set<string> = new Set()): Promise<string> {
  if (!value) return "";
  
  // 如果是 Alias
  if (value.type === 'VARIABLE_ALIAS') {
    if (visited.has(value.id)) return "Circular Ref"; // 防止無窮迴圈
    visited.add(value.id);

    const aliasedVar = await figma.variables.getVariableByIdAsync(value.id);
    if (!aliasedVar) return "Link Broken";
    
    // 嘗試取得 Alias 目標變數在相同 Mode 下的值，若無則取第一個 Mode
    const aliasedModeId = aliasedVar.valuesByMode[modeId] ? modeId : Object.keys(aliasedVar.valuesByMode)[0];
    return resolveValue(aliasedVar.valuesByMode[aliasedModeId], aliasedModeId, visited);
  }

  // 根據型別格式化
  if (value && typeof value === 'object') {
    if ('r' in value) return figmaColorToHex(value);
    // 預留其他物件類型的處理
  }
  
  return String(value);
}

// 顏色轉換函式：Figma RGB 轉 HEX
function figmaColorToHex(color: RGB | RGBA): string {
  if (!color) return "";
  const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
  const a = (color as RGBA).a !== undefined 
    ? Math.round((color as RGBA).a * 255).toString(16).padStart(2, '0') 
    : "FF";
  return `#${r}${g}${b}${a}`.toUpperCase();
}

// 顏色轉換函式：將各種格式轉為 Figma RGB/RGBA
function parseToFigmaColor(input: string): RGB | RGBA {
  if (input.startsWith('rgba')) {
    const match = input.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      return {
        r: parseInt(match[1]) / 255,
        g: parseInt(match[2]) / 255,
        b: parseInt(match[3]) / 255,
        a: match[4] ? parseFloat(match[4]) : 1
      };
    }
  }

  let hex = input.replace('#', '');
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('');
  }
  
  const r = parseInt(hex.substring(0, 2), 16) / 255 || 0;
  const g = parseInt(hex.substring(2, 4), 16) / 255 || 0;
  const b = parseInt(hex.substring(4, 6), 16) / 255 || 0;
  
  if (hex.length === 8) {
    const a = parseInt(hex.substring(6, 8), 16) / 255;
    return { r, g, b, a };
  }
  
  return { r, g, b };
}

// 兼容不同 API 版本的 createVariable
function createVariableCompat(
  name: string,
  collection: VariableCollection,
  resolvedType: VariableResolvedDataType
): Variable {
  try {
    return (figma.variables as any).createVariable(name, collection, resolvedType) as Variable;
  } catch (err) {
    return figma.variables.createVariable(name, collection.id, resolvedType) as Variable;
  }
}

// 核心邏輯：讀取所有可用變數
async function refreshVariables() {
  try {
    // 1. 取得本地集合
    const local = await figma.variables.getLocalVariableCollectionsAsync();
    
    // 2. 取得引用集合 (Libraries)
    let imported = [];
    try {
        if (typeof (figma.variables as any).getImportedVariableCollectionsAsync === 'function') {
            imported = await (figma.variables as any).getImportedVariableCollectionsAsync();
        } else {
            console.warn("getImportedVariableCollectionsAsync is not a function in this version.");
        }
    } catch (e) {
        console.error("Failed to load imported collections:", e);
    }
    
    // 3. 取得「已開啟但未引用」的 Library (提示用)
    let availableLibs: any[] = [];
    try {
        // 先檢查 teamLibrary 物件和方法是否存在
        // 注意：有些環境下 figma.teamLibrary 可能未定義
        const teamLib = (figma as any).teamLibrary;
        if (teamLib && typeof teamLib.getAvailableLibraryVariableCollectionsAsync === 'function') {
            availableLibs = await teamLib.getAvailableLibraryVariableCollectionsAsync();
        }
    } catch (e) {
        console.log("Team Library API unavailable:", e);
    }
    
    console.log("Scanning Collections:", {
        Local: local.length, 
        Imported: imported.length, 
        Available: availableLibs.length
    });

    // 合併所有的集合 (包含本地、已匯入、未匯入)
    const result = [];
    
    // 建立已匯入的 Key Set 以便過濾
    const importedKeys = new Set(imported.map((c: any) => c.key));

    // A. 處理已載入的集合 (已匯入 + 本地)
    const loadedCollections = [...local, ...imported];
    
    for (const col of loadedCollections) {
      const resolvedVars = [];
      const varIds = col.variableIds || [];
      const modes = col.modes || []; // 取得該集合的所有模式
      
      for(const id of varIds) {
          try {
              const v = await figma.variables.getVariableByIdAsync(id);
              if(v) {
                  const resolvedType = v.resolvedType === 'FLOAT' ? 'NUMBER' : v.resolvedType;

                  // 抓取所有模式的值
                  const valuesByMode = [];
                  for (const mode of modes) {
                    const rawVal = v.valuesByMode[mode.modeId];
                    let resolvedVal: any = "N/A";
                    let alias = null;
                    if (rawVal !== undefined) {
                        try {
                           resolvedVal = await resolveValue(rawVal, mode.modeId);
                           if (rawVal && typeof rawVal === 'object' && 'type' in rawVal && rawVal.type === 'VARIABLE_ALIAS') {
                               const targetVar = await figma.variables.getVariableByIdAsync(rawVal.id);
                               alias = { id: rawVal.id, name: targetVar ? targetVar.name : 'Unknown' };
                           }
                        } catch (e) {
                           resolvedVal = "Error";
                        }
                    }

                    // Normalize Boolean values
                    let normalizedVal = resolvedVal;
                    if (resolvedType === 'BOOLEAN' && resolvedVal !== "N/A" && resolvedVal !== "Error") {
                      // 確保 Boolean 變數在數據層級就是真實的 true/false
                      normalizedVal = (resolvedVal === true || resolvedVal === 1 || resolvedVal === 'true');
                    }

                    valuesByMode.push({
                        modeId: mode.modeId,
                        modeName: mode.name,
                        value: normalizedVal,
                        alias: alias
                    });
                  }

                  resolvedVars.push({
                     id: v.id, // 傳送 ID 供修改使用
                     name: v.name,
                     description: v.description || "",
                     values: valuesByMode, // 傳送多個模式的值
                     type: resolvedType
                  });
              }
          } catch(err) {
              console.error(`Error processing variable ${id}:`, err);
          }
      }

      // 無論有沒有變數都推入，以便除錯
      result.push({ 
          collectionName: col.name, 
          modes: modes.map((m: any) => ({ modeId: m.modeId, name: m.name })), // 傳送模式資訊
          variables: resolvedVars, 
          status: resolvedVars.length > 0 ? 'loaded' : 'empty' 
      });
    }

    // B. 處理未匯入的 Available Libraries
    for (const lib of availableLibs) {
        // 如果這個 Library 已經在上面 (Imported) 出現過，就跳過
        if (importedKeys.has(lib.key)) continue;

        result.push({ 
            collectionName: `${lib.libraryName} / ${lib.name}`, 
            variables: [], 
            status: 'not-imported' 
        });
    }

    // 讀取儲存的設定
    const savedSettings = await figma.clientStorage.getAsync('v2t-settings');
    
    figma.ui.postMessage({ 
      type: 'render-list', 
      data: result,
      settings: savedSettings || { jsonTheme: 'vscode' }
    });

  } catch (err) {
    console.error("Critical Error in refreshVariables:", err);
    figma.ui.postMessage({ type: 'render-list', data: [] }); 
  }
}

// 監聽來自 UI 的訊息
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'request-refresh') {
    await refreshVariables();
  }
  
  // 更新變數值
  if (msg.type === 'update-variable') {
    const { variableId, modeId, newValue, varType } = msg;
    try {
      const v = await figma.variables.getVariableByIdAsync(variableId);
      if (v) {
        if (varType?.toUpperCase() === 'COLOR') {
          v.setValueForMode(modeId, parseToFigmaColor(newValue));
        } else if (varType?.toUpperCase() === 'NUMBER') {
          const num = parseFloat(newValue);
          v.setValueForMode(modeId, isNaN(num) ? 0 : num);
        } else if (varType?.toUpperCase() === 'BOOLEAN') {
          // 強制轉為布林類型
          v.setValueForMode(modeId, newValue === 'true' || newValue === true);
        } else {
          v.setValueForMode(modeId, newValue);
        }
        // 更新成功後通知 UI (或者不通知，讓使用者手動 refresh)
        // 這裡我們自動 refresh 一次以反映最新狀態
        await refreshVariables();
      }
    } catch (e) {
      console.error("Failed to update variable:", e);
    }
  }

  // 修改變數名稱
  if (msg.type === 'rename-variable' || msg.type === 'update-name') {
    const { variableId, newName } = msg;
    try {
      const v = await figma.variables.getVariableByIdAsync(variableId);
      if (v) {
        v.name = newName;
        // 重新讀取變數以同步 UI
        await refreshVariables();
        figma.notify(`Updated variable name`);
      }
    } catch (e) {
      console.error("Failed to rename variable:", e);
    }
  }

  // 設定變數連結 (Alias)
  if (msg.type === 'set-variable-alias') {
    const { variableId, modeId, targetVariableId } = msg;
    try {
      const v = await figma.variables.getVariableByIdAsync(variableId);
      if (v) {
        v.setValueForMode(modeId, { type: 'VARIABLE_ALIAS', id: targetVariableId });
        await refreshVariables();
        figma.notify("Variable linked");
      }
    } catch (e) {
      console.error("Failed to set alias:", e);
    }
  }

  // 修改變數描述
  if (msg.type === 'update-description') {
    const { variableId, description } = msg;
    try {
      const v = await figma.variables.getVariableByIdAsync(variableId);
      if (v) {
        v.description = description;
        // Optionally refresh if needed, but description change usually doesn't affect the list view unless shown.
        // We'll refresh to be safe and keep UI in sync.
        await refreshVariables();
        figma.notify("Description updated");
      }
    } catch (e) {
      console.error("Failed to update description:", e);
    }
  }

  // 儲存設定
  if (msg.type === 'save-settings') {
    await figma.clientStorage.setAsync('v2t-settings', msg.settings);
  }

  // 處理視窗縮放
  if (msg.type === 'resize-ui') {
    const w = Math.max(500, Math.min(1200, msg.width));  // 限制寬度範圍
    const h = Math.max(360, Math.min(800, msg.height)); // 限制高度範圍
    figma.ui.resize(w, h);
  }

  // 建立新集合
  if (msg.type === 'create-collection') {
    try {
      const newCollection = figma.variables.createVariableCollection("New Collection");
      await refreshVariables(); // 重新整理變數列表
      figma.notify("Created new collection");
    } catch (e) {
      console.error("Failed to create collection:", e);
      figma.notify("Failed to create collection", { error: true });
    }
  }

  // 建立新 Mode
  if (msg.type === 'create-mode') {
    const { collectionName } = msg;
    try {
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const collection = collections.find(c => c.name === collectionName);
      if (collection) {
        const existingModes = [...collection.modes];
        const hasOnlyDefaultMode = collection.modes.length === 1 && collection.modes[0].name === 'Mode 1';
        const hasNoVariables = (collection.variableIds || []).length === 0;
        let newModeId: string;

        if (hasOnlyDefaultMode && hasNoVariables) {
          // 避免新增後出現兩個 Mode，直接重命名預設 Mode 1
          newModeId = collection.modes[0].modeId;
          collection.renameMode(newModeId, 'New Mode');
        } else {
          newModeId = collection.addMode('New Mode');

          // 新增 Mode 時，將既有模式的數值複製過去，避免出現空值
          if (newModeId && existingModes.length > 0) {
            const sourceModeId = existingModes[0].modeId;
            for (const id of collection.variableIds || []) {
              try {
                const v = await figma.variables.getVariableByIdAsync(id);
                if (!v) continue;
                const sourceVal = v.valuesByMode[sourceModeId];
                if (sourceVal !== undefined) {
                  v.setValueForMode(newModeId, sourceVal);
                }
              } catch (err) {
                console.error(`Failed to copy value for variable ${id} when creating mode:`, err);
              }
            }
          }
        }

        // 右鍵新增 Mode：若集合沒有任何變數，建立一個顏色變數
        if (hasNoVariables) {
          try {
            const defaultName = 'Color';
            const existingNames = new Set<string>();
            for (const id of collection.variableIds || []) {
              const v = await figma.variables.getVariableByIdAsync(id);
              if (v) existingNames.add(v.name);
            }
            const nameToUse = existingNames.has(defaultName) ? 'Color/Primary' : defaultName;
            const newVar = createVariableCompat(nameToUse, collection, 'COLOR');
            newVar.description = 'Auto-created';
            for (const m of collection.modes || []) {
              newVar.setValueForMode(m.modeId, { r: 1, g: 1, b: 1 });
            }
          } catch (err) {
            console.error('Failed to create default color variable when creating mode:', err);
          }
        }
        await refreshVariables();
        figma.notify(`Mode added to ${collectionName}`);
      }
    } catch (e) {
      console.error("Failed to create mode:", e);
      figma.notify("Failed to create mode", { error: true });
    }
  }

  // 重新命名集合
  if (msg.type === 'rename-collection') {
    const { oldName, newName } = msg;
    try {
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const collection = collections.find(c => c.name === oldName);
      if (collection) {
        collection.name = newName;
        await refreshVariables();
        figma.notify("Collection renamed");
      }
    } catch (e) {
      console.error("Failed to rename collection:", e);
      figma.notify("Failed to rename collection", { error: true });
    }
  }

  // 重新命名 Mode
  if (msg.type === 'rename-mode') {
    const { collectionName, modeId, newName } = msg;
    try {
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const collection = collections.find(c => c.name === collectionName);
      if (collection) {
        collection.renameMode(modeId, newName);
        await refreshVariables();
        figma.notify("Mode renamed");
      }
    } catch (e) {
      console.error("Failed to rename mode:", e);
      figma.notify("Failed to rename mode", { error: true });
    }
  }

  // 移動 Mode 到不同集合 (Figma 不支援直接移動，所以我們需要重新分配變數值)
  if (msg.type === 'move-mode') {
    const { modeId, oldCollection, newCollection, newName } = msg;
    try {
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const oldCol = collections.find(c => c.name === oldCollection);
      const newCol = collections.find(c => c.name === newCollection);
      
      if (oldCol && newCol) {
        // 在新集合建立同名或新名的 Mode
        const newModeId = newCol.addMode(newName);
        
        // 獲取舊集合中該 Mode 的所有變數數據並複製到新集合（這在 Figma 中是比較複雜的操作）
        // 由於 Figma 的變數是綁定 Collection 的，跨 Collection 移模式通常意味著變數結構也要對應。
        // 為簡單起見，我們這裡先實現重新命名，並提示使用者跨集合移動功能受限。
        figma.notify("Cross-collection move is not fully supported yet. Renaming instead.");
        oldCol.renameMode(modeId, newName);
        await refreshVariables();
      }
    } catch (e) {
      console.error("Failed to move mode:", e);
    }
  }

  // 刪除集合
  if (msg.type === 'delete-collection') {
    const { collectionName } = msg;
    try {
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const collection = collections.find(c => c.name === collectionName);
      if (collection) {
        collection.remove();
        await refreshVariables();
        figma.notify(`Collection "${collectionName}" deleted`);
      }
    } catch (e) {
      console.error("Failed to delete collection:", e);
      figma.notify("Failed to delete collection", { error: true });
    }
  }

  // 刪除 Mode
  if (msg.type === 'delete-mode') {
    const { collectionName, modeId } = msg;
    try {
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const collection = collections.find(c => c.name === collectionName);
      if (collection) {
        if (collection.modes.length <= 1) {
          figma.notify("Cannot delete the last mode in a collection", { error: true });
          return;
        }
        collection.removeMode(modeId);
        await refreshVariables();
        figma.notify("Mode deleted");
      }
    } catch (e) {
      console.error("Failed to delete mode:", e);
      figma.notify("Failed to delete mode", { error: true });
    }
  }

  // 複製 Mode
  if (msg.type === 'duplicate-mode') {
    const { modeId, sourceCollectionName, targetCollectionName, sourceVariableIds, sourceVariablesPayload, tempTokensJson } = msg;
    try {
      const localCollections = await figma.variables.getLocalVariableCollectionsAsync();
      
      // 我們也需要考慮 imported collections 作為來源
      let allCols = [...localCollections];
      try {
        if ((figma.variables as any).getImportedVariableCollectionsAsync) {
          const imported = await (figma.variables as any).getImportedVariableCollectionsAsync();
          allCols = [...allCols, ...imported];
        }
      } catch(e) {}

      const sourceCol = allCols.find(c => c.name === sourceCollectionName);
      const targetCol = localCollections.find(c => c.name === targetCollectionName);
      
      if (sourceCol && targetCol) {
        const sourceMode = sourceCol.modes.find(m => m.modeId === modeId);
        if (!sourceMode) return;

        // 取得目標集合現有的變數（用於檢查是否為空集合）
        // 注意：這裡我們只取本地變數，因為我們只能在其上建立新變數
        const allLocalVariables = await figma.variables.getLocalVariablesAsync();
        const targetVariables = allLocalVariables.filter(v => v.variableCollectionId === targetCol.id);

        const desiredName = msg.newName || sourceMode.name;
        const existingTargetMode = targetCol.modes.find(m => m.name === desiredName);
        const hasOnlyDefaultMode = targetCol.modes.length === 1 && targetCol.modes[0].name === 'Mode 1';
        const hasNoVariables = targetVariables.length === 0;
        let targetModeId: string;

        if (!existingTargetMode && hasOnlyDefaultMode && hasNoVariables) {
          targetModeId = targetCol.modes[0].modeId;
          targetCol.renameMode(targetModeId, desiredName);
        } else {
          targetModeId = existingTargetMode ? existingTargetMode.modeId : targetCol.addMode(desiredName);
        }

        const normalizeTokenType = (t: string) => {
          const upper = (t || '').toUpperCase();
          if (upper === 'NUMBER') return 'FLOAT';
          if (upper === 'COLOR' || upper === 'FLOAT' || upper === 'STRING' || upper === 'BOOLEAN') return upper;
          return 'STRING';
        };

        const isAliasValue = (val: any) => typeof val === 'string' && /^\{.+\}$/.test(val.trim());

        const parseTokenValue = (val: any, type: string) => {
          const upper = (type || '').toUpperCase();
          if (upper === 'COLOR' && typeof val === 'string') return parseToFigmaColor(val);
          if (upper === 'FLOAT' || upper === 'NUMBER') return isNaN(Number(val)) ? 0 : Number(val);
          if (upper === 'BOOLEAN') return val === true || val === 1 || val === 'true';
          return val ?? '';
        };

        const tokenEntries: Array<{ name: string; type: string; value: any; description?: string }> = [];
        if (typeof tempTokensJson === 'string' && tempTokensJson.trim().length > 0) {
          try {
            const data = JSON.parse(tempTokensJson);
            const walk = (node: any, path: string[] = []) => {
              if (!node || typeof node !== 'object') return;
              for (const [key, val] of Object.entries(node)) {
                if (key.startsWith('$')) continue;
                const currentPath = [...path, key];
                if (val && typeof val === 'object' && 'value' in (val as any) && 'type' in (val as any)) {
                  tokenEntries.push({
                    name: currentPath.join('/'),
                    type: String((val as any).type || 'string'),
                    value: (val as any).value,
                    description: (val as any).description
                  });
                } else {
                  walk(val, currentPath);
                }
              }
            };
            walk(data, []);
          } catch (err) {
            console.error('Failed to parse tempTokensJson:', err);
          }
        }

        // 取得來源集合中的變數（支援 imported 與 local）
        let sourceVariables: Variable[] = [];
        const uiSourceIds = Array.isArray(sourceVariableIds) ? sourceVariableIds : [];
        const sourceIds = uiSourceIds.length > 0 ? uiSourceIds : (sourceCol as any).variableIds as string[] | undefined;
        if (Array.isArray(sourceIds) && sourceIds.length > 0) {
          for (const id of sourceIds) {
            try {
              const sVar = await figma.variables.getVariableByIdAsync(id);
              if (sVar) sourceVariables.push(sVar);
            } catch (err) {
              console.error(`Failed to fetch variable ${id}:`, err);
            }
          }
        } else {
          const getVarsInCollection = (figma.variables as any).getVariablesInCollectionAsync;
          if (getVarsInCollection) {
            try {
              sourceVariables = await getVarsInCollection(sourceCol.id);
            } catch (err) {
              console.error('getVariablesInCollectionAsync failed:', err);
            }
          }
          if (sourceVariables.length === 0) {
            const allLocal = await figma.variables.getLocalVariablesAsync();
            sourceVariables = allLocal.filter(v => v.variableCollectionId === sourceCol.id);
          }
        }

        const uiPayload = Array.isArray(sourceVariablesPayload) ? sourceVariablesPayload : [];
        const payloadByName = new Map<string, any>(uiPayload.map((p: any) => [p.name, p]));
        const useTokens = tokenEntries.length > 0;
        const usePayload = !useTokens && sourceVariables.length === 0 && uiPayload.length > 0;
        if (!useTokens && sourceVariables.length === 0 && uiPayload.length === 0) {
          console.warn(`No variables found in source collection: ${sourceCollectionName}`);
        }

        const normalizePayloadType = (t: string) => normalizeTokenType(t);

        const parseValueForType = (val: any, type: string) => parseTokenValue(val, type);

        // 複製變數
        if (useTokens) {
          // Pass 1: ensure all variables exist
          for (const entry of tokenEntries) {
            try {
              const tType = normalizeTokenType(entry.type);
              let tVar = targetVariables.find(v => v.name === entry.name && v.resolvedType === tType);
              if (!tVar) {
                tVar = createVariableCompat(entry.name, targetCol, tType as VariableResolvedDataType);
                tVar.description = entry.description || '';
                targetVariables.push(tVar);
              }
            } catch (err) {
              console.error(`Failed to create token variable during duplication:`, err);
            }
          }

          // Pass 2: set values / aliases
          for (const entry of tokenEntries) {
            try {
              const tType = normalizeTokenType(entry.type);
              const tVar = targetVariables.find(v => v.name === entry.name && v.resolvedType === tType);
              if (!tVar) continue;

              if (isAliasValue(entry.value) && tType !== 'STRING') {
                const payload = payloadByName.get(entry.name);
                const aliasName = payload?.aliasesByMode?.[modeId] || entry.value.replace(/^[{]|[}]$/g, '');
                const aliasTarget = targetVariables.find(v => v.name === aliasName);
                if (aliasTarget) {
                  tVar.setValueForMode(targetModeId, { type: 'VARIABLE_ALIAS', id: aliasTarget.id } as any);
                }
                continue;
              }

              const parsed = parseTokenValue(entry.value, tType);
              tVar.setValueForMode(targetModeId, parsed);
            } catch (err) {
              console.error(`Failed to process token entry during duplication:`, err);
            }
          }
        } else if (usePayload) {
          for (const pVar of uiPayload) {
            try {
              const pType = normalizePayloadType(pVar.type);
              let tVar = targetVariables.find(v => v.name === pVar.name && v.resolvedType === pType);
              if (!tVar) {
                tVar = createVariableCompat(pVar.name, targetCol, pType as VariableResolvedDataType);
                tVar.description = pVar.description || '';
                targetVariables.push(tVar);
              }

              let val = pVar.valuesByMode?.[modeId];
              if (val === undefined) {
                const fallbackModeId = Object.keys(pVar.valuesByMode || {})[0];
                if (fallbackModeId) {
                  val = pVar.valuesByMode[fallbackModeId];
                }
              }
              const aliasName = pVar.aliasesByMode?.[modeId] || null;
              if (aliasName) {
                const aliasTarget = targetVariables.find(v => v.name === aliasName);
                if (aliasTarget) {
                  tVar.setValueForMode(targetModeId, { type: 'VARIABLE_ALIAS', id: aliasTarget.id } as any);
                  continue;
                }
              }
              if (val !== undefined) {
                tVar.setValueForMode(targetModeId, parseValueForType(val, pVar.type));
              }
            } catch (err) {
              console.error(`Failed to process payload variable during duplication:`, err);
            }
          }
        } else {
          for (const sVar of sourceVariables) {
            try {
              // 尋找目標集合中是否已有同名變數
              let tVar = targetVariables.find(v => v.name === sVar.name);
              
              if (!tVar) {
                // 如果沒有，則建立新變項
                tVar = createVariableCompat(sVar.name, targetCol, sVar.resolvedType);
                tVar.description = sVar.description;
                targetVariables.push(tVar);
              }

              // 複製數值
              let val = sVar.valuesByMode[modeId];
              if (val === undefined) {
                const fallbackModeId = Object.keys(sVar.valuesByMode || {})[0];
                if (fallbackModeId) {
                  val = sVar.valuesByMode[fallbackModeId];
                }
              }
              if (val && typeof val === 'object' && 'type' in val && (val as any).type === 'VARIABLE_ALIAS') {
                try {
                  const aliasedVar = await figma.variables.getVariableByIdAsync((val as any).id);
                  const aliasTarget = aliasedVar ? targetVariables.find(v => v.name === aliasedVar.name) : null;
                  if (aliasTarget) {
                    tVar.setValueForMode(targetModeId, { type: 'VARIABLE_ALIAS', id: aliasTarget.id } as any);
                    continue;
                  }
                } catch (err) {
                  console.error('Failed to remap alias during duplication:', err);
                }
              }
              if (val !== undefined) {
                tVar.setValueForMode(targetModeId, val);
              }
            } catch (err) {
              console.error(`Failed to process variable during duplication:`, err);
            }
          }
        }
        
        await refreshVariables();
        figma.notify(`Mode "${desiredName}" duplicated to ${targetCollectionName}`);
      }
    } catch (e) {
      console.error("Failed to duplicate mode:", e);
      figma.notify("Failed to duplicate mode", { error: true });
    }
  }

  // 從 GitHub Pull 匯入 Tokens 並同步到指定 Collection/Mode
  if (msg.type === 'pull-from-github') {
    const { collectionName, modeId, tokensJson } = msg;
    try {
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      const targetCol = collections.find(c => c.name === collectionName);
      if (!targetCol) {
        figma.notify('找不到對應的 Collection', { error: true });
        return;
      }

      const targetMode = targetCol.modes.find(m => m.modeId === modeId);
      if (!targetMode) {
        figma.notify('找不到對應的 Mode', { error: true });
        return;
      }

      const normalizeTokenType = (t: string) => {
        const upper = (t || '').toUpperCase();
        if (upper === 'NUMBER') return 'FLOAT';
        if (upper === 'COLOR' || upper === 'FLOAT' || upper === 'STRING' || upper === 'BOOLEAN') return upper;
        return 'STRING';
      };

      const isAliasValue = (val: any) => typeof val === 'string' && /^\{.+\}$/.test(val.trim());

      const parseTokenValue = (val: any, type: string) => {
        const upper = (type || '').toUpperCase();
        if (upper === 'COLOR' && typeof val === 'string') return parseToFigmaColor(val);
        if (upper === 'FLOAT' || upper === 'NUMBER') return isNaN(Number(val)) ? 0 : Number(val);
        if (upper === 'BOOLEAN') return val === true || val === 1 || val === 'true';
        return val ?? '';
      };

      const tokenEntries: Array<{ name: string; type: string; value: any; description?: string }> = [];
      if (typeof tokensJson === 'string' && tokensJson.trim().length > 0) {
        try {
          const data = JSON.parse(tokensJson);
          const walk = (node: any, path: string[] = []) => {
            if (!node || typeof node !== 'object') return;
            for (const [key, val] of Object.entries(node)) {
              if (key.startsWith('$')) continue;
              const currentPath = [...path, key];
              if (val && typeof val === 'object' && (('value' in (val as any)) || ('$value' in (val as any)))) {
                tokenEntries.push({
                  name: currentPath.join('/'),
                  type: String((val as any).type || (val as any).$type || 'string'),
                  value: (val as any).value !== undefined ? (val as any).value : (val as any).$value,
                  description: (val as any).description || (val as any).$description
                });
              } else {
                walk(val, currentPath);
              }
            }
          };
          walk(data, []);
        } catch (err) {
          console.error('Failed to parse tokensJson:', err);
          figma.notify('Tokens 解析失敗', { error: true });
          return;
        }
      }

      const allLocalVariables = await figma.variables.getLocalVariablesAsync();
      const targetVariables = allLocalVariables.filter(v => v.variableCollectionId === targetCol.id);

      // Pass 1: ensure variables exist
      for (const entry of tokenEntries) {
        try {
          const tType = normalizeTokenType(entry.type);
          let tVar = targetVariables.find(v => v.name === entry.name && v.resolvedType === tType);
          if (!tVar) {
            tVar = createVariableCompat(entry.name, targetCol, tType as VariableResolvedDataType);
            tVar.description = entry.description || '';
            targetVariables.push(tVar);
          }
        } catch (err) {
          console.error(`Failed to create variable during pull:`, err);
        }
      }

      // Pass 2: set values / aliases
      for (const entry of tokenEntries) {
        try {
          const tType = normalizeTokenType(entry.type);
          const tVar = targetVariables.find(v => v.name === entry.name && v.resolvedType === tType);
          if (!tVar) continue;

          if (isAliasValue(entry.value) && tType !== 'STRING') {
            const aliasName = entry.value.replace(/^\{|\}$/g, '');
            const aliasTarget = targetVariables.find(v => v.name === aliasName);
            if (aliasTarget) {
              tVar.setValueForMode(modeId, { type: 'VARIABLE_ALIAS', id: aliasTarget.id } as any);
            }
            continue;
          }

          const parsed = parseTokenValue(entry.value, tType);
          tVar.setValueForMode(modeId, parsed);
        } catch (err) {
          console.error(`Failed to set value during pull:`, err);
        }
      }

      await refreshVariables();
      figma.notify(`已從 GitHub 同步 ${collectionName} / ${targetMode.name}`);
    } catch (e) {
      console.error('Failed to pull tokens from GitHub:', e);
      figma.notify('GitHub Pull 失敗', { error: true });
    }
  }

  // 複製 Collection
  if (msg.type === 'duplicate-collection') {
    const { sourceName, newName } = msg;
    try {
      const collections = await figma.variables.getLocalVariableCollectionsAsync();
      // 我們也需要考慮 imported collections 作為來源
      let allCols = [...collections];
      try {
        if ((figma.variables as any).getImportedVariableCollectionsAsync) {
          const imported = await (figma.variables as any).getImportedVariableCollectionsAsync();
          allCols = [...allCols, ...imported];
        }
      } catch(e) {}

      const sourceCol = allCols.find(c => c.name === sourceName);
      if (sourceCol) {
        // 建立新集合
        const newCol = figma.variables.createVariableCollection(newName);
        
        // 1. 同步 Modes
        const modeIdMap: Record<string, string> = {};
        
        if (sourceCol.modes.length > 0) {
          // 重用預設建立的第一個 Mode
          newCol.renameMode(newCol.modes[0].modeId, sourceCol.modes[0].name);
          modeIdMap[sourceCol.modes[0].modeId] = newCol.modes[0].modeId;
          
          // 新增剩餘的 Modes
          for (let i = 1; i < sourceCol.modes.length; i++) {
            const m = sourceCol.modes[i];
            const newModeId = newCol.addMode(m.name);
            modeIdMap[m.modeId] = newModeId;
          }
        }

        // 2. 複製變數
        let sourceVariables: Variable[] = [];
        const sourceIds = (sourceCol as any).variableIds as string[] | undefined;
        if (Array.isArray(sourceIds) && sourceIds.length > 0) {
          for (const id of sourceIds) {
            try {
              const sVar = await figma.variables.getVariableByIdAsync(id);
              if (sVar) sourceVariables.push(sVar);
            } catch (varErr) {
              console.error(`Failed to fetch variable ${id}:`, varErr);
            }
          }
        } else {
          const getVarsInCollection = (figma.variables as any).getVariablesInCollectionAsync;
          if (getVarsInCollection) {
            try {
              sourceVariables = await getVarsInCollection(sourceCol.id);
            } catch (varErr) {
              console.error('getVariablesInCollectionAsync failed:', varErr);
            }
          }
          if (sourceVariables.length === 0) {
            const allLocal = await figma.variables.getLocalVariablesAsync();
            sourceVariables = allLocal.filter(v => v.variableCollectionId === sourceCol.id);
          }
        }

        if (sourceVariables.length === 0) {
          console.warn(`No variables found in source collection: ${sourceName}`);
        }

        for (const sVar of sourceVariables) {
          try {
            const tVar = createVariableCompat(sVar.name, newCol, sVar.resolvedType);
            tVar.description = sVar.description;
            
            // 複製每個 Mode 的值
            for (const sMode of sourceCol.modes) {
              const val = sVar.valuesByMode[sMode.modeId];
              const tModeId = modeIdMap[sMode.modeId];
              if (val !== undefined && tModeId) {
                tVar.setValueForMode(tModeId, val);
              }
            }
          } catch (varErr) {
            console.error(`Failed to duplicate variable:`, varErr);
          }
        }

        await refreshVariables();
        figma.notify(`Collection duplicated as "${newName}"`);
      }
    } catch (e) {
      console.error("Failed to duplicate collection:", e);
      figma.notify("Failed to duplicate collection", { error: true });
    }
  }
};

// 初始啟動時自動跑一次
refreshVariables();