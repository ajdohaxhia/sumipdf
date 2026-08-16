import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { FlowStack } from '@/js/flow/stack';
import { validateFlow } from '@/js/flow/validation';
import { executeFlow } from '@/js/flow/executor';
import { SUMI_RECIPES, recipeToFlow } from '@/js/flow/recipes';
import {
  assertRecipePrivacy,
  serializeRecipe,
  stripSecretsFromParams,
} from '@/js/flow/privacy';

async function twoPagePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const label of ['One', 'Two']) {
    const page = doc.addPage([300, 400]);
    page.drawText(label, { x: 40, y: 200, size: 18, font });
  }
  doc.setAuthor('Secret Author');
  return doc.save();
}

describe('Sumi Flow stack', () => {
  it('supports add, reorder, duplicate, disable, undo and redo', () => {
    const stack = new FlowStack();
    stack.addStep('sanitize');
    stack.addStep('flatten');
    stack.addStep('compress', { level: 'light' });
    expect(stack.steps.map((s) => s.op)).toEqual([
      'sanitize',
      'flatten',
      'compress',
    ]);
    stack.move(2, 0);
    expect(stack.steps.map((s) => s.op)).toEqual([
      'compress',
      'sanitize',
      'flatten',
    ]);
    stack.duplicateStep(stack.steps[0].id);
    expect(stack.steps.filter((s) => s.op === 'compress')).toHaveLength(2);
    stack.setEnabled(stack.steps[0].id, false);
    expect(stack.steps[0].enabled).toBe(false);
    stack.undo();
    stack.undo();
    expect(stack.canRedo()).toBe(true);
    stack.redo();
    expect(stack.steps.length).toBeGreaterThan(2);
  });

  it('rejects encrypt followed by compress', () => {
    const stack = new FlowStack();
    stack.addStep('encrypt');
    stack.addStep('compress');
    const errors = validateFlow(stack.document).filter(
      (i) => i.level === 'error'
    );
    expect(errors.some((e) => /after Encrypt/i.test(e.message))).toBe(true);
  });

  it('warns that visual cover is not redaction', () => {
    const stack = new FlowStack();
    stack.addStep('cover');
    const warnings = validateFlow(stack.document);
    expect(warnings.some((i) => /not redaction/i.test(i.message))).toBe(true);
  });
});

describe('Sumi Flow execution', () => {
  it('keeps the original bytes when a later step fails', async () => {
    const bytes = await twoPagePdf();
    const stack = new FlowStack();
    stack.addStep('reverse');
    stack.addStep('pdfa');
    const result = await executeFlow(stack.document, {
      bytes,
      fileName: 'keep.pdf',
    });
    expect(result.originalBytes.byteLength).toBe(bytes.byteLength);
    expect(result.failedStepId).toBeTruthy();
    expect(result.steps[0].ok).toBe(true);
    expect(result.steps[1].ok).toBe(false);
    expect(result.outputBytes.byteLength).toBeGreaterThan(0);
  });

  it('reverses pages in memory', async () => {
    const bytes = await twoPagePdf();
    const stack = new FlowStack();
    stack.addStep('reverse');
    const result = await executeFlow(stack.document, {
      bytes,
      fileName: 'rev.pdf',
    });
    expect(result.failedStepId).toBeNull();
    const after = await PDFDocument.load(result.outputBytes);
    expect(after.getPageCount()).toBe(2);
  });
});

describe('recipe privacy', () => {
  it('never embeds files, passwords, redaction text, or personal metadata', () => {
    for (const recipe of SUMI_RECIPES) {
      const json = serializeRecipe(recipe);
      expect(json.includes('%PDF')).toBe(false);
      expect(assertRecipePrivacy(json)).toEqual([]);
      expect(json.toLowerCase()).not.toContain('password');
      expect(json.toLowerCase()).not.toContain('searchtext');
      expect(json).not.toContain('Secret Author');
      const flow = recipeToFlow(recipe);
      expect(flow.steps.length).toBeGreaterThan(0);
    }
  });

  it('strips secret and personal keys from params', () => {
    const cleaned = stripSecretsFromParams({
      level: 'balanced',
      password: 'hunter2',
      searchText: 'SSN-00',
      author: 'Ada',
      title: 'Personal',
    });
    expect(cleaned).toEqual({ level: 'balanced' });
  });
});
