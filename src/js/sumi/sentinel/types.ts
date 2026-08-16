export type SentinelSeverity =
  | 'Information'
  | 'Review'
  | 'Potentially unsafe'
  | 'High risk';

export type SentinelCategory =
  | 'javascript'
  | 'open-action'
  | 'launch'
  | 'submit-form'
  | 'goto-remote'
  | 'uri'
  | 'embedded-files'
  | 'rich-media'
  | 'xfa'
  | 'acroform'
  | 'annotations'
  | 'hidden-text'
  | 'ocg'
  | 'metadata'
  | 'auto-action'
  | 'encryption'
  | 'signature'
  | 'malformed'
  | 'large-stream'
  | 'structure-tree';

export interface SentinelFinding {
  id: string;
  category: SentinelCategory;
  severity: SentinelSeverity;
  title: string;
  explanation: string;
  evidence: string;
  page: number | null;
  object: string | null;
  canRemove: boolean;
  impact: string;
  recommendedOp: string | null;
}

export interface SentinelReport {
  fileName: string;
  byteLength: number;
  pageCount: number;
  findings: SentinelFinding[];
  executedJavascript: false;
  malwareFreeClaim: false;
  limitations: string[];
  generatedAt: string;
}

export const SENTINEL_DISCLAIMER =
  'Sentinel lists objects this parser can see. It does not execute PDF JavaScript, does not sandbox attachments, and does not claim a file is malware-free.';
