/// <reference types="@figma/plugin-typings" />

// 顯示 UI
figma.showUI(__html__, { width: 800, height: 500, themeColors: true });

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

// 顏色轉換函式
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
                    name: v.name,
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
  
  // 處理視窗縮放
  if (msg.type === 'resize-ui') {
    const w = Math.max(500, Math.min(1200, msg.width));  // 限制寬度範圍
    const h = Math.max(360, Math.min(800, msg.height)); // 限制高度範圍
    figma.ui.resize(w, h);
  }
};

// 初始啟動時自動跑一次
refreshVariables();