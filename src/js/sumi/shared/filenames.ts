const UNSAFE = /[<>:"/\\|?*\u0000-\u001f]/g;
const RESERVED = new Set(['con', 'prn', 'aux', 'nul', 'com1', 'lpt1']);

export function sanitizeFilename(name: string, fallback = 'split'): string {
  let next = name
    .replace(UNSAFE, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 180);
  if (!next) next = fallback;
  const stem = next.replace(/\.pdf$/i, '');
  if (RESERVED.has(stem.toLowerCase())) next = `${fallback}-${stem}`;
  if (!/\.pdf$/i.test(next)) next = `${next}.pdf`;
  return next;
}

export function uniqueName(name: string, used: Map<string, number>): string {
  const sanitized = sanitizeFilename(name);
  const seen = used.get(sanitized.toLowerCase());
  if (seen === undefined) {
    used.set(sanitized.toLowerCase(), 1);
    return sanitized;
  }
  used.set(sanitized.toLowerCase(), seen + 1);
  return sanitizeFilename(sanitized.replace(/\.pdf$/i, `-${seen + 1}.pdf`));
}

export interface NameContext {
  counter: number;
  bookmark?: string;
  heading?: string;
  barcode?: string;
  match?: Record<string, string>;
  date?: string;
  original?: string;
  pages?: string;
}

export function applyNameTemplate(template: string, ctx: NameContext): string {
  const date = ctx.date || new Date().toISOString().slice(0, 10);
  let out = template
    .replaceAll('{counter}', String(ctx.counter).padStart(2, '0'))
    .replaceAll('{bookmark}', ctx.bookmark || 'section')
    .replaceAll('{heading}', ctx.heading || 'heading')
    .replaceAll('{barcode}', ctx.barcode || 'code')
    .replaceAll('{date}', date)
    .replaceAll('{original}', ctx.original || 'document')
    .replaceAll('{pages}', ctx.pages || String(ctx.counter));
  out = out.replace(/\{match:([^}]+)\}/g, (_, key: string) => {
    return ctx.match?.[key] || key;
  });
  return sanitizeFilename(out);
}
