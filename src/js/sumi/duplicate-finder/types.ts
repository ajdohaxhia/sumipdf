export type DuplicateKind =
  | 'exact'
  | 'text-equivalent'
  | 'probable-visual'
  | 'uncertain';

export interface PageFingerprint {
  page: number;
  contentHash: string;
  textFingerprint: string;
  perceptualHash: string;
  contentBytes: number;
  entropy: number;
}

export interface DuplicateMember {
  page: number;
  kind: DuplicateKind;
  explanation: string;
  qualityScore: number;
}

export interface DuplicateSet {
  id: string;
  kind: DuplicateKind;
  pages: number[];
  members: DuplicateMember[];
  keepPage: number;
  explanation: string;
}

export interface DuplicateReport {
  sets: DuplicateSet[];
  threshold: number;
  autoDeleted: false;
}
