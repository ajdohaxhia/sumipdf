export type PrivacyKind =
  | 'email'
  | 'phone'
  | 'url'
  | 'ipv4'
  | 'ipv6'
  | 'iban'
  | 'card'
  | 'codice-fiscale'
  | 'italian-vat'
  | 'dob'
  | 'gps'
  | 'custom';

export type PrivacyConfidence = 'high' | 'medium' | 'low';

export interface PrivacyHit {
  id: string;
  kind: PrivacyKind;
  value: string;
  page: number;
  confidence: PrivacyConfidence;
  start: number;
  end: number;
  context: string;
  checksumOk?: boolean;
}

export interface PrivacyGroup {
  kind: PrivacyKind;
  value: string;
  count: number;
  pages: number[];
  confidence: PrivacyConfidence;
  hitIds: string[];
}

export interface PrivacyScanOptions {
  customTerms?: string[];
  customRegexes?: string[];
  includeOcr?: boolean;
  excludedValues?: string[];
  signal?: AbortSignal;
}

export interface PrivacyScanResult {
  hits: PrivacyHit[];
  groups: PrivacyGroup[];
  usedOcr: boolean;
  textLayerPages: number;
  emptyTextPages: number[];
  limitations: string[];
}
