import { formatBytes } from '../utils/format';
import {
  workspaceController,
  paneFromLocation,
  type WorkspacePane,
} from '../workspace/controller';
import { listWorkspaceItems } from '../workspace/session';
import { FLOW_OPS, flowOpName } from '../flow/catalog';
import { validateFlow } from '../flow/validation';
import { SUMI_RECIPES } from '../flow/recipes';
import { runBatchQueue } from '../workspace/batch-queue';
import type { InspectFinding } from '../inspect/types';
import type { FlowStep } from '../flow/types';

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

async function fileBytes(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

async function renderPdfPage(
  bytes: Uint8Array,
  pageNumber: number,
  canvas: HTMLCanvasElement
): Promise<void> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
  const task = pdfjs.getDocument({ data: bytes.slice() });
  const doc = await task.promise;
  try {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.15 });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  } finally {
    await doc.destroy();
  }
}

async function ensureInspect(): Promise<void> {
  const ctl = workspaceController;
  const item = ctl.active();
  if (!item) return;
  if (ctl.inspectStatus === 'running') return;
  if (ctl.inspectMap && ctl.inspectStatus === 'done') return;
  ctl.cancelInspect();
  ctl.inspectAbort = new AbortController();
  ctl.inspectStatus = 'running';
  ctl.inspectMessage = 'Inspecting on this device…';
  ctl.emit();
  const { runInspect, isAbortError } = await import('../inspect/run.js');
  try {
    const bytes = await fileBytes(item.blob);
    const map = await runInspect(bytes, {
      fileName: item.name,
      signal: ctl.inspectAbort.signal,
      onProgress: (progress) => {
        ctl.inspectMessage = progress.message;
        ctl.emit();
      },
    });
    ctl.inspectMap = map;
    ctl.inspectStatus = 'done';
    ctl.inspectMessage = map.cancelled
      ? 'Cancelled'
      : 'Inspect complete. Nothing was modified.';
  } catch (error) {
    if (isAbortError(error)) {
      ctl.inspectStatus = 'cancelled';
      ctl.inspectMessage = 'Inspect cancelled. Nothing was modified.';
    } else {
      ctl.inspectStatus = 'error';
      ctl.inspectMessage =
        error instanceof Error ? error.message : String(error);
    }
  } finally {
    ctl.inspectAbort = null;
    ctl.emit();
  }
}

function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = el('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function mountDrop(zone: HTMLElement, onFiles: (files: File[]) => void): void {
  const input = zone.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement | null;
  zone.addEventListener('dragover', (event) => {
    event.preventDefault();
    zone.classList.add('is-dragover');
  });
  zone.addEventListener('dragleave', () =>
    zone.classList.remove('is-dragover')
  );
  zone.addEventListener('drop', (event) => {
    event.preventDefault();
    zone.classList.remove('is-dragover');
    if (event.dataTransfer?.files) onFiles([...event.dataTransfer.files]);
  });
  input?.addEventListener('change', () => {
    if (input.files) onFiles([...input.files]);
  });
}

function renderFindings(host: HTMLElement): void {
  host.textContent = '';
  const ctl = workspaceController;
  const map = ctl.inspectMap;
  if (ctl.inspectStatus === 'running') {
    host.append(el('p', 'sumi-ws__status', ctl.inspectMessage));
    const cancel = el('button', 'sumi-btn sumi-btn--ghost', 'Cancel inspect');
    cancel.type = 'button';
    cancel.addEventListener('click', () => ctl.cancelInspect());
    host.append(cancel);
    return;
  }
  if (!map) {
    host.append(
      el(
        'p',
        'sumi-ws__status',
        'Choose a PDF to inspect. Nothing is sent anywhere.'
      )
    );
    return;
  }
  const facts = el('dl', 'sumi-facts');
  const rows: Array<[string, string]> = [
    ['File', map.facts.fileName],
    ['Size', formatBytes(map.facts.byteLength)],
    ['Pages', String(map.facts.pageCount)],
    ['Encrypted', map.facts.encrypted ? 'markers present' : 'not detected'],
    ['Author', map.facts.metadata.author || '—'],
    ['Title', map.facts.metadata.title || '—'],
    [
      'Dates',
      [map.facts.metadata.creationDate, map.facts.metadata.modificationDate]
        .filter(Boolean)
        .join(' · ') || '—',
    ],
  ];
  for (const [dt, dd] of rows) {
    facts.append(el('dt', undefined, dt), el('dd', 'tabular-nums', dd));
  }
  host.append(facts);
  host.append(el('p', 'sumi-ws__hedge', map.limitations[0] || ''));

  const list = el('ul', 'sumi-findings');
  list.setAttribute('data-testid', 'inspect-findings');
  for (const finding of map.findings) {
    const item = el('li', 'sumi-finding');
    item.dataset.severity = finding.severity;
    item.tabIndex = 0;
    item.setAttribute('data-testid', 'inspect-finding');
    item.append(el('strong', undefined, finding.title));
    item.append(el('p', undefined, finding.summary));
    item.append(el('p', 'sumi-ws__hedge', finding.hedge));
    if (finding.pages.length) {
      item.append(el('p', 'tabular-nums', `Pages ${finding.pages.join(', ')}`));
    }
    item.addEventListener('click', () => ctl.highlightPages(finding.pages));
    if (finding.recommendedOp) {
      const add = el(
        'button',
        'sumi-btn sumi-btn--small',
        `Add “${flowOpName(finding.recommendedOp)}” to Flow`
      );
      add.type = 'button';
      add.setAttribute('data-testid', 'accept-recommendation');
      add.addEventListener('click', (event) => {
        event.stopPropagation();
        ctl.acceptFinding(finding as InspectFinding);
      });
      item.append(add);
    }
    list.append(item);
  }
  host.append(list);
}

function renderPageMap(host: HTMLElement): void {
  host.textContent = '';
  const map = workspaceController.inspectMap;
  if (!map?.pages.length) return;
  const heading = el('h3', undefined, 'Page map');
  host.append(heading);
  const grid = el('div', 'sumi-pagemap');
  grid.setAttribute('role', 'list');
  for (const page of map.pages) {
    const btn = el('button', 'sumi-pagemap__page', String(page.index + 1));
    btn.type = 'button';
    btn.setAttribute('role', 'listitem');
    btn.setAttribute(
      'aria-label',
      `Page ${page.index + 1}, ${page.widthPt} by ${page.heightPt} points, ${page.kind}`
    );
    if (workspaceController.highlightedPages.includes(page.index + 1)) {
      btn.classList.add('is-highlighted');
    }
    if (workspaceController.selectedPages.includes(page.index + 1)) {
      btn.classList.add('is-selected');
    }
    btn.addEventListener('click', () => {
      workspaceController.toggleSelectedPage(page.index + 1);
      workspaceController.highlightPages([page.index + 1]);
    });
    grid.append(btn);
  }
  host.append(grid);
  const hint = el(
    'p',
    'sumi-ws__hedge',
    'Selecting pages sets the scope for the next Flow step. Inspect never edits the file.'
  );
  host.append(hint);
}

function renderFlow(host: HTMLElement): void {
  host.textContent = '';
  const ctl = workspaceController;
  const toolbar = el('div', 'sumi-flow__toolbar');
  const undo = el('button', 'sumi-btn sumi-btn--ghost', 'Undo');
  undo.type = 'button';
  undo.disabled = !ctl.flow.canUndo();
  undo.addEventListener('click', () => ctl.flow.undo());
  const redo = el('button', 'sumi-btn sumi-btn--ghost', 'Redo');
  redo.type = 'button';
  redo.disabled = !ctl.flow.canRedo();
  redo.addEventListener('click', () => ctl.flow.redo());
  toolbar.append(undo, redo);

  const addWrap = el('div', 'sumi-flow__add');
  const addLabel = el('label', undefined, 'Add operation');
  addLabel.htmlFor = 'sumi-flow-add';
  const select = el('select') as HTMLSelectElement;
  select.id = 'sumi-flow-add';
  select.setAttribute('data-testid', 'flow-add');
  select.append(new Option('Choose an operation', ''));
  for (const op of FLOW_OPS) {
    select.append(new Option(op.name, op.id));
  }
  select.addEventListener('change', () => {
    if (!select.value) return;
    const step = ctl.flow.addStep(select.value);
    if (ctl.selectedPages.length) ctl.flow.setScope(step.id, ctl.selectedPages);
    select.value = '';
  });
  addWrap.append(addLabel, select);
  host.append(toolbar, addWrap);

  const issues = validateFlow(ctl.flow.document);
  if (issues.length) {
    const ul = el('ul', 'sumi-flow__issues');
    for (const issue of issues) {
      const li = el('li', undefined, issue.message);
      li.dataset.level = issue.level;
      ul.append(li);
    }
    host.append(ul);
  }

  const list = el('ol', 'sumi-flow__steps');
  list.setAttribute('aria-label', 'Flow operations');
  ctl.flow.steps.forEach((step, index) => {
    list.append(renderStep(step, index));
  });
  host.append(list);

  const actions = el('div', 'sumi-flow__run');
  const preview = el('button', 'sumi-btn', 'Preview output');
  preview.type = 'button';
  preview.setAttribute('data-testid', 'flow-preview');
  preview.addEventListener('click', () => void runPreview());
  const exec = el('button', 'sumi-btn sumi-btn--signal', 'Execute flow');
  exec.type = 'button';
  exec.setAttribute('data-testid', 'flow-execute');
  exec.addEventListener('click', () => void runExecute());
  const batch = el('button', 'sumi-btn sumi-btn--ghost', 'Run on each file');
  batch.type = 'button';
  batch.addEventListener('click', () => void runBatch());
  actions.append(preview, exec, batch);
  host.append(actions);
  host.append(
    el(
      'p',
      'sumi-ws__hedge',
      'Original stays in the workspace. A failed step keeps earlier output in memory and does not write over the source.'
    )
  );
}

function renderStep(step: FlowStep, index: number): HTMLLIElement {
  const ctl = workspaceController;
  const def = FLOW_OPS.find((op) => op.id === step.op);
  const item = el('li', 'sumi-flow__step') as HTMLLIElement;
  if (!step.enabled) item.classList.add('is-disabled');
  if (ctl.flow.selectedId === step.id) item.classList.add('is-selected');
  const header = el('div', 'sumi-flow__step-h');
  header.append(
    el('strong', undefined, `${index + 1}. ${def?.name || step.op}`)
  );
  const enable = el('input') as HTMLInputElement;
  enable.type = 'checkbox';
  enable.checked = step.enabled;
  enable.setAttribute('aria-label', `Enable ${def?.name || step.op}`);
  enable.addEventListener('change', () =>
    ctl.flow.setEnabled(step.id, enable.checked)
  );
  header.append(enable);
  item.append(header);
  if (def) {
    item.append(el('p', undefined, def.impact));
  }
  if (step.notes) item.append(el('p', 'sumi-ws__hedge', step.notes));
  if (step.scope?.pages?.length) {
    item.append(
      el('p', 'tabular-nums', `Scope: pages ${step.scope.pages.join(', ')}`)
    );
  }
  for (const field of def?.paramSchema || []) {
    if (field.type === 'secret') {
      const label = el('label', undefined, field.label);
      const input = el('input') as HTMLInputElement;
      input.type = 'password';
      input.autocomplete = 'off';
      input.value = ctl.secrets[field.key] || '';
      input.addEventListener('input', () => {
        ctl.secrets[field.key] = input.value;
      });
      item.append(label, input);
      continue;
    }
    const label = el('label', undefined, field.label);
    if (field.type === 'select') {
      const select = el('select') as HTMLSelectElement;
      for (const option of field.options || []) {
        select.append(new Option(option, option));
      }
      select.value = String(step.params[field.key] ?? '');
      select.addEventListener('change', () =>
        ctl.flow.updateParams(step.id, { [field.key]: select.value })
      );
      item.append(label, select);
    } else if (field.type === 'boolean') {
      const box = el('input') as HTMLInputElement;
      box.type = 'checkbox';
      box.checked = Boolean(step.params[field.key]);
      box.addEventListener('change', () =>
        ctl.flow.updateParams(step.id, { [field.key]: box.checked })
      );
      item.append(label, box);
    } else {
      const input = el('input') as HTMLInputElement;
      input.type = field.type === 'number' ? 'number' : 'text';
      input.value = String(step.params[field.key] ?? '');
      input.addEventListener('change', () =>
        ctl.flow.updateParams(step.id, { [field.key]: input.value })
      );
      item.append(label, input);
    }
  }
  const row = el('div', 'sumi-flow__step-actions');
  const up = el('button', 'sumi-btn sumi-btn--ghost', 'Up');
  up.type = 'button';
  up.disabled = index === 0;
  up.addEventListener('click', () => ctl.flow.move(index, index - 1));
  const down = el('button', 'sumi-btn sumi-btn--ghost', 'Down');
  down.type = 'button';
  down.disabled = index === ctl.flow.steps.length - 1;
  down.addEventListener('click', () => ctl.flow.move(index, index + 1));
  const dup = el('button', 'sumi-btn sumi-btn--ghost', 'Duplicate');
  dup.type = 'button';
  dup.addEventListener('click', () => ctl.flow.duplicateStep(step.id));
  const remove = el('button', 'sumi-btn sumi-btn--ghost', 'Remove');
  remove.type = 'button';
  remove.addEventListener('click', () => ctl.flow.removeStep(step.id));
  row.append(up, down, dup, remove);
  item.append(row);
  item.addEventListener('click', () => ctl.flow.select(step.id));
  return item;
}

async function runPreview(): Promise<void> {
  const ctl = workspaceController;
  const item = ctl.active();
  if (!item) return;
  ctl.lastError = null;
  ctl.setPane('preview');
  const { executeFlow } = await import('../flow/executor.js');
  const bytes = await fileBytes(item.blob);
  const extras = listWorkspaceItems()
    .filter((entry) => entry.id !== item.id && entry.mimeType.includes('pdf'))
    .map(async (entry) => new Uint8Array(await entry.blob.arrayBuffer()));
  const extraPdfs = await Promise.all(extras);
  const result = await executeFlow(ctl.flow.document, {
    bytes,
    fileName: item.name,
    extraPdfs,
    secrets: ctl.secrets,
  });
  ctl.previewBytes = result.outputBytes;
  ctl.execution = result;
  ctl.emit();
}

async function runExecute(): Promise<void> {
  const ctl = workspaceController;
  const item = ctl.active();
  if (!item) return;
  await runPreview();
  if (!ctl.execution) return;
  const pdfaAttempted = ctl.flow.steps.some(
    (s) => s.op === 'pdfa' && s.enabled
  );
  const { buildProofReport } = await import('../proof/receipt.js');
  ctl.proof = await buildProofReport({
    execution: ctl.execution,
    pdfaAttempted,
    redactionMarkers: ctl.secrets.searchText ? [ctl.secrets.searchText] : [],
  });
  ctl.setPane('proof');
}

async function runBatch(): Promise<void> {
  const ctl = workspaceController;
  const items = listWorkspaceItems().filter(
    (item) =>
      item.mimeType.includes('pdf') || item.name.toLowerCase().endsWith('.pdf')
  );
  await runBatchQueue(items, {
    concurrency: 1,
    label: (item) => item.name,
    process: async (item) => {
      const { executeFlow } = await import('../flow/executor.js');
      const bytes = await fileBytes(item.blob);
      const execution = await executeFlow(ctl.flow.document, {
        bytes,
        fileName: item.name,
        secrets: ctl.secrets,
      });
      return {
        name: item.name,
        bytes: execution.outputBytes.byteLength,
        ok: !execution.failedStepId,
      };
    },
    onUpdate: () => ctl.emit(),
  });
}

function renderPreview(host: HTMLElement): void {
  host.textContent = '';
  const ctl = workspaceController;
  const item = ctl.active();
  const grid = el('div', 'sumi-compare');
  const left = el('div');
  left.append(el('h3', undefined, 'Original'));
  const canvasA = el('canvas');
  canvasA.setAttribute('data-testid', 'preview-original');
  left.append(canvasA);
  const right = el('div');
  right.append(el('h3', undefined, 'Projected output'));
  const canvasB = el('canvas');
  canvasB.setAttribute('data-testid', 'preview-output');
  right.append(canvasB);
  grid.append(left, right);
  host.append(grid);
  if (!item) return;
  void fileBytes(item.blob).then((bytes) => {
    void renderPdfPage(bytes, 1, canvasA).catch((): undefined => undefined);
  });
  if (ctl.previewBytes) {
    void renderPdfPage(ctl.previewBytes, 1, canvasB).catch(
      (): undefined => undefined
    );
  } else {
    right.append(
      el('p', 'sumi-ws__hedge', 'Run Preview to project the flow in memory.')
    );
  }
}

function renderProof(host: HTMLElement): void {
  host.textContent = '';
  const ctl = workspaceController;
  const proof = ctl.proof;
  host.setAttribute('data-testid', 'proof-panel');
  if (!proof) {
    host.append(
      el(
        'p',
        'sumi-ws__status',
        'Execute a flow to generate a Proof receipt. It is not a legal certificate.'
      )
    );
    return;
  }
  host.append(el('h3', undefined, 'Sumi Proof'));
  host.append(el('p', 'sumi-ws__hedge', proof.disclaimer));
  const metrics = el('dl', 'sumi-facts');
  const pairs: Array<[string, string]> = [
    ['SHA-256 before', proof.before.sha256],
    ['SHA-256 after', proof.after.sha256],
    ['Bytes', `${proof.before.byteLength} → ${proof.after.byteLength}`],
    ['Pages', `${proof.before.pageCount} → ${proof.after.pageCount}`],
  ];
  for (const [dt, dd] of pairs) {
    metrics.append(el('dt', undefined, dt), el('dd', 'tabular-nums', dd));
  }
  host.append(metrics);
  if (proof.changes.length) {
    const ul = el('ul', 'sumi-proof__changes');
    for (const change of proof.changes) {
      ul.append(
        el(
          'li',
          undefined,
          `${change.label}: ${change.before} → ${change.after}`
        )
      );
    }
    host.append(ul);
  }
  host.append(el('p', undefined, proof.redaction.note));
  host.append(el('p', 'sumi-ws__hedge', proof.pdfa.honestLimit));
  if (proof.warnings.length) {
    const warn = el('ul', 'sumi-flow__issues');
    for (const warning of proof.warnings)
      warn.append(el('li', undefined, warning));
    host.append(warn);
  }
  const actions = el('div', 'sumi-flow__run');
  const jsonBtn = el('button', 'sumi-btn', 'Download JSON');
  jsonBtn.type = 'button';
  jsonBtn.setAttribute('data-testid', 'download-receipt');
  jsonBtn.addEventListener('click', () => {
    void import('../proof/receipt.js').then(({ proofReportToJson }) => {
      downloadBlob(
        new Blob([proofReportToJson(proof)], { type: 'application/json' }),
        'sumi-proof.json'
      );
    });
  });
  const textBtn = el('button', 'sumi-btn', 'Download receipt');
  textBtn.type = 'button';
  textBtn.addEventListener('click', () => {
    void import('../proof/receipt.js').then(({ proofReportToText }) => {
      downloadBlob(
        new Blob([proofReportToText(proof)], { type: 'text/plain' }),
        'sumi-proof.txt'
      );
    });
  });
  const pdfBtn = el('button', 'sumi-btn sumi-btn--signal', 'Download output');
  pdfBtn.type = 'button';
  pdfBtn.setAttribute('data-testid', 'download-output');
  pdfBtn.addEventListener('click', () => {
    if (!ctl.execution) return;
    downloadBlob(
      new Blob([new Uint8Array(ctl.execution.outputBytes)], {
        type: 'application/pdf',
      }),
      ctl.execution.outputName
    );
  });
  actions.append(pdfBtn, jsonBtn, textBtn);
  host.append(actions);
}

function renderRecipes(host: HTMLElement): void {
  host.textContent = '';
  host.append(el('h3', undefined, 'Recipes'));
  host.append(
    el(
      'p',
      'sumi-ws__hedge',
      'Steps are visible before they run. Recipes never include your documents.'
    )
  );
  const list = el('div', 'sumi-ws-recipes');
  for (const recipe of SUMI_RECIPES) {
    const card = el('article', 'sumi-recipe');
    card.append(el('strong', undefined, recipe.name));
    card.append(el('p', undefined, recipe.summary));
    card.append(
      el(
        'p',
        'tabular-nums',
        recipe.steps.map((s) => flowOpName(s.op)).join(' → ')
      )
    );
    if (recipe.limitations)
      card.append(el('p', 'sumi-ws__hedge', recipe.limitations));
    const use = el('button', 'sumi-btn sumi-btn--small', 'Load into Flow');
    use.type = 'button';
    use.addEventListener('click', () => {
      workspaceController.loadRecipe(recipe.id);
    });
    card.append(use);
    list.append(card);
  }
  host.append(list);
}

export interface MountWorkspaceOptions {
  root?: HTMLElement | null;
  pane?: WorkspacePane;
}

let unsubscribe: (() => void) | null = null;

export async function mountWorkspaceApp(
  options: MountWorkspaceOptions = {}
): Promise<HTMLElement> {
  const root =
    options.root ||
    document.getElementById('sumi-workspace-root') ||
    document.createElement('div');
  if (!root.id) root.id = 'sumi-workspace-root';
  if (!root.parentElement) {
    const main = document.querySelector('main') || document.body;
    main.appendChild(root);
  }
  root.hidden = false;
  workspaceController.pane = options.pane || paneFromLocation();

  const params = new URLSearchParams(location.search);
  const recipeId = params.get('recipe') || params.get('flow');
  if (recipeId) workspaceController.loadRecipe(recipeId);

  if (unsubscribe) unsubscribe();
  unsubscribe = workspaceController.subscribe(() => paint(root));
  paint(root);
  if (workspaceController.active()) void ensureInspect();
  return root;
}

function paint(root: HTMLElement): void {
  const ctl = workspaceController;
  const items = ctl.items();
  root.textContent = '';
  root.className = 'sumi-ws';
  root.hidden = false;

  const header = el('header', 'sumi-ws__head');
  header.append(el('h1', undefined, 'Workspace'));
  header.append(
    el(
      'p',
      undefined,
      'Private, local, non-destructive until you export. Processed on this device.'
    )
  );
  root.append(header);

  const files = el('div', 'sumi-ws__files');
  files.setAttribute('aria-label', 'Open documents');
  for (const item of items) {
    const btn = el(
      'button',
      'sumi-ws__file',
      `${item.name} · ${formatBytes(item.size)}`
    );
    btn.type = 'button';
    if (item.id === ctl.active()?.id) btn.classList.add('is-active');
    btn.addEventListener('click', () => {
      ctl.setActive(item.id);
      void ensureInspect();
    });
    files.append(btn);
  }
  root.append(files);

  const tabs = el('div', 'sumi-ws__tabs');
  tabs.setAttribute('role', 'tablist');
  const panes: Array<[WorkspacePane, string]> = [
    ['inspect', 'Inspect'],
    ['flow', 'Flow'],
    ['preview', 'Preview'],
    ['proof', 'Proof'],
  ];
  for (const [id, label] of panes) {
    const tab = el('button', 'sumi-ws__tab', label);
    tab.type = 'button';
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(ctl.pane === id));
    tab.dataset.pane = id;
    tab.addEventListener('click', () => {
      ctl.setPane(id);
      if (id === 'inspect') void ensureInspect();
    });
    tabs.append(tab);
  }
  root.append(tabs);

  const body = el('div', 'sumi-ws__body');
  const primary = el('section', 'sumi-ws__primary');
  primary.setAttribute('data-testid', `pane-${ctl.pane}`);
  const aside = el('aside', 'sumi-ws__aside');
  if (ctl.pane === 'inspect') {
    renderFindings(primary);
    renderPageMap(aside);
  } else if (ctl.pane === 'flow') {
    renderFlow(primary);
    renderRecipes(aside);
  } else if (ctl.pane === 'preview') {
    renderPreview(primary);
    renderPageMap(aside);
  } else {
    renderProof(primary);
    renderPageMap(aside);
  }
  body.append(primary, aside);
  root.append(body);

  const catalog = document.getElementById('grid-view');
  const toolsHeader = document.getElementById('tools-header');
  if (items.length) {
    catalog?.classList.add('sumi-catalog--secondary');
    if (toolsHeader) toolsHeader.hidden = false;
  }
}

export function initWorkspaceEntrance(): void {
  const zone = document.getElementById('home-drop-zone');
  const input = document.getElementById(
    'home-file-input'
  ) as HTMLInputElement | null;
  if (!zone) return;
  const open = (files: File[]) => {
    const pdfs = files.filter(
      (file) =>
        file.type === 'application/pdf' ||
        file.name.toLowerCase().endsWith('.pdf')
    );
    const use = pdfs.length ? pdfs : files;
    if (!use.length) return;
    workspaceController.addFiles(use);
    void mountWorkspaceApp({ pane: 'inspect' });
    document
      .getElementById('sumi-workspace-root')
      ?.scrollIntoView({ block: 'start' });
  };
  mountDrop(zone, open);
  input?.addEventListener('change', () => {
    if (input.files) open([...input.files]);
  });

  document.querySelectorAll('[data-sumi-flow]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      const id = (node as HTMLElement).dataset.sumiFlow;
      if (id) workspaceController.loadRecipe(id);
      void mountWorkspaceApp({ pane: 'flow' });
    });
  });
}

export function getWorkspaceCommands(): Array<{
  id: string;
  label: string;
  group: string;
  run: () => void;
}> {
  const ctl = workspaceController;
  const commands = [
    {
      id: 'pane-inspect',
      label: 'Open Inspect',
      group: 'Workspace',
      run: () => ctl.setPane('inspect'),
    },
    {
      id: 'pane-flow',
      label: 'Open Flow',
      group: 'Workspace',
      run: () => ctl.setPane('flow'),
    },
    {
      id: 'pane-proof',
      label: 'Open Proof',
      group: 'Workspace',
      run: () => ctl.setPane('proof'),
    },
    ...[
      ['Inspect security', 'sentinel.html'],
      ['Find private data', 'privacy-finder.html'],
      ['Split intelligently', 'smart-split.html'],
      ['Find duplicates', 'duplicate-finder.html'],
      ['Build a packet', 'packet-builder.html'],
      ['Fill forms in batch', 'batch-forms.html'],
      ['Capture pages', 'capture.html'],
      ['Run preflight', 'print-preflight.html'],
      ['Verify receipt', 'proof-verifier.html'],
    ].map(([label, href]) => ({
      id: `original-${href}`,
      label,
      group: 'Originals',
      run: () => {
        location.href = href;
      },
    })),
    {
      id: 'execute',
      label: 'Execute flow',
      group: 'Flow',
      run: (): void => {
        void runExecute();
      },
    },
    ...SUMI_RECIPES.map((recipe) => ({
      id: `recipe-${recipe.id}`,
      label: `Recipe: ${recipe.name}`,
      group: 'Recipes',
      run: (): void => {
        ctl.loadRecipe(recipe.id);
      },
    })),
    ...FLOW_OPS.map((op) => ({
      id: `op-${op.id}`,
      label: `Add ${op.name}`,
      group: 'Operations',
      run: (): void => {
        ctl.flow.addStep(op.id);
        ctl.setPane('flow');
      },
    })),
  ];
  for (const finding of ctl.inspectMap?.findings || []) {
    commands.push({
      id: `finding-${finding.id}`,
      label: `Finding: ${finding.title}`,
      group: 'Findings',
      run: () => {
        ctl.highlightPages(finding.pages);
        ctl.setPane('inspect');
      },
    });
  }
  return commands;
}
