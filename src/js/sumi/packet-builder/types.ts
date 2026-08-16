export interface PacketSlot {
  id: string;
  label: string;
  required: boolean;
  fileId?: string;
  fileName?: string;
  bytes?: Uint8Array;
}

export interface PacketTemplate {
  id: string;
  name: string;
  summary: string;
  legalClaim: false;
  slots: Array<{ id: string; label: string; required: boolean }>;
}

export interface PacketOptions {
  normalize: boolean;
  compress: boolean;
  coverTitle?: string;
  separators: boolean;
  bookmarks: boolean;
  toc: boolean;
  pageNumbers: boolean;
  cleanMetadata: boolean;
}

export interface PacketWarning {
  level: 'missing' | 'duplicate' | 'info';
  message: string;
  slotId?: string;
}

export const PACKET_TEMPLATES: PacketTemplate[] = [
  {
    id: 'application',
    name: 'Application packet',
    summary:
      'Cover, identity, CV, and supporting pages. Edit the slots; this is not a government form.',
    legalClaim: false,
    slots: [
      { id: 'cover', label: 'Cover', required: false },
      { id: 'id', label: 'Identity document', required: true },
      { id: 'cv', label: 'CV / resume', required: true },
      { id: 'support', label: 'Supporting pages', required: false },
    ],
  },
  {
    id: 'board',
    name: 'Board pack',
    summary:
      'Agenda, minutes, and exhibits. Starting point only — not a filing standard.',
    legalClaim: false,
    slots: [
      { id: 'agenda', label: 'Agenda', required: true },
      { id: 'minutes', label: 'Minutes', required: false },
      { id: 'exhibits', label: 'Exhibits', required: false },
    ],
  },
];
