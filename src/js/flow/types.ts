export type FlowScope = {
  pages?: number[];
};

export interface FlowStep {
  id: string;
  op: string;
  enabled: boolean;
  params: Record<string, unknown>;
  scope?: FlowScope;
  notes?: string;
}

export interface FlowDocument {
  version: 1;
  name: string;
  steps: FlowStep[];
}

export interface FlowIssue {
  level: 'error' | 'warning';
  stepId?: string;
  message: string;
}

export interface FlowOpDefinition {
  id: string;
  name: string;
  summary: string;
  impact: string;
  category: 'organize' | 'optimize' | 'privacy' | 'prepare' | 'convert';
  engines: string[];
  defaultParams: Record<string, unknown>;
  paramSchema: Array<{
    key: string;
    label: string;
    type: 'text' | 'number' | 'select' | 'boolean' | 'secret';
    options?: string[];
  }>;
  supportsPageScope: boolean;
  secretKeys: string[];
}

export interface FlowRunProgress {
  stepId: string | null;
  stepName: string;
  index: number;
  total: number;
  status: 'running' | 'ok' | 'error' | 'cancelled' | 'skipped';
  message: string;
}

export interface FlowStepResult {
  stepId: string;
  op: string;
  ok: boolean;
  skipped?: boolean;
  message: string;
  notes: string[];
  bytesIn: number;
  bytesOut: number;
}

export interface FlowExecution {
  originalBytes: Uint8Array;
  outputBytes: Uint8Array;
  originalName: string;
  outputName: string;
  steps: FlowStepResult[];
  cancelled: boolean;
  failedStepId: string | null;
  objectUrls: string[];
}

export interface SerializedFlowRecipe {
  version: 1;
  id: string;
  name: string;
  summary: string;
  limitations?: string;
  steps: Array<{
    op: string;
    enabled: boolean;
    params: Record<string, unknown>;
    notes?: string;
  }>;
}
