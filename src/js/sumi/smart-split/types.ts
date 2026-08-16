export type SplitRule =
  | 'page-count'
  | 'ranges'
  | 'bookmarks'
  | 'headings'
  | 'text'
  | 'regex'
  | 'blank'
  | 'page-size'
  | 'orientation'
  | 'qr'
  | 'barcode'
  | 'captured-value';

export interface PageSignal {
  page: number;
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape' | 'square';
  probableBlank: boolean;
  text: string;
  heading?: string;
  bookmark?: string;
  barcode?: string;
  captured?: string;
}

export interface SplitGroup {
  id: string;
  pages: number[];
  rangeLabel: string;
  rule: SplitRule;
  filename: string;
  collision: boolean;
  bookmark?: string;
  heading?: string;
  barcode?: string;
  match?: Record<string, string>;
}

export interface SplitPlan {
  groups: SplitGroup[];
  rule: SplitRule;
  template: string;
  unusedPages: number[];
}

export interface SplitOptions {
  rule: SplitRule;
  pageCount?: number;
  ranges?: string;
  text?: string;
  regex?: string;
  captureName?: string;
  template?: string;
  originalName?: string;
  bookmarks?: Array<{ page: number; title: string }>;
  barcodes?: Array<{ page: number; value: string }>;
}
