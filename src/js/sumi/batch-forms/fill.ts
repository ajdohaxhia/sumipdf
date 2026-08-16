import {
  PDFCheckBox,
  PDFDropdown,
  PDFDocument,
  PDFRadioGroup,
  PDFSignature,
  PDFTextField,
} from 'pdf-lib';
import { loadPdf } from '../shared/pdf';
import { applyNameTemplate, uniqueName } from '../shared/filenames';
import { zipPdfs } from '../shared/zip';
import type {
  BatchOptions,
  BatchResult,
  BatchRowIssue,
  FieldMap,
  FormFieldInfo,
} from './types';

export function parseTabular(
  input: string,
  kind: 'csv' | 'json'
): Record<string, string>[] {
  if (kind === 'json') {
    const data = JSON.parse(input);
    const rows = Array.isArray(data) ? data : data.rows || data.records || [];
    return rows.map((row: Record<string, unknown>) => {
      const out: Record<string, string> = {};
      for (const [key, value] of Object.entries(row || {})) {
        out[key] = value == null ? '' : String(value);
      }
      return out;
    });
  }
  const lines = input
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim());
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cells[i] ?? '';
    });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

export function applyTransform(
  value: string,
  transform: FieldMap['transform']
): string {
  const v = value ?? '';
  switch (transform) {
    case 'trim':
      return v.trim();
    case 'upper':
      return v.trim().toUpperCase();
    case 'lower':
      return v.trim().toLowerCase();
    case 'title':
      return v
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
    case 'date-iso':
    case 'date-it':
    case 'date-us': {
      const parsed = parseLooseDate(v);
      if (!parsed) return v.trim();
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const d = String(parsed.getDate()).padStart(2, '0');
      if (transform === 'date-iso') return `${y}-${m}-${d}`;
      if (transform === 'date-it') return `${d}/${m}/${y}`;
      return `${m}/${d}/${y}`;
    }
    default:
      return v;
  }
}

function parseLooseDate(value: string): Date | null {
  const v = value.trim();
  const iso = v.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const eu = v.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (eu) {
    const year = Number(eu[3]) < 100 ? 2000 + Number(eu[3]) : Number(eu[3]);
    return new Date(year, Number(eu[2]) - 1, Number(eu[1]));
  }
  const dt = new Date(v);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export async function listFormFields(
  bytes: Uint8Array
): Promise<FormFieldInfo[]> {
  const doc = await loadPdf(bytes);
  try {
    return doc
      .getForm()
      .getFields()
      .map((field) => {
        const name = field.getName();
        if (field instanceof PDFTextField) {
          return { name, type: 'text' as const, isCryptoSignature: false };
        }
        if (field instanceof PDFCheckBox) {
          return { name, type: 'checkbox' as const, isCryptoSignature: false };
        }
        if (field instanceof PDFDropdown) {
          return {
            name,
            type: 'dropdown' as const,
            options: field.getOptions(),
            isCryptoSignature: false,
          };
        }
        if (field instanceof PDFRadioGroup) {
          return {
            name,
            type: 'option' as const,
            options: field.getOptions(),
            isCryptoSignature: false,
          };
        }
        if (field instanceof PDFSignature) {
          return {
            name,
            type: 'signature' as const,
            isCryptoSignature: false,
          };
        }
        return { name, type: 'unknown' as const, isCryptoSignature: false };
      });
  } catch {
    return [];
  }
}

function asBool(value: string): boolean {
  return /^(1|true|yes|y|on|x|si|sì)$/i.test(value.trim());
}

export async function fillBatch(
  templateBytes: Uint8Array,
  rows: Record<string, string>[],
  options: BatchOptions
): Promise<BatchResult> {
  const fields = await listFormFields(templateBytes);
  const fieldNames = new Set(fields.map((f) => f.name));
  const issues: BatchRowIssue[] = [];
  const files: BatchResult['files'] = [];
  const skipped: BatchResult['skipped'] = [];
  const used = new Map<string, number>();
  const notes = [
    'No spreadsheet formulas are evaluated as JavaScript.',
    'Signature fields in the template are visual appearance fields, not cryptographic signatures.',
  ];
  if (fields.some((f) => f.type === 'signature')) {
    notes.push(
      'This form has a signature widget. Filling it does not create a digital certificate.'
    );
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowIssues: BatchRowIssue[] = [];
    const values: Record<string, string> = {};
    for (const map of options.mapping) {
      if (!fieldNames.has(map.field)) {
        rowIssues.push({
          row: i + 1,
          field: map.field,
          message: 'Template has no field with this name.',
        });
        continue;
      }
      const raw = row[map.column] ?? '';
      const next = applyTransform(raw, map.transform);
      if (!next && map.transform !== 'none') {
        rowIssues.push({
          row: i + 1,
          field: map.field,
          message: 'Empty after transform.',
          repair: raw,
        });
      }
      values[map.field] = next;
    }
    issues.push(...rowIssues);
    if (rowIssues.length && options.skipInvalid) {
      skipped.push({
        row: i + 1,
        reason: rowIssues.map((r) => r.message).join('; '),
      });
      continue;
    }

    const doc = await PDFDocument.load(templateBytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    try {
      const form = doc.getForm();
      for (const map of options.mapping) {
        if (!(map.field in values)) continue;
        const value = values[map.field];
        try {
          const field = form.getField(map.field);
          if (field instanceof PDFTextField) field.setText(value);
          else if (field instanceof PDFCheckBox) {
            if (asBool(value)) field.check();
            else field.uncheck();
          } else if (field instanceof PDFDropdown) {
            if (value) field.select(value);
          } else if (field instanceof PDFRadioGroup) {
            if (value) field.select(value);
          }
        } catch (error) {
          issues.push({
            row: i + 1,
            field: map.field,
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
      if (options.flatten) {
        try {
          form.flatten();
        } catch {
          /* some widgets cannot flatten */
        }
      }
    } catch (error) {
      skipped.push({
        row: i + 1,
        reason: error instanceof Error ? error.message : String(error),
      });
      continue;
    }
    const bytes = new Uint8Array(await doc.save());
    const name = uniqueName(
      applyNameTemplate(
        options.filenameTemplate || '{original}-{counter}.pdf',
        {
          counter: i + 1,
          original: 'form',
          match: row,
        }
      ),
      used
    );
    files.push({ name, bytes, row: i + 1 });
  }

  return { files, skipped, issues, notes };
}

export async function zipBatch(result: BatchResult): Promise<Uint8Array> {
  return zipPdfs(result.files.map((f) => ({ name: f.name, bytes: f.bytes })));
}

export async function parseSpreadsheet(
  bytes: Uint8Array,
  filename: string
): Promise<Record<string, string>[]> {
  const name = filename.toLowerCase();
  if (name.endsWith('.json')) {
    return parseTabular(new TextDecoder().decode(bytes), 'json');
  }
  if (name.endsWith('.csv') || name.endsWith('.txt')) {
    return parseTabular(new TextDecoder().decode(bytes), 'csv');
  }
  const XLSX = await import('xlsx');
  const wb = XLSX.read(bytes, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: '',
  });
  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(row))
      out[key] = String(value ?? '');
    return out;
  });
}
