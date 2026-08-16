import { sha256Hex } from '../../proof/hash';
import { PROOF_DISCLAIMER, type ProofReport } from '../../proof/types';

export const PROOF_RECEIPT_SCHEMA = 'sumi.proof.receipt';
export const PROOF_RECEIPT_VERSION = 1;

export interface ProofReceiptV1 {
  schema: typeof PROOF_RECEIPT_SCHEMA;
  schemaVersion: number;
  notACertificate: true;
  notASignature: true;
  notATimestamp: true;
  disclaimer: string;
  generatedAt: string;
  original: { name: string; sha256: string; byteLength: number };
  output: { name: string; sha256: string; byteLength: number };
  ops: string[];
  claims: Array<{
    id: string;
    text: string;
    verifiable: boolean;
    reason?: string;
  }>;
}

export type VerifyStatus = 'match' | 'mismatch' | 'unverifiable' | 'invalid';

export interface VerifyFinding {
  id: string;
  status: VerifyStatus;
  detail: string;
}

export interface VerifyReport {
  ok: boolean;
  schemaVersion: number | null;
  findings: VerifyFinding[];
  unverifiable: string[];
  disclaimer: string;
}

export function receiptFromProof(report: ProofReport): ProofReceiptV1 {
  const claims: ProofReceiptV1['claims'] = [
    {
      id: 'hash-original',
      text: 'Original SHA-256 matches the file you still have.',
      verifiable: true,
    },
    {
      id: 'hash-output',
      text: 'Output SHA-256 matches the exported file.',
      verifiable: true,
    },
    {
      id: 'ops',
      text: 'Listed flow operations ran in this tab.',
      verifiable: true,
      reason:
        'The receipt records op names. It cannot prove a GUI click history.',
    },
    {
      id: 'hidden-data',
      text: 'All hidden data is gone.',
      verifiable: false,
      reason:
        'Rasterized secrets, unparsed XMP, and attachments Sentinel did not open are unverifiable.',
    },
    {
      id: 'identity',
      text: 'This receipt authenticates a person or organization.',
      verifiable: false,
      reason: 'Not a signature, timestamp, or identity certificate.',
    },
  ];
  return {
    schema: PROOF_RECEIPT_SCHEMA,
    schemaVersion: PROOF_RECEIPT_VERSION,
    notACertificate: true,
    notASignature: true,
    notATimestamp: true,
    disclaimer: report.disclaimer || PROOF_DISCLAIMER,
    generatedAt: report.generatedAt,
    original: {
      name: report.originalName,
      sha256: report.before.sha256,
      byteLength: report.before.byteLength,
    },
    output: {
      name: report.outputName,
      sha256: report.after.sha256,
      byteLength: report.after.byteLength,
    },
    ops: report.flowStepNames,
    claims,
  };
}

export async function verifyProofReceipt(options: {
  originalBytes: Uint8Array;
  outputBytes: Uint8Array;
  receipt: unknown;
}): Promise<VerifyReport> {
  const findings: VerifyFinding[] = [];
  const unverifiable: string[] = [];
  const parsed = options.receipt as
    | Partial<ProofReceiptV1>
    | ProofReport
    | null;
  if (!parsed || typeof parsed !== 'object') {
    return {
      ok: false,
      schemaVersion: null,
      findings: [
        {
          id: 'schema',
          status: 'invalid',
          detail: 'Receipt is not JSON.',
        },
      ],
      unverifiable: [],
      disclaimer: PROOF_DISCLAIMER,
    };
  }

  const schemaVersion =
    'schemaVersion' in parsed && typeof parsed.schemaVersion === 'number'
      ? parsed.schemaVersion
      : 'product' in parsed
        ? 0
        : null;
  if (
    'schema' in parsed &&
    parsed.schema &&
    parsed.schema !== PROOF_RECEIPT_SCHEMA
  ) {
    findings.push({
      id: 'schema',
      status: 'mismatch',
      detail: `Unknown schema ${String(parsed.schema)}.`,
    });
  } else if (schemaVersion !== PROOF_RECEIPT_VERSION && schemaVersion !== 0) {
    findings.push({
      id: 'schema',
      status: 'unverifiable',
      detail: `Schema version ${schemaVersion} is not this verifier’s version ${PROOF_RECEIPT_VERSION}.`,
    });
  } else {
    findings.push({
      id: 'schema',
      status: 'match',
      detail: `Schema ${PROOF_RECEIPT_SCHEMA} v${PROOF_RECEIPT_VERSION} (legacy Proof reports are accepted as v0).`,
    });
  }

  const originalHash = await sha256Hex(options.originalBytes);
  const outputHash = await sha256Hex(options.outputBytes);
  const claimedOriginal =
    'original' in parsed && parsed.original
      ? parsed.original.sha256
      : 'before' in parsed
        ? parsed.before.sha256
        : '';
  const claimedOutput =
    'output' in parsed && parsed.output
      ? parsed.output.sha256
      : 'after' in parsed
        ? parsed.after.sha256
        : '';

  findings.push({
    id: 'hash-original',
    status:
      claimedOriginal && claimedOriginal === originalHash
        ? 'match'
        : 'mismatch',
    detail:
      claimedOriginal === originalHash
        ? 'Original SHA-256 matches the receipt.'
        : 'Original bytes do not match the receipt hash.',
  });
  findings.push({
    id: 'hash-output',
    status:
      claimedOutput && claimedOutput === outputHash ? 'match' : 'mismatch',
    detail:
      claimedOutput === outputHash
        ? 'Output SHA-256 matches the receipt.'
        : 'Output bytes do not match the receipt hash.',
  });

  const ops =
    'ops' in parsed && Array.isArray(parsed.ops)
      ? parsed.ops
      : 'flowStepNames' in parsed
        ? parsed.flowStepNames
        : [];
  findings.push({
    id: 'ops',
    status: ops.length ? 'match' : 'unverifiable',
    detail: ops.length
      ? `Receipt lists operations: ${ops.join(', ')}.`
      : 'Receipt lists no operations.',
  });

  const claims =
    'claims' in parsed && Array.isArray(parsed.claims)
      ? parsed.claims
      : [
          {
            id: 'hidden-data',
            text: 'All hidden data is gone',
            verifiable: false,
            reason: 'Cannot prove absence of hidden data.',
          },
        ];
  for (const claim of claims) {
    if (!claim.verifiable) {
      unverifiable.push(claim.text);
      findings.push({
        id: claim.id,
        status: 'unverifiable',
        detail: claim.reason || claim.text,
      });
    }
  }

  findings.push({
    id: 'not-legal',
    status: 'unverifiable',
    detail:
      'This verifier is not a digital signature, not a trusted timestamp, not authenticity of a person, and not a legal certificate.',
  });
  unverifiable.push('legal certificate / signature / timestamp / authenticity');

  const ok = findings.every(
    (f) => f.status === 'match' || f.status === 'unverifiable'
  );
  return {
    ok,
    schemaVersion,
    findings,
    unverifiable,
    disclaimer: PROOF_DISCLAIMER,
  };
}
