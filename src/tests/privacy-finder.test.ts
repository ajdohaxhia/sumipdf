import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import {
  codiceFiscaleOk,
  findPatterns,
  ibanOk,
  italianVatOk,
  luhnOk,
  scanPrivacy,
  applyPrivacyRedaction,
} from '@/js/sumi/privacy-finder';
import { markerExtractable } from '@/js/proof/metrics';

function validCf(): string {
  const body = 'RSSMRA85T06F205';
  for (const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ') {
    const candidate = body + letter;
    if (codiceFiscaleOk(candidate)) return candidate;
  }
  throw new Error('could not mint CF');
}

function validVat(): string {
  for (let i = 0; i < 10; i++) {
    const body = `1234567890${i}`;
    if (italianVatOk(body)) return `IT${body}`;
  }
  throw new Error('could not mint VAT');
}

describe('Privacy Finder patterns', () => {
  it('checksums IBAN, Luhn, Codice Fiscale, and Italian VAT', () => {
    expect(ibanOk('GB82WEST12345698765432')).toBe(true);
    expect(ibanOk('GB82WEST12345698765433')).toBe(false);
    expect(luhnOk('4111111111111111')).toBe(true);
    expect(luhnOk('4111111111111112')).toBe(false);
    const cf = validCf();
    expect(codiceFiscaleOk(cf)).toBe(true);
    expect(italianVatOk(validVat().replace(/^IT/, ''))).toBe(true);
  });

  it('finds grouped pattern types including DOB-with-context and GPS', () => {
    const text = [
      'Email ada@example.com and https://example.com/x',
      'Phone +39061234567 IPv4 172.16.0.4',
      'IBAN GB82WEST12345698765432 card 4111111111111111',
      `CF ${validCf()} P.IVA ${validVat()}`,
      'Date of birth 12/03/1985 GPS 41.9028, 12.4964',
      'custom-secret-term',
    ].join(' ');
    const hits = findPatterns(text, ['custom-secret-term']);
    const kinds = new Set(hits.map((h) => h.kind));
    expect(kinds.has('email')).toBe(true);
    expect(kinds.has('url')).toBe(true);
    expect(kinds.has('phone')).toBe(true);
    expect(kinds.has('ipv4')).toBe(true);
    expect(kinds.has('iban')).toBe(true);
    expect(kinds.has('card')).toBe(true);
    expect(kinds.has('codice-fiscale')).toBe(true);
    expect(kinds.has('italian-vat')).toBe(true);
    expect(kinds.has('dob')).toBe(true);
    expect(kinds.has('gps')).toBe(true);
    expect(kinds.has('custom')).toBe(true);
    expect(hits.find((h) => h.kind === 'iban')?.checksumOk).toBe(true);
  });

  it('accepts bounded custom regex and rejects catastrophic patterns', async () => {
    const { validateCustomRegex, findPatterns, matchCustomRegex } =
      await import('@/js/sumi/privacy-finder');
    expect(validateCustomRegex('(a+)+$').ok).toBe(false);
    expect(validateCustomRegex('SECRET-[0-9]{2,4}').ok).toBe(true);
    const direct = matchCustomRegex('code SECRET-42 here', 'SECRET-[0-9]{2,4}');
    expect(direct.map((h) => h.value)).toEqual(['SECRET-42']);
    const hits = findPatterns('code SECRET-42 here', [], ['SECRET-[0-9]{2,4}']);
    expect(hits.map((h) => `${h.kind}:${h.value}`)).toContain(
      'custom:SECRET-42'
    );
  });
});

describe('Privacy Finder redaction', () => {
  it('never auto-redacts, covers remain extractable, true redaction removes the marker', async () => {
    const marker = 'SECRETMAIL_ada@example.com';
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 500]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText(marker, { x: 40, y: 300, size: 12, font });
    const bytes = await doc.save();
    const scan = await scanPrivacy(bytes);
    expect(scan.hits.some((h) => h.kind === 'email')).toBe(true);
    await expect(
      applyPrivacyRedaction(bytes, { hits: [], mode: 'true' })
    ).rejects.toThrow(/never auto-redacts/i);

    const cover = await applyPrivacyRedaction(bytes, {
      hits: scan.hits,
      mode: 'cover',
    });
    expect(cover.mode).toBe('cover');
    expect(cover.stillExtractable.length).toBeGreaterThan(0);
    expect(await markerExtractable(cover.bytes, 'ada@example.com')).toBe(true);

    const real = await applyPrivacyRedaction(bytes, {
      hits: scan.hits.filter((h) => h.kind === 'email'),
      mode: 'true',
    });
    expect(
      real.stillExtractable.some((v) => v.includes('ada@example.com'))
    ).toBe(false);
    expect(await markerExtractable(real.bytes, 'ada@example.com')).toBe(false);
  });
});
