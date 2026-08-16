import { parseRangeGroups, nTimesGroups } from '../../utils/split-pdf-helpers';
import { applyNameTemplate, uniqueName } from '../shared/filenames';
import type {
  PageSignal,
  SplitGroup,
  SplitOptions,
  SplitPlan,
  SplitRule,
} from './types';

function rangeLabel(pages: number[]): string {
  if (!pages.length) return '';
  const sorted = [...pages].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === prev + 1) {
      prev = sorted[i];
      continue;
    }
    parts.push(start === prev ? String(start) : `${start}-${prev}`);
    start = sorted[i];
    prev = sorted[i];
  }
  parts.push(start === prev ? String(start) : `${start}-${prev}`);
  return parts.join(',');
}

function groupsFromStarts(
  starts: number[],
  total: number,
  rule: SplitRule
): Array<{ pages: number[]; meta: Partial<SplitGroup> }> {
  const unique = [...new Set(starts.filter((p) => p >= 1 && p <= total))].sort(
    (a, b) => a - b
  );
  if (!unique.length) {
    return [
      { pages: Array.from({ length: total }, (_, i) => i + 1), meta: { rule } },
    ];
  }
  if (unique[0] !== 1) unique.unshift(1);
  const out: Array<{ pages: number[]; meta: Partial<SplitGroup> }> = [];
  for (let i = 0; i < unique.length; i++) {
    const from = unique[i];
    const to = i + 1 < unique.length ? unique[i + 1] - 1 : total;
    out.push({
      pages: Array.from({ length: to - from + 1 }, (_, k) => from + k),
      meta: { rule },
    });
  }
  return out;
}

function splitByChange(
  signals: PageSignal[],
  key: (s: PageSignal) => string
): Array<{ pages: number[]; meta: Partial<SplitGroup> }> {
  const groups: Array<{ pages: number[]; meta: Partial<SplitGroup> }> = [];
  let current: number[] = [];
  let last = '';
  for (const signal of signals) {
    const value = key(signal) || '';
    if (!current.length) {
      current = [signal.page];
      last = value;
      continue;
    }
    if (value && value !== last) {
      groups.push({ pages: current, meta: {} });
      current = [signal.page];
      last = value;
    } else {
      current.push(signal.page);
    }
  }
  if (current.length) groups.push({ pages: current, meta: {} });
  return groups;
}

export function planSplit(
  signals: PageSignal[],
  options: SplitOptions
): SplitPlan {
  const total = signals.length;
  const rule = options.rule;
  let raw: Array<{ pages: number[]; meta: Partial<SplitGroup> }>;

  switch (rule) {
    case 'page-count': {
      const n = Math.max(1, options.pageCount || 1);
      raw = nTimesGroups(n, total).map((group) => ({
        pages: group.map((i) => i + 1),
        meta: {},
      }));
      break;
    }
    case 'ranges': {
      const parsed = parseRangeGroups(options.ranges || '', total);
      raw = parsed.groups.map((group) => ({
        pages: group.map((i) => i + 1),
        meta: {},
      }));
      break;
    }
    case 'bookmarks':
      raw = groupsFromStarts(
        signals.filter((s) => s.bookmark).map((s) => s.page),
        total,
        rule
      );
      break;
    case 'headings':
      raw = groupsFromStarts(
        signals.filter((s) => s.heading).map((s) => s.page),
        total,
        rule
      );
      break;
    case 'blank':
      raw = splitByChange(signals, (s) =>
        s.probableBlank ? `__blank_${s.page}` : 'content'
      );
      raw = raw.filter((g) =>
        g.pages.some((p) => !signals[p - 1]?.probableBlank)
      );
      break;
    case 'page-size':
      raw = splitByChange(
        signals,
        (s) => `${Math.round(s.width)}x${Math.round(s.height)}`
      );
      break;
    case 'orientation':
      raw = splitByChange(signals, (s) => s.orientation);
      break;
    case 'text': {
      const needle = (options.text || '').toLowerCase();
      raw = groupsFromStarts(
        signals
          .filter((s) => needle && s.text.toLowerCase().includes(needle))
          .map((s) => s.page),
        total,
        rule
      );
      break;
    }
    case 'regex':
    case 'captured-value': {
      try {
        const re = new RegExp(
          options.regex || '',
          options.rule === 'regex' ? '' : ''
        );
        if (rule === 'captured-value') {
          raw = splitByChange(signals, (s) => {
            const match = s.text.match(re);
            return match?.[1] || match?.[0] || s.captured || '';
          });
        } else {
          raw = groupsFromStarts(
            signals
              .filter((s) => re.source && re.test(s.text))
              .map((s) => s.page),
            total,
            rule
          );
        }
      } catch {
        raw = [{ pages: signals.map((s) => s.page), meta: {} }];
      }
      break;
    }
    case 'qr':
    case 'barcode':
      raw = splitByChange(signals, (s) => s.barcode || '');
      break;
    default:
      raw = [{ pages: signals.map((s) => s.page), meta: {} }];
  }

  const template = options.template || '{original}-{counter}-{pages}.pdf';
  const used = new Map<string, number>();
  const original = (options.originalName || 'document').replace(/\.pdf$/i, '');
  const groups: SplitGroup[] = raw
    .filter((g) => g.pages.length)
    .map((g, index) => {
      const first = signals[g.pages[0] - 1];
      const match: Record<string, string> = {};
      if (options.regex && options.captureName) {
        const found = first?.text.match(new RegExp(options.regex));
        if (found?.[1]) match[options.captureName] = found[1];
      }
      const filename = uniqueName(
        applyNameTemplate(template, {
          counter: index + 1,
          bookmark: first?.bookmark,
          heading: first?.heading,
          barcode: first?.barcode,
          match,
          original,
          pages: rangeLabel(g.pages),
        }),
        used
      );
      return {
        id: `g${index + 1}`,
        pages: g.pages,
        rangeLabel: rangeLabel(g.pages),
        rule,
        filename,
        collision:
          /-\d+\.pdf$/i.test(filename) &&
          used.get(filename.toLowerCase()) !== 1,
        bookmark: first?.bookmark,
        heading: first?.heading,
        barcode: first?.barcode,
        match,
      };
    });

  const covered = new Set(groups.flatMap((g) => g.pages));
  const unusedPages = signals.map((s) => s.page).filter((p) => !covered.has(p));
  return { groups, rule, template, unusedPages };
}
