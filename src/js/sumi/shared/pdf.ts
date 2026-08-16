import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFStream,
  decodePDFRawStream,
  type PDFRef,
} from 'pdf-lib';
import { concatBytes } from './bytes';

export async function loadPdf(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes, {
    ignoreEncryption: true,
    updateMetadata: false,
    throwOnInvalidObject: false,
  });
}

export function catalogHas(doc: PDFDocument, key: string): boolean {
  try {
    return doc.catalog.has(PDFName.of(key));
  } catch {
    return false;
  }
}

export function lookupDict(
  doc: PDFDocument,
  ref: ReturnType<PDFDict['get']> | undefined
): PDFDict | undefined {
  if (!ref) return undefined;
  if (ref instanceof PDFDict) return ref;
  const found = doc.context.lookup(ref);
  return found instanceof PDFDict ? found : undefined;
}

export function nameOf(dict: PDFDict | undefined, key: string): string | null {
  if (!dict) return null;
  const value = dict.get(PDFName.of(key));
  if (value instanceof PDFName) {
    try {
      return value.decodeText();
    } catch {
      return value.toString().replace(/^\//, '');
    }
  }
  return null;
}

function decodeStreamObject(obj: unknown): Uint8Array {
  if (!(obj instanceof PDFRawStream) && !(obj instanceof PDFStream)) {
    return new Uint8Array();
  }
  try {
    if (obj instanceof PDFRawStream) {
      const decoded = decodePDFRawStream(obj as PDFRawStream);
      if (
        decoded &&
        typeof (decoded as { decode?: () => Uint8Array }).decode === 'function'
      ) {
        return (decoded as { decode: () => Uint8Array }).decode();
      }
    }
  } catch {
    /* fall through to raw contents */
  }
  try {
    return obj.getContents();
  } catch {
    return new Uint8Array();
  }
}

export function streamBytes(obj: unknown): Uint8Array {
  return decodeStreamObject(obj);
}

export function pageContentBytes(
  doc: PDFDocument,
  pageIndex: number
): Uint8Array {
  const page = doc.getPage(pageIndex);
  const contents = page.node.Contents();
  if (!contents) return new Uint8Array();
  if (contents instanceof PDFArray) {
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < contents.size(); i++) {
      chunks.push(streamBytes(doc.context.lookup(contents.get(i))));
    }
    return concatBytes(chunks);
  }
  return streamBytes(doc.context.lookup(contents));
}

export function walkIndirectDicts(
  doc: PDFDocument,
  visit: (dict: PDFDict, ref: PDFRef) => void
): void {
  try {
    for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
      if (obj instanceof PDFDict) visit(obj, ref);
    }
  } catch {
    /* damaged files still yield raw-scan findings */
  }
}

export function actionType(dict: PDFDict): string | null {
  return nameOf(dict, 'S') || nameOf(dict, 'Subtype');
}
