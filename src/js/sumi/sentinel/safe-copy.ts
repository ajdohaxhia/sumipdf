import { defaultSanitizeOptions, sanitizePdf } from '../../utils/sanitize';

export interface SafeCopyResult {
  bytes: Uint8Array;
  notes: string[];
}

export async function makeSafeCopy(bytes: Uint8Array): Promise<SafeCopyResult> {
  const result = await sanitizePdf(bytes, {
    ...defaultSanitizeOptions,
    flattenForms: true,
    removeMetadata: true,
    removeAnnotations: true,
    removeJavascript: true,
    removeEmbeddedFiles: true,
    removeLayers: true,
    removeLinks: true,
    removeStructureTree: true,
    removeMarkInfo: true,
    removeFonts: false,
  });
  return {
    bytes: result.bytes,
    notes: [
      'Safe Copy used the inherited pdf-lib sanitizer.',
      'JavaScript, OpenAction, AA, embedded files, links, layers, and annotations this engine can see were targeted.',
      'Rasterized secrets, encrypted payloads that did not decrypt, and unparsed XFA can remain.',
      'This is not a malware scan and not a legal hold.',
    ],
  };
}
