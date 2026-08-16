export type FormValue = string | boolean | string[];

export interface FormFieldInfo {
  name: string;
  type: 'text' | 'checkbox' | 'dropdown' | 'option' | 'signature' | 'unknown';
  options?: string[];
  isCryptoSignature: boolean;
}

export interface FieldMap {
  field: string;
  column: string;
  transform:
    | 'none'
    | 'trim'
    | 'upper'
    | 'lower'
    | 'title'
    | 'date-iso'
    | 'date-it'
    | 'date-us';
}

export interface BatchRowIssue {
  row: number;
  field: string;
  message: string;
  repair?: string;
}

export interface BatchOptions {
  mapping: FieldMap[];
  flatten: boolean;
  skipInvalid: boolean;
  filenameTemplate: string;
}

export interface BatchResult {
  files: Array<{ name: string; bytes: Uint8Array; row: number }>;
  skipped: Array<{ row: number; reason: string }>;
  issues: BatchRowIssue[];
  notes: string[];
}
