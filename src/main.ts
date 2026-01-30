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
                 // 抓取所有模式的值
                 const valuesByMode = [];
                 for (const mode of modes) {
                    const rawVal = v.valuesByMode[mode.modeId];
                    // 即使是 undefined 也要處理，保持陣列長度一致或標記為空
                    let resolvedVal = "N/A";
                    if (rawVal !== undefined) {
                        try {
                           resolvedVal = await resolveValue(rawVal, mode.modeId);
                        } catch (e) {
                           resolvedVal = "Error";
                        }
                    }
                    valuesByMode.push({
                        modeId: mode.modeId,
                        modeName: mode.name,
                        value: resolvedVal
                    });
                 }

                  resolvedVars.push({
                     id: v.id, // 傳送 ID 供修改使用
                     name: v.name,
                     description: v.description || "",
                     values: valuesByMode, // 傳送多個模式的值
                     type: v.resolvedType
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

    figma.ui.postMessage({ type: 'render-list', data: result });

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
        if (varType === 'COLOR') {
          v.setValueForMode(modeId, parseToFigmaColor(newValue));
        } else if (varType === 'FLOAT') {
          v.setValueForMode(modeId, parseFloat(newValue));
        } else if (varType === 'BOOLEAN') {
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

  // 處理視窗縮放
  if (msg.type === 'resize-ui') {
    const w = Math.max(500, Math.min(1200, msg.width));  // 限制寬度範圍
    const h = Math.max(360, Math.min(800, msg.height)); // 限制高度範圍
    figma.ui.resize(w, h);
  }
};

// 初始啟動時自動跑一次
refreshVariables();