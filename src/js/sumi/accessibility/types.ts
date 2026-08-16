export type A11yLevel = 'info' | 'warning' | 'fixable';

export interface A11yFinding {
  id: string;
  level: A11yLevel;
  title: string;
  detail: string;
  fix: 'set-title' | 'set-lang' | null;
}

export interface A11yReport {
  findings: A11yFinding[];
  pdfUaClaim: false;
  wcagClaim: false;
  limitations: string[];
}

export interface A11yFix {
  title?: string;
  lang?: string;
}
