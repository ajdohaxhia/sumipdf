export type PreflightLevel = 'error' | 'warning' | 'info' | 'not-verifiable';

export interface PreflightIssue {
  id: string;
  level: PreflightLevel;
  title: string;
  detail: string;
  pages: number[];
  repairOp: string | null;
}

export interface PreflightReport {
  issues: PreflightIssue[];
  isoClaim: false;
  limitations: string[];
}
