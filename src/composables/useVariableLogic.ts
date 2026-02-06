export function useVariableLogic() {
  // 核心配置
  const TYPE_MAP: Record<string, { mapped: string, symbol: string, display: string, preview: string }> = {
    NUMBER:  { mapped: 'number',  symbol: '#', display: 'Number',  preview: '0.1' },
    COLOR:   { mapped: 'color',   symbol: '',  display: 'Color',   preview: ''    },
    STRING:  { mapped: 'string',  symbol: 'T', display: 'String',  preview: 'Aa'   },
    BOOLEAN: { mapped: 'boolean', symbol: 'B', display: 'Boolean', preview: 'TF'   },
  };

  const getInfo = (type: string = '') => {
    const t = type.toUpperCase();
    return TYPE_MAP[t] || {
      mapped: type.toLowerCase(),
      symbol: 'T',
      display: type,
      preview: ''
    };
  };

  const getMappedType = (type: string) => getInfo(type).mapped;
  const getTypeSymbol = (type: string) => getInfo(type).symbol;
  const getDisplayType = (type: string) => getInfo(type).display;
  const getTypeValuePreview = (type: string) => getInfo(type).preview;

  /**
   * 收集並格式化變數資料
   * 處理 Alias 為 {name} 格式
   */
  const collectEntries = (variables: any[], activeModeId: string | null) => {
    return variables.map(v => {
      const parts = v.name.split('/');
      const modeVal = v.values?.find((m: any) => m.modeId === activeModeId) || v.values?.[0];
      
      let finalValue = modeVal?.value;
      
      // 如果是 Alias (引用)，格式化為 {variableName}
      if (modeVal?.alias) {
        const aliasName = modeVal.alias.name.split('/').pop() || modeVal.alias.name;
        finalValue = `{${aliasName}}`;
      }
      
      return {
        path: parts,
        value: finalValue,
        type: getMappedType(v.type),
        description: v.description
      };
    });
  };

  /**
   * 生成精簡的 JSON 物件 (不含 extensions)
   */
  const generateOrderedJsonObject = (variables: any[], activeModeId: string | null, options: { includeDescription?: boolean } = {}) => {
    const entries = collectEntries(variables, activeModeId);
    const topLevelEntries = entries.filter(e => e.path.length === 1);
    const nestedEntries = entries.filter(e => e.path.length > 1);
    
    const result: any = {};
    
    // 頂層變數
    topLevelEntries.forEach(({ path, value, type, description }) => {
      const item: any = { "value": value,"type": type };
      if (options.includeDescription && description) item["description"] = description;
      result[path[0]] = item;
    });
    
    // 巢狀變數
    nestedEntries.forEach(({ path, value, type, description }) => {
      let current = result;
      path.forEach((part: string, index: number) => {
        if (index === path.length - 1) {
          const item: any = { "value": value, "type": type };
          if (options.includeDescription && description) item["description"] = description;
          current[part] = item;
        } else {
          if (!current[part]) current[part] = {};
          current = current[part];
        }
      });
    });

    Object.defineProperty(result, '__entries', { value: entries, enumerable: false });
    return result;
  };

  /**
   * 序列化為精簡格式的字串
   */
  const serializeJson = (variables: any[], activeModeId: string | null, options: { includeDescription?: boolean } = {}) => {
    const data = generateOrderedJsonObject(variables, activeModeId, options);
    return JSON.stringify(data, null, 2);
  };

  return {
    getMappedType,
    getTypeSymbol,
    getDisplayType,
    getTypeValuePreview,
    generateOrderedJsonObject,
    serializeJson
  };
}
