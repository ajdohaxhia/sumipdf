import { PDFArray, PDFDict, PDFName, PDFDocument } from 'pdf-lib';
import { latin1 } from '../shared/bytes';
import {
  actionType,
  catalogHas,
  loadPdf,
  lookupDict,
  nameOf,
  pageContentBytes,
  streamBytes,
  walkIndirectDicts,
} from '../shared/pdf';
import {
  SENTINEL_DISCLAIMER,
  type SentinelFinding,
  type SentinelReport,
} from './types';

const LARGE_STREAM = 1_000_000;
const HIGH_RISK_ACTIONS = new Set([
  'JavaScript',
  'Launch',
  'SubmitForm',
  'GoToR',
  'GoToE',
  'ImportData',
  'RichMediaExecute',
]);
const MEDIA_SUBTYPES = new Set([
  'RichMedia',
  'Screen',
  'Movie',
  'Sound',
  '3D',
  'RichMediaSettings',
]);

function finding(
  partial: Omit<SentinelFinding, 'id'> & { id?: string }
): SentinelFinding {
  return {
    id:
      partial.id ||
      `${partial.category}-${partial.object || partial.page || 'doc'}`,
    ...partial,
  };
}

function decodeMaybe(dict: PDFDict, key: string): string | null {
  const value = dict.get(PDFName.of(key));
  if (!value) return null;
  try {
    if ('decodeText' in value && typeof value.decodeText === 'function') {
      return String(value.decodeText());
    }
  } catch {
    /* ignore */
  }
  const text = String(value);
  return text.length > 240 ? `${text.slice(0, 240)}…` : text;
}

function countName(raw: string, token: string): number {
  const re = new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  return raw.match(re)?.length ?? 0;
}

export async function scanSentinel(
  bytes: Uint8Array,
  fileName = 'document.pdf'
): Promise<SentinelReport> {
  const raw = latin1(bytes);
  const findings: SentinelFinding[] = [];
  let pageCount = 0;
  let doc: PDFDocument | null = null;

  try {
    doc = await loadPdf(bytes);
    pageCount = doc.getPageCount();
  } catch (error) {
    findings.push(
      finding({
        category: 'malformed',
        severity: 'Potentially unsafe',
        title: 'Parser could not open this file cleanly',
        explanation:
          'pdf-lib rejected or partially read the file. Sentinel still does not execute anything.',
        evidence: error instanceof Error ? error.message : String(error),
        page: null,
        object: null,
        canRemove: false,
        impact: 'Other findings may be incomplete. Nothing was modified.',
        recommendedOp: null,
      })
    );
  }

  if (/\/Encrypt\b/.test(raw) || (doc && catalogHas(doc, 'Encrypt'))) {
    findings.push(
      finding({
        category: 'encryption',
        severity: 'Review',
        title: 'Encryption dictionary present',
        explanation:
          'The file declares /Encrypt. Some objects may be unreadable without a password.',
        evidence: '/Encrypt',
        page: null,
        object: 'trailer',
        canRemove: false,
        impact:
          'Decrypt only if you have the password. Passwords stay in this tab.',
        recommendedOp: 'decrypt',
      })
    );
  }

  if (doc) {
    walkIndirectDicts(doc, (dict, ref) => {
      const type = actionType(dict);
      const objId = `${ref.objectNumber} ${ref.generationNumber} R`;
      if (
        type === 'JavaScript' ||
        dict.has(PDFName.of('JS')) ||
        dict.has(PDFName.of('JavaScript'))
      ) {
        const js =
          decodeMaybe(dict, 'JS') || decodeMaybe(dict, 'JavaScript') || '/JS';
        findings.push(
          finding({
            category: 'javascript',
            severity: 'High risk',
            title: 'JavaScript action dictionary',
            explanation:
              'A JavaScript action was found. Sentinel records the dictionary and does not run it.',
            evidence: js.slice(0, 280),
            page: null,
            object: objId,
            canRemove: true,
            impact:
              'Safe Copy removes catalog and annotation JavaScript this engine can see.',
            recommendedOp: 'sentinel-safe-copy',
          })
        );
      }
      if (type === 'Launch') {
        findings.push(
          finding({
            category: 'launch',
            severity: 'High risk',
            title: 'Launch action',
            explanation:
              'A Launch action can ask a viewer to open a local file or program. This review does not follow it.',
            evidence:
              decodeMaybe(dict, 'F') || decodeMaybe(dict, 'Win') || '/Launch',
            page: null,
            object: objId,
            canRemove: true,
            impact: 'Safe Copy strips Launch actions it can reach.',
            recommendedOp: 'sentinel-safe-copy',
          })
        );
      }
      if (type === 'SubmitForm') {
        findings.push(
          finding({
            category: 'submit-form',
            severity: 'High risk',
            title: 'SubmitForm action',
            explanation:
              'SubmitForm can send field values to a URL when a viewer honors it. Sumi does not submit.',
            evidence: decodeMaybe(dict, 'F') || '/SubmitForm',
            page: null,
            object: objId,
            canRemove: true,
            impact:
              'Safe Copy removes the action. Field values may still sit in the form.',
            recommendedOp: 'sentinel-safe-copy',
          })
        );
      }
      if (type === 'GoToR' || type === 'GoToE') {
        findings.push(
          finding({
            category: 'goto-remote',
            severity: 'Potentially unsafe',
            title: 'Remote or embedded go-to action',
            explanation:
              'GoToR/GoToE points at another file or an embedded file. Sentinel does not open the target.',
            evidence: decodeMaybe(dict, 'F') || type,
            page: null,
            object: objId,
            canRemove: true,
            impact: 'Removing the action does not delete the referenced file.',
            recommendedOp: 'sentinel-safe-copy',
          })
        );
      }
      if (type === 'URI' || dict.has(PDFName.of('URI'))) {
        const uri = decodeMaybe(dict, 'URI') || '/URI';
        findings.push(
          finding({
            category: 'uri',
            severity: 'Review',
            title: 'URI action',
            explanation:
              'A URI action stores a link. Sentinel does not fetch it.',
            evidence: uri,
            page: null,
            object: objId,
            canRemove: true,
            impact:
              'Safe Copy can drop link actions. Visible URL text on the page can remain.',
            recommendedOp: 'sentinel-safe-copy',
          })
        );
      }
      const subtype = nameOf(dict, 'Subtype');
      if (subtype && MEDIA_SUBTYPES.has(subtype)) {
        findings.push(
          finding({
            category: 'rich-media',
            severity: 'Potentially unsafe',
            title: `Rich media subtype /${subtype}`,
            explanation:
              'Rich media, movies, sound, or 3D annotations can carry active content. They are not played here.',
            evidence: `/${subtype}`,
            page: null,
            object: objId,
            canRemove: true,
            impact:
              'Safe Copy removes annotations, including these subtypes when listed as Annots.',
            recommendedOp: 'sentinel-safe-copy',
          })
        );
      }
      if (subtype === 'Sig' || dict.has(PDFName.of('ByteRange'))) {
        findings.push(
          finding({
            category: 'signature',
            severity: 'Information',
            title: 'Signature dictionary',
            explanation:
              'A signature object is present. This is not certificate validation.',
            evidence: '/Sig',
            page: null,
            object: objId,
            canRemove: false,
            impact:
              'Safe Copy does not strip signatures by default. Use Validate Signature for cert details.',
            recommendedOp: null,
          })
        );
      }
    });

    if (catalogHas(doc, 'OpenAction')) {
      const open = lookupDict(doc, doc.catalog.get(PDFName.of('OpenAction')));
      const kind = open ? actionType(open) || 'OpenAction' : 'OpenAction';
      findings.push(
        finding({
          category: 'open-action',
          severity: HIGH_RISK_ACTIONS.has(kind)
            ? 'High risk'
            : 'Potentially unsafe',
          title: 'Catalog OpenAction',
          explanation:
            'OpenAction runs when a viewer opens the file. Sentinel does not honor it.',
          evidence: kind,
          page: null,
          object: 'catalog',
          canRemove: true,
          impact: 'Safe Copy deletes catalog OpenAction.',
          recommendedOp: 'sentinel-safe-copy',
        })
      );
      if (
        open &&
        (kind === 'JavaScript' ||
          open.has(PDFName.of('JS')) ||
          open.has(PDFName.of('JavaScript')))
      ) {
        findings.push(
          finding({
            id: 'javascript-open-action',
            category: 'javascript',
            severity: 'High risk',
            title: 'JavaScript in OpenAction',
            explanation:
              'OpenAction points at a JavaScript action. Sentinel records it and does not run it.',
            evidence:
              decodeMaybe(open, 'JS') ||
              decodeMaybe(open, 'JavaScript') ||
              '/JavaScript',
            page: null,
            object: 'catalog OpenAction',
            canRemove: true,
            impact:
              'Safe Copy removes catalog OpenAction and JavaScript it can see.',
            recommendedOp: 'sentinel-safe-copy',
          })
        );
      }
    }

    if (catalogHas(doc, 'AA')) {
      findings.push(
        finding({
          category: 'auto-action',
          severity: 'High risk',
          title: 'Catalog additional actions (/AA)',
          explanation:
            'Document-level additional actions can fire on open, close, or print.',
          evidence: '/AA',
          page: null,
          object: 'catalog',
          canRemove: true,
          impact: 'Safe Copy removes catalog /AA.',
          recommendedOp: 'sentinel-safe-copy',
        })
      );
    }

    const acro = lookupDict(doc, doc.catalog.get(PDFName.of('AcroForm')));
    if (acro) {
      const xfa = acro.has(PDFName.of('XFA'));
      let fieldCount = 0;
      try {
        fieldCount = doc.getForm().getFields().length;
      } catch {
        /* keep zero when the form dictionary is unreadable */
      }
      findings.push(
        finding({
          category: xfa ? 'xfa' : 'acroform',
          severity: xfa ? 'Potentially unsafe' : 'Review',
          title: xfa ? 'XFA form packet' : 'AcroForm fields',
          explanation: xfa
            ? 'XFA can include scripts that ordinary flatten does not fully neutralize.'
            : `${fieldCount} AcroForm field(s) were counted. Values can remain extractable until flatten.`,
          evidence: xfa ? '/XFA' : `/AcroForm fields≈${fieldCount}`,
          page: null,
          object: 'AcroForm',
          canRemove: true,
          impact: xfa
            ? 'Safe Copy flattens when possible and strips JavaScript; XFA remnants can survive.'
            : 'Flatten makes values page content. Recipients cannot edit the fields.',
          recommendedOp: xfa ? 'sentinel-safe-copy' : 'flatten',
        })
      );
    }

    if (catalogHas(doc, 'OCProperties') || /\/OCGs\b/.test(raw)) {
      findings.push(
        finding({
          category: 'ocg',
          severity: 'Review',
          title: 'Optional content groups (layers)',
          explanation:
            'OCG layers can hide page content from a default view while leaving it in the file.',
          evidence: '/OCProperties or /OCGs',
          page: null,
          object: 'catalog',
          canRemove: true,
          impact:
            'Sanitize can drop layers. Hidden text on a default view may still be extractable.',
          recommendedOp: 'sentinel-safe-copy',
        })
      );
    }

    if (catalogHas(doc, 'Metadata') || doc.getTitle() || doc.getAuthor()) {
      findings.push(
        finding({
          category: 'metadata',
          severity: 'Information',
          title: 'Metadata or XMP packet',
          explanation: 'Info dictionary and/or catalog Metadata are present.',
          evidence:
            [
              doc.getTitle() ? `title=${doc.getTitle()}` : null,
              doc.getAuthor() ? `author=${doc.getAuthor()}` : null,
              catalogHas(doc, 'Metadata') ? '/Metadata' : null,
            ]
              .filter(Boolean)
              .join('; ') || 'metadata',
          page: null,
          object: 'Info/Metadata',
          canRemove: true,
          impact:
            'Remove metadata clears catalog fields this engine can see. Other XMP streams can remain.',
          recommendedOp: 'remove-metadata',
        })
      );
    }

    const hasStruct = catalogHas(doc, 'StructTreeRoot');
    findings.push(
      finding({
        category: 'structure-tree',
        severity: 'Information',
        title: hasStruct
          ? 'Structure tree present'
          : 'No structure tree on the catalog',
        explanation: hasStruct
          ? 'A /StructTreeRoot exists. That is an indicator, not an accessibility audit.'
          : 'No /StructTreeRoot. Missing tags does not prove the file is unusable.',
        evidence: hasStruct ? '/StructTreeRoot' : 'absent',
        page: null,
        object: 'catalog',
        canRemove: hasStruct,
        impact:
          'Safe Copy can strip structure trees. Accessibility Audit is a separate, non-certified pass.',
        recommendedOp: null,
      })
    );

    const names = lookupDict(doc, doc.catalog.get(PDFName.of('Names')));
    const embedded = names
      ? lookupDict(doc, names.get(PDFName.of('EmbeddedFiles')))
      : undefined;
    if (
      embedded ||
      /\/EmbeddedFiles\b/.test(raw) ||
      /\/FileAttachment\b/.test(raw)
    ) {
      findings.push(
        finding({
          category: 'embedded-files',
          severity: 'Review',
          title: 'Embedded files',
          explanation:
            'Embedded files or file-attachment annotations were found. Sentinel does not open them.',
          evidence: '/EmbeddedFiles or /FileAttachment',
          page: null,
          object: 'Names',
          canRemove: true,
          impact: 'Safe Copy removes embedded files this engine can see.',
          recommendedOp: 'sentinel-safe-copy',
        })
      );
    }

    for (let i = 0; i < doc.getPageCount(); i++) {
      const page = doc.getPage(i);
      if (page.node.has(PDFName.of('AA'))) {
        findings.push(
          finding({
            category: 'auto-action',
            severity: 'Potentially unsafe',
            title: `Page ${i + 1} additional actions`,
            explanation:
              'Page-level /AA can run on open, close, or other viewer events.',
            evidence: '/AA',
            page: i + 1,
            object: `page ${i + 1}`,
            canRemove: true,
            impact: 'Safe Copy deletes page /AA.',
            recommendedOp: 'sentinel-safe-copy',
          })
        );
      }
      const annots = page.node.Annots();
      if (annots instanceof PDFArray && annots.size() > 0) {
        findings.push(
          finding({
            id: `annotations-p${i + 1}`,
            category: 'annotations',
            severity: 'Information',
            title: `Page ${i + 1} annotations`,
            explanation: `${annots.size()} annotation object(s) on this page. Comments can hold names and review text.`,
            evidence: `/Annots size=${annots.size()}`,
            page: i + 1,
            object: `page ${i + 1} Annots`,
            canRemove: true,
            impact:
              'Remove annotations or flatten appearances. Safe Copy can do both.',
            recommendedOp: 'remove-annotations',
          })
        );
        for (let a = 0; a < annots.size(); a++) {
          const annot = lookupDict(doc, annots.get(a));
          if (!annot) continue;
          const action =
            lookupDict(doc, annot.get(PDFName.of('A'))) ||
            lookupDict(doc, annot.get(PDFName.of('AA')));
          if (!action) continue;
          const type = actionType(action);
          const objId = `page ${i + 1} annot ${a + 1}`;
          if (
            type === 'JavaScript' ||
            action.has(PDFName.of('JS')) ||
            action.has(PDFName.of('JavaScript'))
          ) {
            findings.push(
              finding({
                id: `javascript-annot-p${i + 1}-${a + 1}`,
                category: 'javascript',
                severity: 'High risk',
                title: `JavaScript annotation action on page ${i + 1}`,
                explanation:
                  'An annotation carries a JavaScript action. Sentinel does not execute it.',
                evidence:
                  decodeMaybe(action, 'JS') ||
                  decodeMaybe(action, 'JavaScript') ||
                  '/JS',
                page: i + 1,
                object: objId,
                canRemove: true,
                impact: 'Safe Copy removes annotation actions it can see.',
                recommendedOp: 'sentinel-safe-copy',
              })
            );
          }
          if (type === 'Launch') {
            findings.push(
              finding({
                id: `launch-annot-p${i + 1}-${a + 1}`,
                category: 'launch',
                severity: 'High risk',
                title: `Launch action on page ${i + 1}`,
                explanation:
                  'A Launch action can ask a viewer to open a local file or program.',
                evidence:
                  decodeMaybe(action, 'F') ||
                  decodeMaybe(action, 'Win') ||
                  '/Launch',
                page: i + 1,
                object: objId,
                canRemove: true,
                impact: 'Safe Copy strips Launch actions it can reach.',
                recommendedOp: 'sentinel-safe-copy',
              })
            );
          }
          if (type === 'URI' || action.has(PDFName.of('URI'))) {
            findings.push(
              finding({
                id: `uri-annot-p${i + 1}-${a + 1}`,
                category: 'uri',
                severity: 'Review',
                title: `URI action on page ${i + 1}`,
                explanation:
                  'A URI action stores a link. Sentinel does not fetch it.',
                evidence: decodeMaybe(action, 'URI') || '/URI',
                page: i + 1,
                object: objId,
                canRemove: true,
                impact:
                  'Safe Copy can drop link actions. Visible URL text on the page can remain.',
                recommendedOp: 'sentinel-safe-copy',
              })
            );
          }
        }
      }
      const content = pageContentBytes(doc, i);
      if (content.length >= LARGE_STREAM) {
        findings.push(
          finding({
            id: `large-stream-p${i + 1}`,
            category: 'large-stream',
            severity: 'Information',
            title: `Large content stream on page ${i + 1}`,
            explanation: `This page content stream is ${(content.length / 1024).toFixed(0)} KB.`,
            evidence: `${content.length} bytes`,
            page: i + 1,
            object: `page ${i + 1} Contents`,
            canRemove: false,
            impact:
              'Large streams often mean images. Compression is not guaranteed.',
            recommendedOp: 'compress',
          })
        );
      }
      const streamText = latin1(content, 200_000);
      if (/\b3\s+Tr\b/.test(streamText) || /\b0\s+Tr\b/.test(streamText)) {
        findings.push(
          finding({
            id: `hidden-text-p${i + 1}`,
            category: 'hidden-text',
            severity: 'Review',
            title: `Possible hidden text on page ${i + 1}`,
            explanation:
              'Text rendering mode 3 (invisible) or 0 with other concealment tricks can hide extractable text.',
            evidence: 'Tr operator 0 or 3 in the content stream',
            page: i + 1,
            object: `page ${i + 1} Contents`,
            canRemove: false,
            impact:
              'Privacy Finder can search extractable strings. Rasterized hidden text needs redaction.',
            recommendedOp: null,
          })
        );
      }
    }

    try {
      for (const [, obj] of doc.context.enumerateIndirectObjects()) {
        const data = streamBytes(obj);
        if (data.length >= LARGE_STREAM) {
          findings.push(
            finding({
              id: `large-obj-${data.length}`,
              category: 'large-stream',
              severity: 'Information',
              title: 'Large indirect stream',
              explanation: `An object stream is ${(data.length / (1024 * 1024)).toFixed(1)} MB.`,
              evidence: `${data.length} bytes`,
              page: null,
              object: 'stream',
              canRemove: false,
              impact:
                'Inspect the page map before compressing. Nothing was modified.',
              recommendedOp: 'compress',
            })
          );
        }
      }
    } catch {
      /* ignore */
    }
  } else {
    if (countName(raw, '/JavaScript') || countName(raw, '/JS')) {
      findings.push(
        finding({
          category: 'javascript',
          severity: 'High risk',
          title: 'JavaScript tokens in the file bytes',
          explanation:
            'Raw scan found /JS or /JavaScript. The parser did not run them.',
          evidence: '/JavaScript or /JS',
          page: null,
          object: 'raw',
          canRemove: false,
          impact: 'Re-open after repair if you need a Safe Copy.',
          recommendedOp: null,
        })
      );
    }
  }

  const unique: SentinelFinding[] = [];
  const seen = new Set<string>();
  for (const item of findings) {
    const key = `${item.category}|${item.object}|${item.evidence.slice(0, 80)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }

  return {
    fileName,
    byteLength: bytes.byteLength,
    pageCount,
    findings: unique,
    executedJavascript: false,
    malwareFreeClaim: false,
    limitations: [
      SENTINEL_DISCLAIMER,
      'Attachments, rich media, and encrypted objects are not opened.',
      'Hidden-text detection is a content-stream heuristic.',
    ],
    generatedAt: new Date().toISOString(),
  };
}

export function neverMalwareFree(report: SentinelReport): boolean {
  return (
    report.malwareFreeClaim === false && report.executedJavascript === false
  );
}
