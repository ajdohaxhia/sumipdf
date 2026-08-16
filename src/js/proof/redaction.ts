import { markerExtractable } from './metrics';
import type { RedactionProof } from './types';

export async function proveRedactionVersusCover(options: {
  afterBytes: Uint8Array;
  markers?: string[];
  claimedRedaction: boolean;
  visualCoverUsed: boolean;
}): Promise<RedactionProof> {
  const markers = (options.markers || []).filter(Boolean);
  const extractable: string[] = [];
  for (const marker of markers) {
    if (await markerExtractable(options.afterBytes, marker)) {
      extractable.push(marker);
    }
  }
  let note: string;
  if (options.visualCoverUsed && extractable.length) {
    note =
      'A visual cover was used. The listed markers are still extractable from the file bytes. This is not redaction.';
  } else if (options.claimedRedaction && extractable.length) {
    note =
      'Redaction was requested, but at least one marker is still extractable. Rasterized text and non-matching strings can survive.';
  } else if (options.claimedRedaction && !extractable.length) {
    note =
      'Requested markers were not found in the output bytes. Images of the same words can still remain.';
  } else {
    note = 'No redaction markers were supplied for an extractability check.';
  }
  return {
    claimedRedaction: options.claimedRedaction,
    visualCoverUsed: options.visualCoverUsed,
    extractableMarkers: extractable,
    note,
  };
}
