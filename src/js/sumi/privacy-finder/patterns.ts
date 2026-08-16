// No leading \b: content streams often glue tokens (`SECRETMAIL_ada@…`).
import { matchCustomRegex, validateCustomRegex } from './regex-safe';

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const URL =
  /\bhttps?:\/\/[^\s<>"'()]+|\bwww\.[^\s<>"'()]+\.[A-Z]{2,}[^\s<>"'()]*/gi;
const PHONE =
  /(?:\+|00)[1-9]\d{7,14}|\b0\d{8,11}\b|\b3\d{8,9}\b|\(\d{2,4}\)\s*\d{5,10}/g;
const IPV4 =
  /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d?\d)\b/g;
const IPV6 =
  /\b(?:[0-9A-F]{1,4}:){7}[0-9A-F]{1,4}\b|\b(?:[0-9A-F]{1,4}:){1,7}:\b/gi;
const IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;
const CARD = /\b(?:\d[ -]*?){13,19}\b/g;
const CF = /\b[A-Z]{6}\d{2}[A-EHLMPRST]\d{2}[A-Z0-9]{4}[A-Z]\b/gi;
const VAT = /\bIT\s?\d{11}\b|\b\d{11}\b/gi;
const GPS =
  /\b-?(?:[1-8]?\d(?:\.\d+)?|90(?:\.0+)?)\s*,\s*-?(?:1[0-7]\d(?:\.\d+)?|[1-9]?\d(?:\.\d+)?|180(?:\.0+)?)\b/g;
const DATE =
  /\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})\b/g;
const DOB_CONTEXT =
  /\b(dob|date of birth|born|birthday|nascita|nato|nata|data di nascita)\b/i;

export function luhnOk(digits: string): boolean {
  const nums = digits.replace(/\D/g, '');
  if (nums.length < 13 || nums.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = nums.length - 1; i >= 0; i--) {
    let n = Number(nums[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function ibanOk(iban: string): boolean {
  const compact = iban.replace(/\s+/g, '').toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(compact)) return false;
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  let expanded = '';
  for (const ch of rearranged) {
    expanded += /[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch;
  }
  let rest = 0;
  for (const ch of expanded) {
    rest = (rest * 10 + Number(ch)) % 97;
  }
  return rest === 1;
}

const CF_ODD: Record<string, number> = {
  '0': 1,
  '1': 0,
  '2': 5,
  '3': 7,
  '4': 9,
  '5': 13,
  '6': 15,
  '7': 17,
  '8': 19,
  '9': 21,
  A: 1,
  B: 0,
  C: 5,
  D: 7,
  E: 9,
  F: 13,
  G: 15,
  H: 17,
  I: 19,
  J: 21,
  K: 2,
  L: 4,
  M: 18,
  N: 20,
  O: 11,
  P: 3,
  Q: 6,
  R: 8,
  S: 12,
  T: 14,
  U: 16,
  V: 10,
  W: 22,
  X: 25,
  Y: 24,
  Z: 23,
};
const CF_EVEN: Record<string, number> = {
  '0': 0,
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  A: 0,
  B: 1,
  C: 2,
  D: 3,
  E: 4,
  F: 5,
  G: 6,
  H: 7,
  I: 8,
  J: 9,
  K: 10,
  L: 11,
  M: 12,
  N: 13,
  O: 14,
  P: 15,
  Q: 16,
  R: 17,
  S: 18,
  T: 19,
  U: 20,
  V: 21,
  W: 22,
  X: 23,
  Y: 24,
  Z: 25,
};

export function codiceFiscaleOk(value: string): boolean {
  const cf = value.toUpperCase().replace(/\s+/g, '');
  if (!/^[A-Z]{6}\d{2}[A-EHLMPRST]\d{2}[A-Z0-9]{4}[A-Z]$/.test(cf))
    return false;
  let sum = 0;
  for (let i = 0; i < 15; i++) {
    const ch = cf[i];
    sum += i % 2 === 0 ? (CF_ODD[ch] ?? 0) : (CF_EVEN[ch] ?? 0);
  }
  return cf[15] === String.fromCharCode('A'.charCodeAt(0) + (sum % 26));
}

export function italianVatOk(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  let x = 0;
  let y = 0;
  for (let i = 0; i < 10; i++) {
    const d = Number(digits[i]);
    if (i % 2 === 0) x += d;
    else {
      const doubled = d * 2;
      y += Math.floor(doubled / 10) + (doubled % 10);
    }
  }
  const check = (10 - ((x + y) % 10)) % 10;
  return check === Number(digits[10]);
}

export interface PatternMatch {
  kind:
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
  value: string;
  start: number;
  end: number;
  confidence: 'high' | 'medium' | 'low';
  checksumOk?: boolean;
}

function pushUnique(out: PatternMatch[], item: PatternMatch): void {
  if (
    out.some(
      (existing) =>
        existing.kind === item.kind &&
        existing.start === item.start &&
        existing.value === item.value
    )
  ) {
    return;
  }
  out.push(item);
}

function collect(re: RegExp, text: string): RegExpExecArray[] {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  const copy = new RegExp(re.source, flags);
  const hits: RegExpExecArray[] = [];
  let match: RegExpExecArray | null;
  while ((match = copy.exec(text))) hits.push(match);
  return hits;
}

export function findPatterns(
  text: string,
  customTerms: string[] = [],
  customRegexes: string[] = [],
  signal?: AbortSignal
): PatternMatch[] {
  const out: PatternMatch[] = [];

  for (const match of collect(EMAIL, text)) {
    pushUnique(out, {
      kind: 'email',
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
      confidence: 'high',
    });
  }
  for (const match of collect(URL, text)) {
    if (match[0].includes('@')) continue;
    pushUnique(out, {
      kind: 'url',
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
      confidence: 'medium',
    });
  }
  for (const match of collect(PHONE, text)) {
    const digits = match[0].replace(/\D/g, '');
    if (digits.length < 8) continue;
    pushUnique(out, {
      kind: 'phone',
      value: match[0].trim(),
      start: match.index,
      end: match.index + match[0].length,
      confidence: digits.length >= 10 ? 'medium' : 'low',
    });
  }
  for (const match of collect(IPV4, text)) {
    pushUnique(out, {
      kind: 'ipv4',
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
      confidence: 'high',
    });
  }
  for (const match of collect(IPV6, text)) {
    pushUnique(out, {
      kind: 'ipv6',
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
      confidence: 'medium',
    });
  }
  for (const match of collect(IBAN, text)) {
    const ok = ibanOk(match[0]);
    if (!ok) continue;
    pushUnique(out, {
      kind: 'iban',
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
      confidence: 'high',
      checksumOk: true,
    });
  }
  for (const match of collect(CARD, text)) {
    const ok = luhnOk(match[0]);
    if (!ok) continue;
    pushUnique(out, {
      kind: 'card',
      value: match[0].replace(/\s+/g, ' ').trim(),
      start: match.index,
      end: match.index + match[0].length,
      confidence: 'high',
      checksumOk: true,
    });
  }
  for (const match of collect(CF, text)) {
    const ok = codiceFiscaleOk(match[0]);
    if (!ok) continue;
    pushUnique(out, {
      kind: 'codice-fiscale',
      value: match[0].toUpperCase(),
      start: match.index,
      end: match.index + match[0].length,
      confidence: 'high',
      checksumOk: true,
    });
  }
  for (const match of collect(VAT, text)) {
    if (!italianVatOk(match[0])) continue;
    if (match[0].replace(/\D/g, '').length === 11 && !/^IT/i.test(match[0])) {
      const around = text.slice(
        Math.max(0, match.index - 12),
        match.index + 20
      );
      if (!/\b(P\.?\s*IVA|partita|VAT|IT)\b/i.test(around)) continue;
    }
    pushUnique(out, {
      kind: 'italian-vat',
      value: match[0].replace(/\s+/g, ''),
      start: match.index,
      end: match.index + match[0].length,
      confidence: 'high',
      checksumOk: true,
    });
  }
  for (const match of collect(GPS, text)) {
    pushUnique(out, {
      kind: 'gps',
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
      confidence: 'medium',
    });
  }
  for (const match of collect(DATE, text)) {
    const window = text.slice(
      Math.max(0, match.index - 40),
      match.index + match[0].length + 40
    );
    if (!DOB_CONTEXT.test(window)) continue;
    pushUnique(out, {
      kind: 'dob',
      value: match[0],
      start: match.index,
      end: match.index + match[0].length,
      confidence: 'medium',
    });
  }
  for (const term of customTerms) {
    const needle = term.trim();
    if (needle.length < 2) continue;
    const lower = text.toLowerCase();
    const target = needle.toLowerCase();
    let from = 0;
    while (from < lower.length) {
      const at = lower.indexOf(target, from);
      if (at < 0) break;
      pushUnique(out, {
        kind: 'custom',
        value: text.slice(at, at + needle.length),
        start: at,
        end: at + needle.length,
        confidence: 'high',
      });
      from = at + needle.length;
    }
  }
  for (const source of customRegexes) {
    const validated = validateCustomRegex(source);
    if (!validated.ok) continue;
    for (const hit of matchCustomRegex(text, source, signal)) {
      pushUnique(out, {
        kind: 'custom',
        value: hit.value,
        start: hit.start,
        end: hit.end,
        confidence: 'medium',
      });
    }
  }
  return out.sort((a, b) => a.start - b.start || a.kind.localeCompare(b.kind));
}
