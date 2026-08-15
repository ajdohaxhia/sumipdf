import { showAlert, hideAlert } from '../ui-core.js';
import { redactTextFromPdf } from '../utils/redact-real.js';
import { addWorkspaceFile } from '../workspace/session.js';

const input = document.getElementById('file-input') as HTMLInputElement | null;
const label = document.getElementById('file-label');
const button = document.getElementById('redact-btn');
const textInput = document.getElementById('redact-text') as HTMLInputElement | null;
const report = document.getElementById('redact-report');
const alertOk = document.getElementById('alert-ok');

let file: File | null = null;

alertOk?.addEventListener('click', hideAlert);

input?.addEventListener('change', () => {
  file = input.files?.[0] ?? null;
  if (label) label.textContent = file ? `${file.name} (${file.size} bytes)` : '';
});

button?.addEventListener('click', async () => {
  if (!file) {
    showAlert('Choose a file', 'Select a PDF first. Nothing is uploaded.');
    return;
  }
  const needle = textInput?.value ?? '';
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await redactTextFromPdf(bytes, needle);
    const outName = file.name.replace(/\.pdf$/i, '-redacted.pdf');
    const blob = new Blob([new Uint8Array(result.bytes)], {
      type: 'application/pdf',
    });
    addWorkspaceFile(blob, { name: outName, sourceToolId: 'redact-pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = outName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (report) {
      report.textContent = [
        `Engine: ${result.engine}`,
        `Matches redacted: ${result.matchCount}`,
        result.matchCount === 0
          ? 'No matches. The search is literal and case-sensitive to the engine.'
          : 'Re-extract text from the download to confirm the marker is gone.',
        ...result.limitations,
      ].join('\n');
    }
  } catch (error) {
    showAlert(
      'Redaction could not finish',
      error instanceof Error ? error.message : String(error)
    );
  }
});
