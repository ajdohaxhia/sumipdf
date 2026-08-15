import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { WORKFLOW_RECIPES } from '@/js/workflow/recipes';
import { nodeRegistry } from '@/js/workflow/nodes/registry';

describe('workflow recipes', () => {
  it('uses registered node types and never embeds document bytes', () => {
    expect(WORKFLOW_RECIPES.length).toBeGreaterThanOrEqual(6);
    for (const recipe of WORKFLOW_RECIPES) {
      expect(recipe.workflow.version).toBeTypeOf('number');
      const json = JSON.stringify(recipe.workflow);
      expect(json.includes('%PDF')).toBe(false);
      for (const node of recipe.workflow.nodes) {
        expect(nodeRegistry[node.type], node.type).toBeTruthy();
      }
    }
  });
});

describe('cover-vs-redaction', () => {
  it('drawing a black rectangle leaves extractable text', async () => {
    const marker = 'SUMIREDACTMARKER9182';
    const doc = await PDFDocument.create();
    const page = doc.addPage([200, 200]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText(marker, { x: 20, y: 100, size: 12, font, color: rgb(0, 0, 0) });
    page.drawRectangle({
      x: 15,
      y: 90,
      width: 160,
      height: 24,
      color: rgb(0, 0, 0),
    });
    const bytes = await doc.save();
    const text = new TextDecoder('latin1').decode(bytes);
    expect(text).toContain(marker);
  });
});
