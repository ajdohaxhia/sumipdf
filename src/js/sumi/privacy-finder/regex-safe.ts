/**
 * Reject catastrophic custom regex patterns before execution.
 * Expensive scans should run in a cancellable worker (see regex-worker).
 */

const MAX_PATTERN_LENGTH = 120;
const MAX_GROUPS = 8;
const MAX_QUANTIFIERS = 12;

function looksExpensive(source: string): boolean {
  if (/(\.\*){2,}/.test(source) || /(\.\+){2,}/.test(source)) return true;
  if (/\(.*[+*].*\)[+*]/.test(source)) return true;
  if (/\(\?[^)]*\)[+*{]/.test(source)) return true;
  const nestedGroups = source.match(/\([^)]*[+*][^)]*\)/g);
  if (nestedGroups && nestedGroups.length >= 3) return true;
  return false;
}

export type RegexValidation =
  | { ok: true; pattern: RegExp }
  | { ok: false; reason: string };

export function validateCustomRegex(
  source: string,
  flags = 'gi'
): RegexValidation {
  const trimmed = source.trim();
  if (!trimmed) return { ok: false, reason: 'Regex is empty.' };
  if (trimmed.length > MAX_PATTERN_LENGTH) {
    return {
      ok: false,
      reason: `Regex longer than ${MAX_PATTERN_LENGTH} characters is not allowed.`,
    };
  }
  if ((trimmed.match(/\(/g) || []).length > MAX_GROUPS) {
    return { ok: false, reason: 'Too many capturing groups.' };
  }
  const quantifiers = (trimmed.match(/[*+{?]/g) || []).length;
  if (quantifiers > MAX_QUANTIFIERS) {
    return { ok: false, reason: 'Too many quantifiers.' };
  }
  if (looksExpensive(trimmed)) {
    return {
      ok: false,
      reason: 'Pattern looks expensive (nested wildcards). Simplify it.',
    };
  }
  try {
    const normalized = flags.includes('g') ? flags : `${flags}g`;
    return { ok: true, pattern: new RegExp(trimmed, normalized) };
  } catch (error) {
    return {
      ok: false,
      reason:
        error instanceof Error ? error.message : 'Invalid regular expression.',
    };
  }
}

export function matchCustomRegex(
  text: string,
  source: string,
  signal?: AbortSignal
): Array<{ value: string; start: number; end: number }> {
  const validated = validateCustomRegex(source);
  if (validated.ok === false) {
    throw new Error(validated.reason);
  }
  if (signal?.aborted) {
    const err = new Error('Regex scan cancelled');
    err.name = 'AbortError';
    throw err;
  }
  const hits: Array<{ value: string; start: number; end: number }> = [];
  const re = new RegExp(source.trim(), 'gi');
  let match: RegExpExecArray | null;
  let guard = 0;
  while ((match = re.exec(text))) {
    if (signal?.aborted) {
      const err = new Error('Regex scan cancelled');
      err.name = 'AbortError';
      throw err;
    }
    hits.push({
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
    if (match[0].length === 0) re.lastIndex += 1;
    guard += 1;
    if (guard > 5000) {
      throw new Error(
        'Custom regex produced too many matches; refine the pattern.'
      );
    }
  }
  return hits;
}
