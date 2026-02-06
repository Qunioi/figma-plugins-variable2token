export type VariableType = 'COLOR' | 'NUMBER' | 'STRING' | 'BOOLEAN';

export interface VariableModeValue {
  modeId: string;
  value: any;
}

export interface Variable {
  id: string;
  name: string;
  type: VariableType;
  values: VariableModeValue[];
  description?: string;
  // For library/external variables
  colorValue?: string;
  collectionName?: string;
}

export interface Mode {
  modeId: string;
  name: string;
}

export interface Collection {
  collectionId: string;
  collectionName: string;
  modes: Mode[];
  variables: Variable[];
}

export interface VariableGroup {
  [groupName: string]: Variable[];
}

export interface PickerTarget {
  id: string;
  name: string;
  type: string;
  initialName: string;
  initialValue: string;
  initialDescription?: string;
  alias?: { id: string; name: string };
}

export interface JsonThemeOption {
  value: string;
  label: string;
}

export interface TypeFilterOption {
  value: 'ALL' | VariableType;
  label: string;
  icon: string | null;
}
export interface Settings {
  jsonTheme: string;
  githubAccount?: {
    token: string;
    username: string;
    avatarUrl: string;
  };
  githubRepo?: string;
  githubPath?: string;
}
