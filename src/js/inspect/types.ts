export type FindingSeverity = 'info' | 'attention' | 'privacy' | 'risk';

export type PageKind = 'text' | 'scan' | 'mixed' | 'empty' | 'unknown';

export interface PageRecord {
  index: number;
  widthPt: number;
  heightPt: number;
  rotation: number;
  orientation: 'portrait' | 'landscape' | 'square';
  contentBytes: number;
  hasFont: boolean;
  hasImage: boolean;
  imageCount: number;
  annotationCount: number;
  probableBlank: boolean;
  contentHash: string;
  kind: PageKind;
}

export interface MetadataSnapshot {
  title: string | null;
  author: string | null;
  subject: string | null;
  creator: string | null;
  producer: string | null;
  keywords: string | null;
  creationDate: string | null;
  modificationDate: string | null;
}

export interface DocumentFacts {
  fileName: string;
  byteLength: number;
  pageCount: number;
  encrypted: boolean;
  mixedPageSize: boolean;
  hasForm: boolean;
  formFieldCount: number;
  hasAttachments: boolean;
  attachmentCount: number;
  hasAnnotations: boolean;
  annotationCount: number;
  hasJavaScript: boolean;
  hasOpenAction: boolean;
  hasSignatures: boolean;
  hasStructTree: boolean;
  hasMarkInfo: boolean;
  hasLanguage: boolean;
  metadata: MetadataSnapshot;
}

export interface InspectFinding {
  id: string;
  title: string;
  summary: string;
  hedge: string;
  severity: FindingSeverity;
  pages: number[];
  recommendedOp: string | null;
  recommendedParams?: Record<string, unknown>;
  explanation: string;
}

export interface DocumentMap {
  facts: DocumentFacts;
  pages: PageRecord[];
  findings: InspectFinding[];
  cancelled: boolean;
  engine: 'pdf-lib';
  limitations: string[];
}

export type InspectStage =
  | 'structure'
  | 'pages'
  | 'privacy'
  | 'done'
  | 'cancelled'
  | 'error';

export interface InspectProgress {
  stage: InspectStage;
  message: string;
  ratio: number;
}
