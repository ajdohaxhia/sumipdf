import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFRawStream,
  PDFStream,
  decodePDFRawStream,
} from 'pdf-lib';
import type {
  DocumentFacts,
  DocumentMap,
  InspectFinding,
  InspectProgress,
  MetadataSnapshot,
  PageKind,
  PageRecord,
} from './types';

const BLANK_CONTENT_THRESHOLD = 48;
const LARGE_RESOURCE_BYTES = 1_000_000;
const IMAGE_HEAVY_RATIO = 0.45;

export interface AnalyzeOptions {
  fileName: string;
  signal?: AbortSignal;
  onProgress?: (progress: InspectProgress) => void;
}

function latin1(bytes: Uint8Array, limit = 2_000_000): string {
  const slice = bytes.subarray(0, Math.min(bytes.length, limit));
  return new TextDecoder('latin1').decode(slice);
}

function djb2(bytes: Uint8Array): string {
  let hash = 5381;
  const step = Math.max(1, Math.floor(bytes.length / 4096));
  for (let i = 0; i < bytes.length; i += step) {
    hash = (hash * 33) ^ bytes[i];
  }
  hash = hash >>> 0;
  return hash.toString(16).padStart(8, '0') + ':' + String(bytes.length);
}

function asDate(value: Date | undefined): string | null {
  if (!value || Number.isNaN(value.getTime())) return null;
  return value.toISOString();
}

function catalogHas(doc: PDFDocument, key: string): boolean {
  try {
    return doc.catalog.has(PDFName.of(key));
  } catch {
    return false;
  }
}

function streamBytes(obj: unknown): Uint8Array {
  if (!(obj instanceof PDFRawStream) && !(obj instanceof PDFStream)) {
    return new Uint8Array();
  }
  try {
    if (obj instanceof PDFRawStream) {
      const decoded = decodePDFRawStream(obj);
      if (
        decoded &&
        typeof (decoded as { decode?: () => Uint8Array }).decode === 'function'
      ) {
        return (decoded as { decode: () => Uint8Array }).decode();
      }
    }
  } catch {
    /* fall through */
  }
  try {
    return obj.getContents();
  } catch {
    return new Uint8Array();
  }
}

function catalogLooksActive(doc: PDFDocument): { js: boolean; open: boolean } {
  let js = false;
  let open = catalogHas(doc, 'OpenAction') || catalogHas(doc, 'AA');
  try {
    for (const [, obj] of doc.context.enumerateIndirectObjects()) {
      if (!(obj instanceof PDFDict)) continue;
      if (obj.has(PDFName.of('JS')) || obj.has(PDFName.of('JavaScript')))
        js = true;
      const s = obj.get(PDFName.of('S'));
      if (s instanceof PDFName) {
        const name = s.toString().replace(/^\//, '');
        if (name === 'JavaScript') js = true;
      }
    }
  } catch {
    /* ignore */
  }
  const subject = doc.getSubject() || '';
  const title = doc.getTitle() || '';
  const metaProbe = `${subject} ${title}`;
  if (/\/JavaScript\b|\/JS\b/.test(metaProbe) || /JavaScript/.test(metaProbe))
    js = true;
  if (/\/OpenAction\b|\/AA\b/.test(metaProbe)) open = true;
  return { js, open };
}

function contentLength(
  doc: PDFDocument,
  pageIndex: number
): {
  bytes: Uint8Array;
  length: number;
} {
  const page = doc.getPage(pageIndex);
  const contents = page.node.Contents();
  if (!contents) return { bytes: new Uint8Array(), length: 0 };
  if (contents instanceof PDFArray) {
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (let i = 0; i < contents.size(); i++) {
      const part = streamBytes(doc.context.lookup(contents.get(i)));
      chunks.push(part);
      total += part.length;
    }
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    return { bytes: merged, length: total };
  }
  const looked = doc.context.lookup(contents);
  const bytes = streamBytes(looked);
  return { bytes, length: bytes.length };
}

function resourceInfo(
  doc: PDFDocument,
  pageIndex: number
): {
  hasFont: boolean;
  hasImage: boolean;
  imageCount: number;
  largeResources: number;
} {
  const page = doc.getPage(pageIndex);
  const resources = page.node.Resources();
  if (!(resources instanceof PDFDict)) {
    return {
      hasFont: false,
      hasImage: false,
      imageCount: 0,
      largeResources: 0,
    };
  }
  const font = resources.lookup(PDFName.of('Font'));
  const xobject = resources.lookup(PDFName.of('XObject'));
  let hasFont = font instanceof PDFDict && font.keys().length > 0;
  let imageCount = 0;
  let largeResources = 0;
  if (xobject instanceof PDFDict) {
    for (const key of xobject.keys()) {
      const obj = doc.context.lookup(xobject.get(key));
      const dict =
        obj instanceof PDFDict ? obj : (obj as { dict?: PDFDict })?.dict;
      const subtype =
        dict instanceof PDFDict ? dict.get(PDFName.of('Subtype')) : undefined;
      const isImage =
        subtype instanceof PDFName && subtype.decodeText() === 'Image';
      if (isImage) imageCount += 1;
      const bytes = streamBytes(obj);
      if (bytes.length >= LARGE_RESOURCE_BYTES) largeResources += 1;
    }
  }
  if (!hasFont) {
    const raw = latin1(contentLength(doc, pageIndex).bytes, 8000);
    hasFont = /\/(F\d+|Font|Tf)\b/.test(raw);
  }
  return {
    hasFont,
    hasImage: imageCount > 0,
    imageCount,
    largeResources,
  };
}

function annotationCount(doc: PDFDocument, pageIndex: number): number {
  const annots = doc.getPage(pageIndex).node.Annots();
  if (annots instanceof PDFArray) return annots.size();
  return 0;
}

function pageKind(record: Omit<PageRecord, 'kind'>): PageKind {
  if (record.probableBlank) return 'empty';
  if (record.hasImage && !record.hasFont) return 'scan';
  if (record.hasImage && record.hasFont) return 'mixed';
  if (record.hasFont) return 'text';
  return 'unknown';
}

function metadataOf(doc: PDFDocument): MetadataSnapshot {
  const get = (fn: () => string | undefined) => {
    try {
      const value = fn();
      return value && value.trim() ? value.trim() : null;
    } catch {
      return null;
    }
  };
  return {
    title: get(() => doc.getTitle()),
    author: get(() => doc.getAuthor()),
    subject: get(() => doc.getSubject()),
    creator: get(() => doc.getCreator()),
    producer: get(() => doc.getProducer()),
    keywords: get(() => {
      const keywords = doc.getKeywords();
      return Array.isArray(keywords) ? keywords.join(', ') : keywords;
    }),
    creationDate: asDate(doc.getCreationDate()),
    modificationDate: asDate(doc.getModificationDate()),
  };
}

function countAttachments(raw: string, doc: PDFDocument): number {
  let count = 0;
  try {
    const names = doc.catalog.lookup(PDFName.of('Names'));
    if (names instanceof PDFDict) {
      const embedded = names.lookup(PDFName.of('EmbeddedFiles'));
      if (embedded instanceof PDFDict) {
        const namesArr = embedded.lookup(PDFName.of('Names'));
        if (namesArr instanceof PDFArray)
          count += Math.floor(namesArr.size() / 2);
      }
    }
  } catch {
    /* catalog shape varies */
  }
  const fileSpecHits = raw.match(/\/FileAttachment/g);
  if (fileSpecHits) count = Math.max(count, fileSpecHits.length);
  return count;
}

function countSignatures(raw: string): number {
  const hits = raw.match(/\/Subtype\s*\/Sig\b/g);
  return hits ? hits.length : 0;
}

function formFieldCount(doc: PDFDocument): number {
  try {
    return doc.getForm().getFields().length;
  } catch {
    return 0;
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const error = new Error('Inspect cancelled');
    error.name = 'AbortError';
    throw error;
  }
}

function buildFindings(
  facts: DocumentFacts,
  pages: PageRecord[]
): InspectFinding[] {
  const findings: InspectFinding[] = [];
  const pageNos = (indexes: number[]) => indexes.map((i) => i + 1);

  const blanks = pages.filter((p) => p.probableBlank).map((p) => p.index);
  if (blanks.length) {
    findings.push({
      id: 'blank-pages',
      title: 'Pages that appear blank',
      summary: `${blanks.length} page${blanks.length === 1 ? '' : 's'} have almost no content stream.`,
      hedge:
        'Appears blank — hidden white text or tiny objects can still be present.',
      severity: 'attention',
      pages: pageNos(blanks),
      recommendedOp: 'remove-blank',
      explanation:
        'Remove pages that look empty. Review the page map first; this does not run until you execute the flow.',
    });
  }

  const hashGroups = new Map<string, number[]>();
  for (const page of pages) {
    if (page.contentBytes < BLANK_CONTENT_THRESHOLD) continue;
    const list = hashGroups.get(page.contentHash) || [];
    list.push(page.index);
    hashGroups.set(page.contentHash, list);
  }
  const duplicateIndexes: number[] = [];
  for (const group of hashGroups.values()) {
    if (group.length > 1) duplicateIndexes.push(...group.slice(1));
  }
  if (duplicateIndexes.length) {
    findings.push({
      id: 'probable-duplicates',
      title: 'Probable duplicate pages',
      summary: `${duplicateIndexes.length} page${duplicateIndexes.length === 1 ? '' : 's'} share a content hash with an earlier page.`,
      hedge:
        'Probable duplicates — identical streams can still differ in annotations or crop boxes.',
      severity: 'attention',
      pages: pageNos(duplicateIndexes),
      recommendedOp: 'delete-pages',
      recommendedParams: { pages: pageNos(duplicateIndexes).join(',') },
      explanation:
        'Delete pages that look like repeats. Confirm the highlighted pages before executing.',
    });
  }

  const scans = pages.filter((p) => p.kind === 'scan').map((p) => p.index);
  if (scans.length) {
    findings.push({
      id: 'text-vs-scan',
      title: 'Likely scanned pages',
      summary: `${scans.length} page${scans.length === 1 ? '' : 's'} look image-only, with little extractable text.`,
      hedge:
        'Looks like a scan — OCR quality depends on resolution and language packs.',
      severity: 'info',
      pages: pageNos(scans),
      recommendedOp: 'ocr',
      explanation:
        'Add an OCR step to try to create a text layer. This is best-effort and does not run until you execute.',
    });
  }

  const imageHeavy = pages.filter(
    (p) => p.hasImage && p.contentBytes > IMAGE_HEAVY_RATIO * facts.byteLength
  );
  if (
    pages.filter((p) => p.hasImage).length >=
    Math.max(1, Math.ceil(pages.length * 0.6))
  ) {
    findings.push({
      id: 'image-heavy',
      title: 'Image-heavy document',
      summary:
        'Most pages include embedded images, which often dominate file size.',
      hedge:
        'Image-heavy — compressing may reduce quality and still not shrink every file.',
      severity: 'info',
      pages: pageNos(imageHeavy.map((p) => p.index)),
      recommendedOp: 'compress',
      recommendedParams: { level: 'balanced' },
      explanation:
        'Attempt structural and image compression. Keep the original; not every PDF gets smaller.',
    });
  }

  if (facts.mixedPageSize) {
    findings.push({
      id: 'mixed-size',
      title: 'Mixed page sizes',
      summary: 'Pages do not all share the same media box.',
      hedge: 'Mixed sizes — normalizing may letterbox or scale content.',
      severity: 'info',
      pages: pageNos(pages.map((p) => p.index)),
      recommendedOp: 'fix-page-size',
      recommendedParams: { targetSize: 'A4', orientation: 'preserve' },
      explanation:
        'Normalize page size for printing or an application packet. Review the preview first.',
    });
  }

  const rotated = pages
    .filter((p) => p.rotation % 360 !== 0)
    .map((p) => p.index);
  if (rotated.length) {
    findings.push({
      id: 'rotation',
      title: 'Rotated pages',
      summary: `${rotated.length} page${rotated.length === 1 ? '' : 's'} declare a non-zero /Rotate value.`,
      hedge: 'Declared rotation — viewers may already display these upright.',
      severity: 'info',
      pages: pageNos(rotated),
      recommendedOp: 'rotate',
      recommendedParams: { angle: 0 },
      explanation:
        'Adjust rotation if pages look sideways. Scope is the highlighted pages.',
    });
  }

  const metaBits = [
    facts.metadata.author,
    facts.metadata.title,
    facts.metadata.creator,
    facts.metadata.producer,
    facts.metadata.creationDate,
    facts.metadata.modificationDate,
  ].filter(Boolean);
  if (metaBits.length) {
    findings.push({
      id: 'metadata',
      title: 'Document metadata',
      summary: `Title, author, dates, or producer fields are present (${metaBits.length} fields).`,
      hedge: 'Metadata is visible to anyone who opens the file properties.',
      severity: 'privacy',
      pages: [],
      recommendedOp: 'remove-metadata',
      explanation:
        'Strip catalog metadata. XMP packets this engine cannot see may remain. This is not a legal hold.',
    });
  }

  if (facts.encrypted) {
    findings.push({
      id: 'encryption',
      title: 'Encryption markers',
      summary: 'This file appears to use PDF encryption.',
      hedge:
        'Encryption — a password may still be required for some operations.',
      severity: 'risk',
      pages: [],
      recommendedOp: 'decrypt',
      explanation:
        'Decrypt only if you have the password. Passwords stay in memory for this session and are never stored in recipes.',
    });
  }

  if (facts.hasAttachments) {
    findings.push({
      id: 'attachments',
      title: 'Embedded files',
      summary: `About ${facts.attachmentCount} embedded file${facts.attachmentCount === 1 ? '' : 's'} were found.`,
      hedge:
        'Attachments may include spreadsheets or other PDFs that Inspect does not open.',
      severity: 'privacy',
      pages: [],
      recommendedOp: 'sanitize',
      recommendedParams: { removeEmbeddedFiles: true },
      explanation:
        'Remove embedded files during Privacy Clean. Review first; this does not run automatically.',
    });
  }

  if (facts.hasForm) {
    findings.push({
      id: 'forms',
      title: 'Interactive form fields',
      summary: `${facts.formFieldCount} form field${facts.formFieldCount === 1 ? '' : 's'} were found.`,
      hedge:
        'Filled values can remain extractable until the form is flattened.',
      severity: 'privacy',
      pages: [],
      recommendedOp: 'flatten',
      explanation:
        'Flatten fields so values become page content. Recipients will not be able to edit them.',
    });
  }

  if (facts.hasAnnotations) {
    findings.push({
      id: 'annotations',
      title: 'Annotations',
      summary: `${facts.annotationCount} annotation object${facts.annotationCount === 1 ? '' : 's'} were counted.`,
      hedge: 'Comments and markup can contain names and review text.',
      severity: 'privacy',
      pages: pages.filter((p) => p.annotationCount > 0).map((p) => p.index + 1),
      recommendedOp: 'remove-annotations',
      explanation:
        'Remove annotations. Flatten is a different step if you want appearances kept as drawings.',
    });
  }

  if (facts.hasJavaScript || facts.hasOpenAction) {
    findings.push({
      id: 'active-content',
      title: 'JavaScript or open actions',
      summary:
        'The file catalog or body looks like it contains /JS, /JavaScript, /OpenAction, or /AA.',
      hedge:
        'Possible active content — this is a heuristic over catalog names, not a sandbox.',
      severity: 'risk',
      pages: [],
      recommendedOp: 'sanitize',
      recommendedParams: { removeJavascript: true },
      explanation:
        'Privacy Clean tries to remove catalog JavaScript this engine can see.',
    });
  }

  if (facts.hasSignatures) {
    findings.push({
      id: 'signatures',
      title: 'Signature dictionary',
      summary: 'A /Sig dictionary is present.',
      hedge:
        'Presence of a signature object is not validation of a certificate.',
      severity: 'info',
      pages: [],
      recommendedOp: null,
      explanation:
        'Inspect does not strip signatures by default. Use Validate Signature or Digital Sign tools if you need that work.',
    });
  }

  if (!facts.hasStructTree && !facts.hasMarkInfo) {
    findings.push({
      id: 'a11y',
      title: 'Few accessibility markers',
      summary: 'No /StructTreeRoot or /MarkInfo was found on the catalog.',
      hedge:
        'Missing tags does not prove the file is inaccessible, and tags do not prove it is.',
      severity: 'info',
      pages: [],
      recommendedOp: null,
      explanation: 'Sumi does not auto-tag PDFs. This is an indicator only.',
    });
  } else if (facts.hasStructTree || facts.hasMarkInfo) {
    findings.push({
      id: 'a11y-present',
      title: 'Tagged PDF markers',
      summary:
        [
          facts.hasStructTree ? 'Structure tree' : null,
          facts.hasMarkInfo ? 'MarkInfo' : null,
          facts.hasLanguage ? 'catalog language' : null,
        ]
          .filter(Boolean)
          .join(', ') + ' present.',
      hedge: 'Tags are an indicator, not an accessibility audit.',
      severity: 'info',
      pages: [],
      recommendedOp: null,
      explanation:
        'No automatic change. Sanitize can remove structure trees if you choose that option.',
    });
  }

  const largePages = pages.filter(
    (p) => p.contentBytes >= LARGE_RESOURCE_BYTES
  );
  if (largePages.length || facts.byteLength >= 8_000_000) {
    findings.push({
      id: 'large-resources',
      title: 'Large file or resources',
      summary:
        facts.byteLength >= 8_000_000
          ? `File is ${(facts.byteLength / (1024 * 1024)).toFixed(1)} MB.`
          : `${largePages.length} page content stream${largePages.length === 1 ? '' : 's'} exceed 1 MB.`,
      hedge:
        'Large resources often mean images or fonts — compression is not guaranteed.',
      severity: 'info',
      pages: pageNos(largePages.map((p) => p.index)),
      recommendedOp: 'compress',
      explanation:
        'Add a compress step and compare sizes in Proof. Keep the original.',
    });
  }

  if (facts.byteLength > 0) {
    findings.push({
      id: 'size-pages',
      title: 'Size and pages',
      summary: `${facts.pageCount} page${facts.pageCount === 1 ? '' : 's'}, ${facts.byteLength.toLocaleString()} bytes.`,
      hedge: 'Byte length is the file as loaded, not a compressed estimate.',
      severity: 'info',
      pages: [],
      recommendedOp: null,
      explanation:
        'Informational. Use Compress or Extract pages if you want a smaller export.',
    });
  }

  return findings;
}

export async function analyzePdfBytes(
  bytes: Uint8Array,
  options: AnalyzeOptions
): Promise<DocumentMap> {
  const onProgress = options.onProgress;
  const signal = options.signal;
  throwIfAborted(signal);
  onProgress?.({
    stage: 'structure',
    message: 'Reading catalog…',
    ratio: 0.05,
  });

  const raw = latin1(bytes);
  const encrypted = /\/Encrypt\b/.test(raw);

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, {
      ignoreEncryption: true,
      updateMetadata: false,
      throwOnInvalidObject: false,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const empty: DocumentMap = {
      facts: {
        fileName: options.fileName,
        byteLength: bytes.byteLength,
        pageCount: 0,
        encrypted,
        mixedPageSize: false,
        hasForm: false,
        formFieldCount: 0,
        hasAttachments: false,
        attachmentCount: 0,
        hasAnnotations: false,
        annotationCount: 0,
        hasJavaScript: /\/JavaScript\b|\/JS\b/.test(raw),
        hasOpenAction: /\/OpenAction\b|\/AA\b/.test(raw),
        hasSignatures: countSignatures(raw) > 0,
        hasStructTree: false,
        hasMarkInfo: false,
        hasLanguage: false,
        metadata: {
          title: null,
          author: null,
          subject: null,
          creator: null,
          producer: null,
          keywords: null,
          creationDate: null,
          modificationDate: null,
        },
      },
      pages: [],
      findings: [
        {
          id: 'unreadable',
          title: 'Could not parse this PDF',
          summary: message,
          hedge: 'The file may be damaged, encrypted, or not a PDF.',
          severity: 'risk',
          pages: [],
          recommendedOp: null,
          explanation: 'Inspect stops here. Nothing was modified.',
        },
      ],
      cancelled: false,
      engine: 'pdf-lib',
      limitations: ['Parser could not open this file.'],
    };
    return empty;
  }

  throwIfAborted(signal);
  const pageCount = doc.getPageCount();
  const attachmentCount = countAttachments(raw, doc);
  const formCount = formFieldCount(doc);
  const active = catalogLooksActive(doc);
  const facts: DocumentFacts = {
    fileName: options.fileName,
    byteLength: bytes.byteLength,
    pageCount,
    encrypted,
    mixedPageSize: false,
    hasForm: formCount > 0 || catalogHas(doc, 'AcroForm'),
    formFieldCount: formCount,
    hasAttachments: attachmentCount > 0,
    attachmentCount,
    hasAnnotations: false,
    annotationCount: 0,
    hasJavaScript: /\/JavaScript\b|\/JS[\s/]/.test(raw) || active.js,
    hasOpenAction:
      /\/OpenAction\b/.test(raw) || /\/AA\s/.test(raw) || active.open,
    hasSignatures: countSignatures(raw) > 0 || catalogHas(doc, 'Perms'),
    hasStructTree: catalogHas(doc, 'StructTreeRoot'),
    hasMarkInfo: catalogHas(doc, 'MarkInfo'),
    hasLanguage: catalogHas(doc, 'Lang'),
    metadata: metadataOf(doc),
  };

  onProgress?.({
    stage: 'pages',
    message: `Mapping ${pageCount} page${pageCount === 1 ? '' : 's'}…`,
    ratio: 0.2,
  });

  const pages: PageRecord[] = [];
  const sizeKeys = new Set<string>();
  for (let i = 0; i < pageCount; i++) {
    throwIfAborted(signal);
    const page = doc.getPage(i);
    const { width, height } = page.getSize();
    const rotation = page.getRotation().angle || 0;
    const content = contentLength(doc, i);
    const resources = resourceInfo(doc, i);
    const annots = annotationCount(doc, i);
    const orientation =
      Math.abs(width - height) < 1
        ? 'square'
        : width > height
          ? 'landscape'
          : 'portrait';
    const recordBase = {
      index: i,
      widthPt: Math.round(width * 10) / 10,
      heightPt: Math.round(height * 10) / 10,
      rotation,
      orientation: orientation as PageRecord['orientation'],
      contentBytes: content.length,
      hasFont: resources.hasFont,
      hasImage: resources.hasImage,
      imageCount: resources.imageCount,
      annotationCount: annots,
      probableBlank:
        content.length < BLANK_CONTENT_THRESHOLD &&
        !resources.hasImage &&
        annots === 0,
      contentHash:
        djb2(content.bytes) + `@${Math.round(width)}x${Math.round(height)}`,
    };
    pages.push({ ...recordBase, kind: pageKind(recordBase) });
    sizeKeys.add(`${Math.round(width)}x${Math.round(height)}`);
    facts.annotationCount += annots;
    if ((i + 1) % 8 === 0 || i === pageCount - 1) {
      onProgress?.({
        stage: 'pages',
        message: `Mapped page ${i + 1} of ${pageCount}`,
        ratio: 0.2 + (0.55 * (i + 1)) / Math.max(1, pageCount),
      });
    }
  }
  facts.mixedPageSize = sizeKeys.size > 1;
  facts.hasAnnotations = facts.annotationCount > 0;

  throwIfAborted(signal);
  onProgress?.({
    stage: 'privacy',
    message: 'Collecting privacy findings…',
    ratio: 0.85,
  });

  const findings = buildFindings(facts, pages);
  onProgress?.({ stage: 'done', message: 'Inspect complete', ratio: 1 });

  return {
    facts,
    pages,
    findings,
    cancelled: false,
    engine: 'pdf-lib',
    limitations: [
      'Inspect uses pdf-lib in this tab. It does not execute JavaScript or open attachments.',
      'Blank, duplicate, and scan labels are heuristics.',
      'Nothing was modified.',
    ],
  };
}
