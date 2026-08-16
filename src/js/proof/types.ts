export interface ProofMetrics {
  byteLength: number;
  pageCount: number;
  sha256: string;
  title: string | null;
  author: string | null;
  hasForm: boolean;
  formFieldCount: number;
  hasJavaScript: boolean;
  hasAttachments: boolean;
  hasOcrLayer: boolean;
  encrypted: boolean;
}

export interface ProofChange {
  label: string;
  before: string;
  after: string;
}

export interface RedactionProof {
  claimedRedaction: boolean;
  visualCoverUsed: boolean;
  extractableMarkers: string[];
  note: string;
}

export interface ProofReport {
  schema: 'sumi.proof.receipt';
  schemaVersion: 1;
  generatedAt: string;
  product: 'Sumi PDF';
  notACertificate: true;
  disclaimer: string;
  originalName: string;
  outputName: string;
  before: ProofMetrics;
  after: ProofMetrics;
  changes: ProofChange[];
  warnings: string[];
  redaction: RedactionProof;
  pdfa: {
    attempted: boolean;
    honestLimit: string;
  };
  flowStepNames: string[];
  failedStep: string | null;
}

export const PROOF_DISCLAIMER =
  'This Sumi Proof Receipt is a local processing record. It is not a legal certificate, not a cryptographic audit, and not a guarantee that hidden data is gone.';
