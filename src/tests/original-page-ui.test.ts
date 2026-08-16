import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountOriginalTool } from '@/js/sumi/ui/original-page';

afterEach(() => {
  document.body.replaceChildren();
  sessionStorage.clear();
});

function setFiles(input: HTMLInputElement, files: File[]): void {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: files,
  });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

describe('Original tool input policies', () => {
  it('requires the template and data file before Batch Form Studio can run', async () => {
    const root = document.createElement('main');
    document.body.append(root);
    await mountOriginalTool(root, 'batch-forms');
    const input = root.querySelector<HTMLInputElement>('#original-file');
    const run = root.querySelector<HTMLButtonElement>(
      '.sumi-original__controls button'
    );
    expect(input?.multiple).toBe(true);
    expect(input?.accept).toContain('.csv');
    expect(run?.disabled).toBe(true);

    setFiles(input!, [
      new File(['pdf'], 'template.pdf', { type: 'application/pdf' }),
      new File(['name\nAda'], 'rows.csv', { type: 'text/csv' }),
    ]);
    expect(root.querySelectorAll('.sumi-file-queue__item')).toHaveLength(2);
    expect(run?.disabled).toBe(false);
    expect(root.textContent).toContain('Nothing has run yet');
  });

  it('requires all three Proof Verifier inputs and caps accidental extras', async () => {
    const root = document.createElement('main');
    document.body.append(root);
    await mountOriginalTool(root, 'proof-verifier');
    const input = root.querySelector<HTMLInputElement>('#original-file')!;
    const run = root.querySelector<HTMLButtonElement>(
      '.sumi-original__controls button'
    )!;
    setFiles(input, [
      new File(['a'], 'original.pdf', { type: 'application/pdf' }),
      new File(['b'], 'output.pdf', { type: 'application/pdf' }),
      new File(['{}'], 'proof.json', { type: 'application/json' }),
      new File(['x'], 'extra.pdf', { type: 'application/pdf' }),
    ]);
    expect(root.querySelectorAll('.sumi-file-queue__item')).toHaveLength(3);
    expect(run.disabled).toBe(false);
  });

  it('presents Folder Import as manual refresh with no fake uploader', async () => {
    const root = document.createElement('main');
    document.body.append(root);
    await mountOriginalTool(root, 'watch-folder');
    const drop = root.querySelector<HTMLElement>('.sumi-drop');
    expect(drop?.hidden).toBe(true);
    await vi.waitFor(() => expect(root.textContent).toContain('Choose folder'));
    expect(root.textContent).toContain('Refresh folder');
    expect(root.textContent).not.toContain('automatically runs');
  });
});
