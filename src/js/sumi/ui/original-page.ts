import { addWorkspaceFile, listWorkspaceItems } from '../../workspace/session';
import { workspaceController } from '../../workspace/controller';
import { FlowStack } from '../../flow/stack';
import { executeFlow } from '../../flow/executor';
import { buildProofReport, proofReportToJson } from '../../proof/receipt';

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

function download(bytes: Uint8Array, name: string, type: string): void {
  const blob = new Blob([new Uint8Array(bytes)], { type });
  const url = URL.createObjectURL(blob);
  const a = el('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function bytesOf(file: Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

function mountDrop(
  zone: HTMLElement,
  accept: string,
  multiple: boolean,
  onFiles: (files: File[]) => void
): void {
  const input = zone.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement | null;
  if (input) {
    input.accept = accept;
    input.multiple = multiple;
  }
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

const COPY: Record<string, { title: string; lead: string; hedge: string }> = {
  sentinel: {
    title: 'Sentinel',
    lead: 'Review active content without running PDF JavaScript.',
    hedge: 'Sentinel never claims a file is malware-free.',
  },
  'privacy-finder': {
    title: 'Privacy Finder',
    lead: 'Find pattern hits in the text layer. OCR only if you ask.',
    hedge:
      'No name or address guessing. True redaction is opt-in; a black box is not redaction.',
  },
  'smart-split': {
    title: 'Smart Split & Rename',
    lead: 'Preview groups, names, and collisions, then download a local ZIP.',
    hedge: 'Decoded barcode values never leave this device.',
  },
  'duplicate-finder': {
    title: 'Duplicate Page Finder',
    lead: 'Group exact, text-equivalent, and probable visual duplicates.',
    hedge: 'Nothing is deleted until you send an explicit page list to Flow.',
  },
  'batch-forms': {
    title: 'Batch Form Studio',
    lead: 'Fill a template from CSV, XLSX, or JSON. One PDF per row.',
    hedge:
      'No JavaScript formulas. Signature widgets are visual, not certificates.',
  },
  'packet-builder': {
    title: 'Packet Builder',
    lead: 'Fill labeled slots, then merge with optional cover, numbers, and Proof.',
    hedge: 'Templates are starting points, not legal forms.',
  },
  'proof-verifier': {
    title: 'Proof Verifier',
    lead: 'Check original + output + receipt hashes in this tab.',
    hedge:
      'Not a signature, timestamp, authenticity mark, or legal certificate.',
  },
  capture: {
    title: 'Capture',
    lead: 'Import image pages, reorder them, and build a PDF locally.',
    hedge:
      'Camera capture is experimental. Import is the reliable path in this build.',
  },
  'print-preflight': {
    title: 'Print Preflight',
    lead: 'Local print-risk list with honest not-verifiable rows.',
    hedge:
      'Not an ISO or GWG certificate. Safe repairs are optional Flow steps.',
  },
  'accessibility-audit': {
    title: 'Accessibility Audit',
    lead: 'Indicators plus safe title and language fixes.',
    hedge: 'Not PDF/UA. Not WCAG. Sumi does not auto-tag.',
  },
  'watch-folder': {
    title: 'Folder Import',
    lead: 'Review a local folder and detect changes you explicitly refresh.',
    hedge:
      'Experimental Chromium feature. This build does not run background automation.',
  },
};

interface ToolInputPolicy {
  accept: string;
  multiple: boolean;
  minFiles: number;
  maxFiles: number;
  prompt: string;
  helper: string;
  action: string;
}

const DEFAULT_INPUT_POLICY: ToolInputPolicy = {
  accept: 'application/pdf',
  multiple: false,
  minFiles: 1,
  maxFiles: 1,
  prompt: 'Choose a PDF',
  helper: 'or drag it here',
  action: 'Run locally',
};

const INPUT_POLICIES: Partial<Record<string, ToolInputPolicy>> = {
  'batch-forms': {
    accept: 'application/pdf,.csv,.xlsx,.xls,.json',
    multiple: true,
    minFiles: 2,
    maxFiles: 2,
    prompt: 'Choose a PDF template and data file',
    helper: 'CSV, XLSX, or JSON · both files can be selected together',
    action: 'Map fields',
  },
  'packet-builder': {
    accept: 'application/pdf',
    multiple: true,
    minFiles: 1,
    maxFiles: 12,
    prompt: 'Choose packet documents',
    helper: 'select or drop multiple PDFs',
    action: 'Configure packet',
  },
  'proof-verifier': {
    accept: 'application/pdf,application/json,.json',
    multiple: true,
    minFiles: 3,
    maxFiles: 3,
    prompt: 'Choose original, output, and receipt',
    helper: 'two PDFs and one Proof JSON',
    action: 'Verify receipt',
  },
  capture: {
    accept: 'image/png,image/jpeg,image/webp',
    multiple: true,
    minFiles: 1,
    maxFiles: 50,
    prompt: 'Choose image pages',
    helper: 'PNG, JPEG, or WebP · select multiple pages',
    action: 'Open capture studio',
  },
};

function fileKey(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export async function mountOriginalTool(
  root: HTMLElement,
  toolId: string
): Promise<void> {
  const copy = COPY[toolId];
  if (!copy) {
    root.append(el('p', undefined, 'Unknown original tool.'));
    return;
  }
  root.textContent = '';
  const shell = el('section', 'sumi-original');
  shell.dataset.tool = toolId;
  const head = el('header', 'sumi-ws__head');
  head.append(
    el('h1', undefined, copy.title),
    el('p', undefined, copy.lead),
    el('p', 'sumi-ws__hedge', copy.hedge)
  );
  const policy = INPUT_POLICIES[toolId] || DEFAULT_INPUT_POLICY;
  const drop = el('div', 'sumi-drop');
  drop.append(
    el('strong', undefined, policy.prompt),
    el('p', undefined, policy.helper),
    el(
      'p',
      undefined,
      'Stays in this tab. Engines load only after you continue.'
    )
  );
  const input = el('input') as HTMLInputElement;
  input.type = 'file';
  input.id = 'original-file';
  input.setAttribute('aria-label', policy.prompt);
  drop.append(input);
  const selection = el('div', 'sumi-file-queue');
  selection.setAttribute('aria-live', 'polite');
  const status = el('p', 'sumi-ws__status', '');
  status.dataset.testid = 'original-status';
  const body = el('div', 'sumi-original__body');
  body.dataset.testid = 'original-body';
  const run = el('button', 'sumi-btn sumi-btn--signal', policy.action);
  run.type = 'button';
  run.disabled = true;
  const controls = el('div', 'sumi-original__controls');
  controls.append(run);
  shell.append(head, drop, selection, controls, status, body);
  root.append(shell);

  let selectedFiles: File[] = [];
  const renderSelection = (): void => {
    selection.textContent = '';
    if (!selectedFiles.length) {
      selection.append(el('p', 'sumi-ws__hedge', 'No files selected.'));
    } else {
      const list = el('ol', 'sumi-file-queue__list');
      selectedFiles.forEach((file, index) => {
        const item = el('li', 'sumi-file-queue__item');
        const description = el('span');
        description.append(
          el('strong', undefined, file.name),
          el(
            'small',
            undefined,
            `${file.type || 'unknown type'} · ${(file.size / 1024).toFixed(1)} KB`
          )
        );
        const remove = el('button', 'sumi-btn sumi-btn--small', 'Remove');
        remove.type = 'button';
        remove.setAttribute('aria-label', `Remove ${file.name}`);
        remove.addEventListener('click', () => {
          selectedFiles = selectedFiles.filter((_, i) => i !== index);
          renderSelection();
        });
        item.append(description, remove);
        list.append(item);
      });
      selection.append(list);
    }
    const validCount =
      selectedFiles.length >= policy.minFiles &&
      selectedFiles.length <= policy.maxFiles;
    run.disabled = !validCount;
    status.textContent = validCount
      ? `${selectedFiles.length} file(s) ready. Nothing has run yet.`
      : `Select ${policy.minFiles === policy.maxFiles ? policy.minFiles : `${policy.minFiles}–${policy.maxFiles}`} file(s).`;
  };

  mountDrop(drop, policy.accept, policy.multiple, (incoming) => {
    if (policy.multiple) {
      const next = new Map(selectedFiles.map((file) => [fileKey(file), file]));
      incoming.forEach((file) => next.set(fileKey(file), file));
      selectedFiles = [...next.values()].slice(0, policy.maxFiles);
    } else {
      selectedFiles = incoming.slice(0, 1);
    }
    input.value = '';
    renderSelection();
  });

  run.addEventListener('click', () => {
    void runTool(toolId, selectedFiles.slice(), body, status);
  });

  const existing = listWorkspaceItems()[0];
  if (
    existing &&
    toolId !== 'batch-forms' &&
    toolId !== 'proof-verifier' &&
    toolId !== 'watch-folder'
  ) {
    const file = new File([existing.blob], existing.name, {
      type: existing.mimeType,
    });
    selectedFiles = [file];
  }
  renderSelection();

  if (toolId === 'watch-folder') {
    drop.hidden = true;
    selection.hidden = true;
    controls.hidden = true;
    void runTool(toolId, [], body, status);
  }
}

async function runTool(
  toolId: string,
  files: File[],
  body: HTMLElement,
  status: HTMLElement
): Promise<void> {
  body.textContent = '';
  status.textContent = 'Working on this device…';
  try {
    if (!files.length && toolId !== 'watch-folder') {
      throw new Error('Choose the required file(s) before running this tool.');
    }
    switch (toolId) {
      case 'sentinel':
        await runSentinel(files[0], body, status);
        break;
      case 'privacy-finder':
        await runPrivacy(files[0], body, status);
        break;
      case 'smart-split':
        await runSplit(files[0], body, status);
        break;
      case 'duplicate-finder':
        await runDuplicates(files[0], body, status);
        break;
      case 'batch-forms':
        await runBatch(files, body, status);
        break;
      case 'packet-builder':
        await runPacket(files, body, status);
        break;
      case 'proof-verifier':
        await runVerifier(files, body, status);
        break;
      case 'capture':
        await runCapture(files, body, status);
        break;
      case 'print-preflight':
        await runPreflightUi(files[0], body, status);
        break;
      case 'accessibility-audit':
        await runA11y(files[0], body, status);
        break;
      case 'watch-folder':
        await runWatch(body, status);
        break;
      default:
        status.textContent = 'Unknown tool.';
    }
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : String(error);
  }
}

function listFindings(
  host: HTMLElement,
  rows: Array<{ title: string; body: string; meta?: string }>
): void {
  const ul = el('ul', 'sumi-findings');
  for (const row of rows) {
    const li = el('li', 'sumi-finding');
    li.append(el('strong', undefined, row.title), el('p', undefined, row.body));
    if (row.meta) li.append(el('p', 'sumi-ws__hedge', row.meta));
    ul.append(li);
  }
  host.append(ul);
}

async function runSentinel(
  file: File,
  body: HTMLElement,
  status: HTMLElement
): Promise<void> {
  const { scanSentinel, SENTINEL_DISCLAIMER } =
    await import('../sentinel/index.js');
  const bytes = await bytesOf(file);
  const report = await scanSentinel(bytes, file.name);
  status.textContent = `${report.findings.length} finding(s). JavaScript was not executed.`;
  body.append(el('p', 'sumi-ws__hedge', SENTINEL_DISCLAIMER));
  listFindings(
    body,
    report.findings.map((f) => ({
      title: `${f.severity} — ${f.title}`,
      body: f.explanation,
      meta: `${f.category}${f.page ? ` · page ${f.page}` : ''} · ${f.evidence} · impact: ${f.impact}`,
    }))
  );
  const actions = el('div', 'sumi-flow__run');
  const safe = el(
    'button',
    'sumi-btn sumi-btn--signal',
    'Add Safe Copy to Flow'
  );
  safe.type = 'button';
  safe.addEventListener('click', () => {
    addWorkspaceFile(file, { name: file.name, sourceToolId: 'sentinel' });
    workspaceController.loadRecipe('sentinel-safe-copy');
    window.location.href = 'workspace.html#flow';
  });
  const rerun = el('button', 'sumi-btn', 'Proof after Flow');
  rerun.type = 'button';
  rerun.addEventListener('click', () => {
    window.location.href = 'workspace.html#proof';
  });
  actions.append(safe, rerun);
  body.append(actions);
}

async function runPrivacy(
  file: File,
  body: HTMLElement,
  status: HTMLElement
): Promise<void> {
  const { scanPrivacy, applyPrivacyRedaction, hitsForSelection } =
    await import('../privacy-finder/index.js');
  const bytes = await bytesOf(file);
  let custom: string[] = [];
  let customRegexes: string[] = [];
  let excluded: string[] = [];
  const render = async () => {
    body.textContent = '';
    const result = await scanPrivacy(bytes, {
      customTerms: custom,
      customRegexes,
      excludedValues: excluded,
    });
    status.textContent = `${result.hits.length} hit(s) on the text layer. OCR was not used.`;
    body.append(el('p', 'sumi-ws__hedge', result.limitations[0] || ''));
    const selected = new Set(result.hits.map((h) => h.id));
    const ul = el('ul', 'sumi-findings');
    for (const hit of result.hits) {
      const li = el('li', 'sumi-finding');
      const label = el('label');
      const box = el('input') as HTMLInputElement;
      box.type = 'checkbox';
      box.checked = true;
      box.addEventListener('change', () => {
        if (box.checked) selected.add(hit.id);
        else selected.delete(hit.id);
      });
      label.append(
        box,
        document.createTextNode(` ${hit.kind}: ${hit.value} (p.${hit.page})`)
      );
      li.append(label, el('p', 'sumi-ws__hedge', hit.context));
      ul.append(li);
    }
    body.append(ul);
    const term = el('input') as HTMLInputElement;
    term.placeholder = 'Custom term (literal)';
    const addTerm = el(
      'button',
      'sumi-btn sumi-btn--small',
      'Add term & rescan'
    );
    addTerm.type = 'button';
    addTerm.addEventListener('click', () => {
      if (term.value.trim()) custom = [...custom, term.value.trim()];
      void render();
    });
    const regexInput = el('input') as HTMLInputElement;
    regexInput.placeholder = 'Bounded custom regex';
    const addRegex = el(
      'button',
      'sumi-btn sumi-btn--small',
      'Add regex & rescan'
    );
    addRegex.type = 'button';
    addRegex.addEventListener('click', async () => {
      const { validateCustomRegex } =
        await import('../privacy-finder/index.js');
      const check = validateCustomRegex(regexInput.value);
      if (check.ok === false) {
        status.textContent = check.reason;
        return;
      }
      customRegexes = [...customRegexes, regexInput.value.trim()];
      void render();
    });
    const exclude = el('input') as HTMLInputElement;
    exclude.placeholder = 'Exclude value';
    const addEx = el('button', 'sumi-btn sumi-btn--small', 'Exclude & rescan');
    addEx.type = 'button';
    addEx.addEventListener('click', () => {
      if (exclude.value.trim()) excluded = [...excluded, exclude.value.trim()];
      void render();
    });
    const cover = el(
      'button',
      'sumi-btn',
      'Visual cover unavailable without coordinates'
    );
    cover.type = 'button';
    cover.disabled = true;
    cover.title =
      'Privacy Finder does not yet have verified bounding boxes for these text hits.';
    const redact = el(
      'button',
      'sumi-btn sumi-btn--signal',
      'Redact selected and verify'
    );
    redact.type = 'button';
    const apply = async (mode: 'true' | 'cover') => {
      const hits = hitsForSelection(result.hits, [...selected], excluded);
      const out = await applyPrivacyRedaction(bytes, { hits, mode });
      const verified = mode === 'true' && out.stillExtractable.length === 0;
      const suffix =
        mode === 'cover'
          ? 'visual-cover'
          : verified
            ? 'redacted'
            : 'redaction-unverified';
      addWorkspaceFile(
        new Blob([new Uint8Array(out.bytes)], { type: 'application/pdf' }),
        {
          name: file.name.replace(/\.pdf$/i, `-${suffix}.pdf`),
          sourceToolId: 'privacy-finder',
        }
      );
      download(
        out.bytes,
        file.name.replace(/\.pdf$/i, `-${suffix}.pdf`),
        'application/pdf'
      );
      status.textContent = verified
        ? out.notes.join(' ')
        : `Verification failed: ${out.stillExtractable.length} selected marker(s) remain extractable. ${out.notes.join(' ')}`;
    };
    redact.addEventListener('click', () => void apply('true'));
    body.append(
      term,
      addTerm,
      regexInput,
      addRegex,
      exclude,
      addEx,
      el('div', 'sumi-flow__run')
    );
    body.lastElementChild?.append(cover, redact);
  };
  await render();
}

async function runSplit(
  file: File,
  body: HTMLElement,
  status: HTMLElement
): Promise<void> {
  const {
    collectPageSignals,
    planSplit,
    executeSplitPlan,
    scanPdfBarcodes,
    detectBarcodeEngines,
  } = await import('../smart-split/index.js');
  const bytes = await bytesOf(file);
  const engines = await detectBarcodeEngines();
  status.textContent = engines.note;

  let barcodeByPage: Array<{ page: number; value: string }> = [];
  const rule = el('select') as HTMLSelectElement;
  for (const value of [
    'page-count',
    'ranges',
    'bookmarks',
    'headings',
    'text',
    'regex',
    'blank',
    'page-size',
    'orientation',
    'qr',
    'barcode',
    'captured-value',
  ]) {
    rule.append(new Option(value, value));
  }
  const extra = el('input') as HTMLInputElement;
  extra.placeholder = 'N, ranges, text, or regex';
  const template = el('input') as HTMLInputElement;
  template.value = '{original}-{counter}-{pages}.pdf';
  const preview = el('div');
  const scanBtn = el(
    'button',
    'sumi-btn sumi-btn--ghost',
    'Scan pages for barcodes'
  );
  scanBtn.type = 'button';
  scanBtn.addEventListener('click', async () => {
    if (engines.unsupported) {
      status.textContent = engines.note;
      return;
    }
    status.textContent = 'Rendering pages and decoding barcodes locally…';
    try {
      const { hits } = await scanPdfBarcodes(bytes, {
        onProgress: (p) => {
          status.textContent = p.message;
        },
      });
      barcodeByPage = hits.map((h) => ({ page: h.page, value: h.rawValue }));
      status.textContent = hits.length
        ? `Detected ${hits.length} barcode(s) with ${hits[0].engine}. Values stay on this device.`
        : 'No barcodes detected on rendered pages.';
      await draw();
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : 'Barcode scan failed.';
    }
  });

  const draw = async () => {
    preview.textContent = '';
    const signals = await collectPageSignals(bytes, {
      barcodes: barcodeByPage,
    });
    const plan = planSplit(signals, {
      rule: rule.value as never,
      pageCount: Number(extra.value) || 1,
      ranges: extra.value,
      text: extra.value,
      regex: extra.value,
      template: template.value,
      originalName: file.name,
    });
    status.textContent = `${plan.groups.length} group(s). Names stay local.`;
    listFindings(
      preview,
      plan.groups.map((g) => ({
        title: g.filename + (g.collision ? ' (collision renamed)' : ''),
        body: `Pages ${g.rangeLabel} · ${g.rule}${g.barcode ? ` · ${g.barcode}` : ''}`,
      }))
    );
    const go = el('button', 'sumi-btn sumi-btn--signal', 'Download ZIP');
    go.type = 'button';
    go.addEventListener('click', async () => {
      const { zip } = await executeSplitPlan(bytes, plan);
      download(
        zip,
        file.name.replace(/\.pdf$/i, '-split.zip'),
        'application/zip'
      );
    });
    preview.append(go);
  };
  rule.addEventListener('change', () => void draw());
  extra.addEventListener('change', () => void draw());
  template.addEventListener('change', () => void draw());
  body.append(
    el('label', undefined, 'Rule'),
    rule,
    extra,
    template,
    scanBtn,
    preview
  );
  await draw();
}

async function runDuplicates(
  file: File,
  body: HTMLElement,
  status: HTMLElement
): Promise<void> {
  const { fingerprintPages, groupDuplicates, pagesToDelete } =
    await import('../duplicate-finder/index.js');
  const bytes = await bytesOf(file);
  const prints = await fingerprintPages(bytes);
  const report = groupDuplicates(prints);
  status.textContent = `${report.sets.length} set(s). Auto-deleted: ${report.autoDeleted}.`;
  listFindings(
    body,
    report.sets.map((set) => ({
      title: `${set.kind} · pages ${set.pages.join(', ')}`,
      body: set.explanation,
      meta: `Keep-best (measurable quality) would keep page ${set.keepPage}.`,
    }))
  );
  const strategy = el('select') as HTMLSelectElement;
  strategy.append(
    new Option('Keep first', 'keep-first'),
    new Option('Keep best quality', 'keep-best')
  );
  const send = el(
    'button',
    'sumi-btn sumi-btn--signal',
    'Send delete list to Flow'
  );
  send.type = 'button';
  send.addEventListener('click', () => {
    const pages = pagesToDelete(
      report,
      strategy.value as 'keep-first' | 'keep-best'
    );
    addWorkspaceFile(file, {
      name: file.name,
      sourceToolId: 'duplicate-finder',
    });
    workspaceController.flow.addStep('delete-duplicates', {
      pages: pages.join(','),
    });
    window.location.href = 'workspace.html#flow';
  });
  body.append(strategy, send);
}

async function runBatch(
  files: File[],
  body: HTMLElement,
  status: HTMLElement
): Promise<void> {
  const pdf = files.find((f) => f.name.toLowerCase().endsWith('.pdf'));
  const table =
    files.find((f) => !f.name.toLowerCase().endsWith('.pdf')) || files[1];
  if (!pdf) {
    status.textContent = 'Choose a PDF template, then a CSV/XLSX/JSON file.';
    return;
  }
  const { listFormFields, parseSpreadsheet, fillBatch, zipBatch } =
    await import('../batch-forms/index.js');
  const templateBytes = await bytesOf(pdf);
  const fields = await listFormFields(templateBytes);
  if (!table) {
    status.textContent = `${fields.length} field(s). Add a spreadsheet to fill.`;
    listFindings(
      body,
      fields.map((f) => ({
        title: f.name,
        body: `${f.type}${f.isCryptoSignature ? ' (not a crypto signature)' : ''}`,
      }))
    );
    return;
  }
  const rows = await parseSpreadsheet(await bytesOf(table), table.name);
  const columns = Object.keys(rows[0] || {});
  if (!fields.length) {
    status.textContent = 'This PDF has no fillable AcroForm fields.';
    return;
  }
  if (!rows.length || !columns.length) {
    status.textContent = 'The data file contains no usable rows.';
    return;
  }

  status.textContent = `${fields.length} field(s) · ${rows.length} data row(s). Review the mapping before generation.`;
  const studio = el('section', 'sumi-studio');
  const intro = el('div', 'sumi-studio__intro');
  intro.append(
    el('h2', undefined, 'Map template fields'),
    el(
      'p',
      'sumi-ws__hedge',
      'Nothing is generated until you confirm this mapping.'
    )
  );
  studio.append(intro);

  const mappingEditors: Array<{
    field: string;
    column: HTMLSelectElement;
    transform: HTMLSelectElement;
  }> = [];
  const mappingList = el('div', 'sumi-mapping');
  for (const field of fields.filter((item) => item.type !== 'signature')) {
    const row = el('div', 'sumi-mapping__row');
    const fieldName = el('strong', undefined, field.name);
    const fieldMeta = el(
      'small',
      undefined,
      `${field.type}${field.options?.length ? ` · ${field.options.length} choices` : ''}`
    );
    const label = el('label');
    label.append(document.createTextNode('Data column'));
    const select = el('select') as HTMLSelectElement;
    select.append(new Option('Do not fill', ''));
    columns.forEach((column) => select.append(new Option(column, column)));
    const exact = columns.find(
      (column) => column.toLowerCase() === field.name.toLowerCase()
    );
    select.value = exact || '';
    label.append(select);

    const transformLabel = el('label');
    transformLabel.append(document.createTextNode('Transform'));
    const transform = el('select') as HTMLSelectElement;
    for (const value of [
      'none',
      'trim',
      'upper',
      'lower',
      'title',
      'date-iso',
      'date-it',
      'date-us',
    ]) {
      transform.append(new Option(value, value));
    }
    transform.value = 'trim';
    transformLabel.append(transform);
    const fieldCell = el('div');
    fieldCell.append(fieldName, fieldMeta);
    row.append(fieldCell, label, transformLabel);
    mappingList.append(row);
    mappingEditors.push({ field: field.name, column: select, transform });
  }
  studio.append(mappingList);

  const preview = el('div', 'sumi-data-preview');
  preview.append(el('h2', undefined, 'Data preview'));
  const tablePreview = el('table');
  const thead = el('thead');
  const headerRow = el('tr');
  columns
    .slice(0, 6)
    .forEach((column) => headerRow.append(el('th', undefined, column)));
  thead.append(headerRow);
  const tbody = el('tbody');
  rows.slice(0, 3).forEach((dataRow) => {
    const tr = el('tr');
    columns
      .slice(0, 6)
      .forEach((column) =>
        tr.append(el('td', undefined, dataRow[column] || '—'))
      );
    tbody.append(tr);
  });
  tablePreview.append(thead, tbody);
  preview.append(tablePreview);
  studio.append(preview);

  const options = el('fieldset', 'sumi-studio__options');
  options.append(el('legend', undefined, 'Output'));
  const flattenLabel = el('label');
  const flatten = el('input') as HTMLInputElement;
  flatten.type = 'checkbox';
  flatten.checked = true;
  flattenLabel.append(flatten, document.createTextNode(' Flatten form fields'));
  const skipLabel = el('label');
  const skipInvalid = el('input') as HTMLInputElement;
  skipInvalid.type = 'checkbox';
  skipInvalid.checked = true;
  skipLabel.append(
    skipInvalid,
    document.createTextNode(' Skip rows with mapping errors')
  );
  const namingLabel = el('label');
  namingLabel.append(document.createTextNode('Filename template'));
  const naming = el('input') as HTMLInputElement;
  naming.type = 'text';
  naming.value = '{original}-{counter}.pdf';
  namingLabel.append(naming);
  options.append(flattenLabel, skipLabel, namingLabel);
  studio.append(options);

  const output = el('div', 'sumi-studio__result');
  const generate = el(
    'button',
    'sumi-btn sumi-btn--signal',
    'Generate local batch'
  );
  generate.type = 'button';
  generate.addEventListener('click', async () => {
    generate.disabled = true;
    output.textContent = '';
    status.textContent = `Generating ${rows.length} row(s) on this device…`;
    try {
      const mapping = mappingEditors
        .filter((editor) => editor.column.value)
        .map((editor) => ({
          field: editor.field,
          column: editor.column.value,
          transform: editor.transform.value as
            | 'none'
            | 'trim'
            | 'upper'
            | 'lower'
            | 'title'
            | 'date-iso'
            | 'date-it'
            | 'date-us',
        }));
      if (!mapping.length) {
        throw new Error('Map at least one template field.');
      }
      const result = await fillBatch(templateBytes, rows, {
        mapping,
        flatten: flatten.checked,
        skipInvalid: skipInvalid.checked,
        filenameTemplate: naming.value.trim() || '{original}-{counter}.pdf',
      });
      status.textContent = `${result.files.length} PDF(s) ready · ${result.skipped.length} skipped.`;
      if (result.issues.length) {
        listFindings(
          output,
          result.issues.slice(0, 50).map((issue) => ({
            title: `Row ${issue.row} · ${issue.field}`,
            body: issue.message,
            meta: issue.repair ? `Source value: ${issue.repair}` : undefined,
          }))
        );
      }
      output.append(el('p', 'sumi-ws__hedge', result.notes.join(' ')));
      if (result.files.length) {
        const zip = await zipBatch(result);
        const downloadButton = el(
          'button',
          'sumi-btn sumi-btn--signal',
          'Download ZIP'
        );
        downloadButton.type = 'button';
        downloadButton.addEventListener('click', () =>
          download(zip, 'batch-forms.zip', 'application/zip')
        );
        output.append(downloadButton);
      }
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : String(error);
    } finally {
      generate.disabled = false;
    }
  });
  studio.append(generate, output);
  body.append(studio);
}

async function runPacket(
  files: File[],
  body: HTMLElement,
  status: HTMLElement
): Promise<void> {
  const { PACKET_TEMPLATES, buildPacket } =
    await import('../packet-builder/index.js');
  const fileBytes = await Promise.all(files.map((file) => bytesOf(file)));
  const studio = el('section', 'sumi-studio');
  const templateLabel = el('label');
  templateLabel.append(document.createTextNode('Packet template'));
  const templateSelect = el('select') as HTMLSelectElement;
  PACKET_TEMPLATES.forEach((template) =>
    templateSelect.append(new Option(template.name, template.id))
  );
  templateLabel.append(templateSelect);

  const summary = el('p', 'sumi-ws__hedge');
  const slotsHost = el('div', 'sumi-packet-slots');
  const options = el('fieldset', 'sumi-studio__options');
  options.append(el('legend', undefined, 'Packet options'));
  const option = (labelText: string, checked: boolean) => {
    const label = el('label');
    const input = el('input') as HTMLInputElement;
    input.type = 'checkbox';
    input.checked = checked;
    label.append(input, document.createTextNode(` ${labelText}`));
    options.append(label);
    return input;
  };
  const cover = option('Cover page', true);
  const separators = option('Section separators', true);
  const toc = option('Table of contents and bookmarks', true);
  const pageNumbers = option('Page numbers', true);
  const normalize = option('Fit pages to A4', false);
  const cleanMetadata = option('Remove document metadata', true);
  const compress = option('Attempt object-stream compression', false);
  const output = el('div', 'sumi-studio__result');
  const build = el(
    'button',
    'sumi-btn sumi-btn--signal',
    'Build packet locally'
  );
  build.type = 'button';

  let slotSelects: HTMLSelectElement[] = [];
  const currentTemplate = () =>
    PACKET_TEMPLATES.find((item) => item.id === templateSelect.value) ||
    PACKET_TEMPLATES[0];

  const renderSlots = (): void => {
    const template = currentTemplate();
    summary.textContent = template.summary;
    slotsHost.textContent = '';
    slotSelects = [];
    template.slots.forEach((slot, index) => {
      const row = el('label', 'sumi-packet-slot');
      const label = el(
        'span',
        undefined,
        `${slot.label}${slot.required ? ' · required' : ' · optional'}`
      );
      const select = el('select') as HTMLSelectElement;
      select.append(new Option('Leave empty', ''));
      files.forEach((file, fileIndex) =>
        select.append(new Option(file.name, String(fileIndex)))
      );
      if (files[index]) select.value = String(index);
      row.append(label, select);
      slotsHost.append(row);
      slotSelects.push(select);
    });
  };
  templateSelect.addEventListener('change', renderSlots);
  renderSlots();

  build.addEventListener('click', async () => {
    build.disabled = true;
    output.textContent = '';
    status.textContent = 'Building packet on this device…';
    try {
      const template = currentTemplate();
      const slots = template.slots.map((slot, index) => {
        const selected = slotSelects[index]?.value;
        const fileIndex = selected === '' ? -1 : Number(selected);
        return {
          ...slot,
          fileName: fileIndex >= 0 ? files[fileIndex]?.name : undefined,
          bytes: fileIndex >= 0 ? fileBytes[fileIndex] : undefined,
        };
      });
      const built = await buildPacket(slots, {
        normalize: normalize.checked,
        compress: compress.checked,
        coverTitle: cover.checked ? template.name : undefined,
        separators: separators.checked,
        bookmarks: toc.checked,
        toc: toc.checked,
        pageNumbers: pageNumbers.checked,
        cleanMetadata: cleanMetadata.checked,
      });
      const blocking = built.warnings.filter(
        (warning) => warning.level === 'missing'
      );
      status.textContent = blocking.length
        ? `${blocking.length} required slot(s) are missing. The preview was still built.`
        : 'Packet ready. Review the notes, then export or add it to the workspace.';
      listFindings(
        output,
        built.warnings.map((warning) => ({
          title: warning.level,
          body: warning.message,
        }))
      );
      output.append(el('p', 'sumi-ws__hedge', built.notes.join(' ')));

      const stack = new FlowStack();
      stack.addStep('remove-metadata');
      const execution = await executeFlow(stack.document, {
        bytes: built.bytes,
        fileName: 'packet.pdf',
      });
      const proof = await buildProofReport({ execution });
      const actions = el('div', 'sumi-flow__run');
      const downloadPacket = el(
        'button',
        'sumi-btn sumi-btn--signal',
        'Download packet PDF'
      );
      downloadPacket.type = 'button';
      downloadPacket.addEventListener('click', () =>
        download(built.bytes, 'packet.pdf', 'application/pdf')
      );
      const downloadProof = el('button', 'sumi-btn', 'Download Proof JSON');
      downloadProof.type = 'button';
      downloadProof.addEventListener('click', () =>
        download(
          new TextEncoder().encode(proofReportToJson(proof)),
          'packet-proof.json',
          'application/json'
        )
      );
      const add = el('button', 'sumi-btn', 'Add packet to workspace');
      add.type = 'button';
      add.addEventListener('click', () => {
        addWorkspaceFile(
          new Blob([new Uint8Array(built.bytes)], {
            type: 'application/pdf',
          }),
          { name: 'packet.pdf', sourceToolId: 'packet-builder' }
        );
        add.disabled = true;
        add.textContent = 'Added to workspace';
      });
      actions.append(downloadPacket, downloadProof, add);
      output.append(actions);
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : String(error);
    } finally {
      build.disabled = false;
    }
  });

  studio.append(templateLabel, summary, slotsHost, options, build, output);
  body.append(studio);
  status.textContent = `${files.length} document(s) ready for slot mapping.`;
}

async function runVerifier(
  files: File[],
  body: HTMLElement,
  status: HTMLElement
): Promise<void> {
  const { verifyProofReceipt } = await import('../proof/index.js');
  const pdfs = files.filter((f) => f.name.toLowerCase().endsWith('.pdf'));
  const json = files.find((f) => f.name.toLowerCase().endsWith('.json'));
  if (pdfs.length < 2 || !json) {
    status.textContent = 'Need original PDF, output PDF, and a receipt JSON.';
    return;
  }
  const receipt = JSON.parse(await json.text());
  const report = await verifyProofReceipt({
    originalBytes: await bytesOf(pdfs[0]),
    outputBytes: await bytesOf(pdfs[1]),
    receipt,
  });
  status.textContent = report.ok
    ? 'Hashes match. Unverifiable claims are listed.'
    : 'Mismatch or invalid receipt.';
  body.append(el('p', 'sumi-ws__hedge', report.disclaimer));
  listFindings(
    body,
    report.findings.map((f) => ({
      title: `${f.status} — ${f.id}`,
      body: f.detail,
    }))
  );
}

async function captureFileToPdfImage(
  file: File,
  rotation: 0 | 90 | 180 | 270
): Promise<{ bytes: Uint8Array; mimeType: string }> {
  if (rotation === 0 && /image\/(png|jpe?g)/i.test(file.type)) {
    return { bytes: await bytesOf(file), mimeType: file.type };
  }
  if (typeof createImageBitmap !== 'function') {
    throw new Error('This browser cannot normalize this image format.');
  }
  const bitmap = await createImageBitmap(file);
  const swap = rotation === 90 || rotation === 270;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? bitmap.height : bitmap.width;
  canvas.height = swap ? bitmap.width : bitmap.height;
  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    throw new Error('Canvas processing is unavailable in this browser.');
  }
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) =>
        value ? resolve(value) : reject(new Error('Image conversion failed.')),
      'image/png'
    );
  });
  return { bytes: await bytesOf(blob), mimeType: 'image/png' };
}

async function runCapture(
  files: File[],
  body: HTMLElement,
  status: HTMLElement
): Promise<void> {
  const { imagesToPdf, cameraConstraints } =
    await import('../capture/index.js');
  type CaptureEntry = {
    file: File;
    rotation: 0 | 90 | 180 | 270;
  };
  let entries: CaptureEntry[] = files
    .filter((file) => file.type.startsWith('image/'))
    .map((file) => ({ file, rotation: 0 }));
  let stream: MediaStream | null = null;
  const studio = el('section', 'sumi-capture-studio');
  const camera = el('div', 'sumi-camera');
  const video = el('video') as HTMLVideoElement;
  video.autoplay = true;
  video.playsInline = true;
  video.muted = true;
  video.hidden = true;
  const cameraActions = el('div', 'sumi-flow__run');
  const start = el('button', 'sumi-btn', 'Use camera');
  const take = el('button', 'sumi-btn sumi-btn--signal', 'Capture page');
  const stop = el('button', 'sumi-btn', 'Stop camera');
  start.type = take.type = stop.type = 'button';
  take.disabled = true;
  stop.disabled = true;
  cameraActions.append(start, take, stop);
  camera.append(video, cameraActions);

  const pages = el('ol', 'sumi-capture-pages');
  const output = el('div', 'sumi-studio__result');
  const build = el(
    'button',
    'sumi-btn sumi-btn--signal',
    'Build PDF from pages'
  );
  build.type = 'button';

  const renderPages = (): void => {
    pages.textContent = '';
    entries.forEach((entry, index) => {
      const item = el('li', 'sumi-capture-page');
      const image = el('img') as HTMLImageElement;
      const url = URL.createObjectURL(entry.file);
      image.src = url;
      image.alt = `Preview of ${entry.file.name}`;
      image.style.transform = `rotate(${entry.rotation}deg)`;
      image.addEventListener('load', () => URL.revokeObjectURL(url), {
        once: true,
      });
      const meta = el('div');
      meta.append(
        el('strong', undefined, entry.file.name),
        el('small', undefined, `Page ${index + 1} · ${entry.rotation}°`)
      );
      const actions = el('div', 'sumi-flow__run');
      const up = el('button', 'sumi-btn sumi-btn--small', 'Up');
      const down = el('button', 'sumi-btn sumi-btn--small', 'Down');
      const rotate = el('button', 'sumi-btn sumi-btn--small', 'Rotate');
      const remove = el('button', 'sumi-btn sumi-btn--small', 'Remove');
      up.type = down.type = rotate.type = remove.type = 'button';
      up.disabled = index === 0;
      down.disabled = index === entries.length - 1;
      up.addEventListener('click', () => {
        [entries[index - 1], entries[index]] = [
          entries[index],
          entries[index - 1],
        ];
        renderPages();
      });
      down.addEventListener('click', () => {
        [entries[index], entries[index + 1]] = [
          entries[index + 1],
          entries[index],
        ];
        renderPages();
      });
      rotate.addEventListener('click', () => {
        entry.rotation = ((entry.rotation + 90) % 360) as 0 | 90 | 180 | 270;
        renderPages();
      });
      remove.addEventListener('click', () => {
        entries = entries.filter((_, itemIndex) => itemIndex !== index);
        renderPages();
      });
      actions.append(up, down, rotate, remove);
      item.append(image, meta, actions);
      pages.append(item);
    });
    build.disabled = entries.length === 0;
    status.textContent = entries.length
      ? `${entries.length} page(s) ready. Reorder or rotate before export.`
      : 'Add at least one image page.';
  };

  const stopCamera = (): void => {
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
    video.hidden = true;
    take.disabled = true;
    stop.disabled = true;
    start.disabled = false;
  };
  start.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent = 'Camera API unavailable. Use image import instead.';
      return;
    }
    try {
      stream = await navigator.mediaDevices.getUserMedia(cameraConstraints());
      video.srcObject = stream;
      video.hidden = false;
      take.disabled = false;
      stop.disabled = false;
      start.disabled = true;
      status.textContent =
        'Camera active. Nothing is recorded until you capture.';
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : 'Camera permission failed.';
    }
  });
  stop.addEventListener('click', stopCamera);
  take.addEventListener('click', async () => {
    if (!video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0);
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) =>
          value ? resolve(value) : reject(new Error('Camera capture failed.')),
        'image/png'
      );
    });
    entries.push({
      file: new File([blob], `camera-page-${entries.length + 1}.png`, {
        type: 'image/png',
        lastModified: Date.now(),
      }),
      rotation: 0,
    });
    renderPages();
  });

  build.addEventListener('click', async () => {
    build.disabled = true;
    output.textContent = '';
    status.textContent = 'Normalizing image pages and building PDF locally…';
    try {
      const normalized = [];
      for (const entry of entries) {
        normalized.push(
          await captureFileToPdfImage(entry.file, entry.rotation)
        );
      }
      const pdf = await imagesToPdf(normalized);
      status.textContent = `${entries.length} page PDF ready.`;
      const actions = el('div', 'sumi-flow__run');
      const downloadPdf = el(
        'button',
        'sumi-btn sumi-btn--signal',
        'Download capture.pdf'
      );
      downloadPdf.type = 'button';
      downloadPdf.addEventListener('click', () =>
        download(pdf, 'capture.pdf', 'application/pdf')
      );
      const add = el('button', 'sumi-btn', 'Add to workspace');
      add.type = 'button';
      add.addEventListener('click', () => {
        addWorkspaceFile(
          new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }),
          { name: 'capture.pdf', sourceToolId: 'capture' }
        );
        add.disabled = true;
        add.textContent = 'Added to workspace';
      });
      actions.append(downloadPdf, add);
      output.append(actions);
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : String(error);
    } finally {
      build.disabled = entries.length === 0;
    }
  });

  window.addEventListener('pagehide', stopCamera, { once: true });
  studio.append(camera, pages, build, output);
  body.append(studio);
  renderPages();
}

async function runPreflightUi(
  file: File,
  body: HTMLElement,
  status: HTMLElement
): Promise<void> {
  const { runPreflight } = await import('../preflight/index.js');
  const report = await runPreflight(await bytesOf(file));
  status.textContent = `${report.issues.length} row(s). ISO claim: ${report.isoClaim}.`;
  body.append(el('p', 'sumi-ws__hedge', report.limitations[0] || ''));
  listFindings(
    body,
    report.issues.map((i) => ({
      title: `${i.level} — ${i.title}`,
      body: i.detail,
    }))
  );
}

async function runA11y(
  file: File,
  body: HTMLElement,
  status: HTMLElement
): Promise<void> {
  const { auditAccessibility, applySafeA11yFixes } =
    await import('../accessibility/index.js');
  const bytes = await bytesOf(file);
  const report = await auditAccessibility(bytes);
  status.textContent = `PDF/UA claim: ${report.pdfUaClaim}. WCAG claim: ${report.wcagClaim}.`;
  body.append(el('p', 'sumi-ws__hedge', report.limitations[0] || ''));
  listFindings(
    body,
    report.findings.map((f) => ({ title: f.title, body: f.detail }))
  );
  const title = el('input') as HTMLInputElement;
  title.placeholder = 'Set title';
  const lang = el('input') as HTMLInputElement;
  lang.placeholder = 'en';
  const fix = el('button', 'sumi-btn sumi-btn--signal', 'Apply safe fixes');
  fix.type = 'button';
  fix.addEventListener('click', async () => {
    const out = await applySafeA11yFixes(bytes, {
      title: title.value,
      lang: lang.value,
    });
    download(out, file.name.replace(/\.pdf$/i, '-a11y.pdf'), 'application/pdf');
  });
  body.append(title, lang, fix);
}

async function runWatch(body: HTMLElement, status: HTMLElement): Promise<void> {
  const {
    isWatchFolderAvailable,
    watchFolderDisclaimer,
    readWatchedFiles,
    diffWatched,
  } = await import('../watch-folder/index.js');
  status.textContent = watchFolderDisclaimer();
  body.append(el('p', 'sumi-ws__hedge', watchFolderDisclaimer()));
  const actions = el('div', 'sumi-flow__run');
  const choose = el('button', 'sumi-btn sumi-btn--signal', 'Choose folder');
  const refresh = el('button', 'sumi-btn', 'Refresh folder');
  choose.type = refresh.type = 'button';
  choose.disabled = !isWatchFolderAvailable();
  refresh.disabled = true;
  const results = el('div', 'sumi-studio__result');
  let handle: Parameters<typeof readWatchedFiles>[0] | null = null;
  let snapshot: Awaited<ReturnType<typeof readWatchedFiles>> = [];

  const showCurrent = (): void => {
    results.textContent = '';
    listFindings(
      results,
      snapshot.map((file) => ({
        title: file.name,
        body: `${(file.size / 1024).toFixed(1)} KB`,
        meta: `Last modified ${new Date(file.lastModified).toLocaleString()}`,
      }))
    );
  };

  choose.addEventListener('click', async () => {
    const picker = (
      window as unknown as {
        showDirectoryPicker?: () => Promise<
          Parameters<typeof readWatchedFiles>[0]
        >;
      }
    ).showDirectoryPicker;
    if (!picker) return;
    try {
      handle = await picker();
      snapshot = await readWatchedFiles(handle);
      refresh.disabled = false;
      status.textContent = `${snapshot.length} file(s) indexed. Sumi will not refresh in the background.`;
      showCurrent();
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : 'Folder selection cancelled.';
    }
  });
  refresh.addEventListener('click', async () => {
    if (!handle) return;
    const next = await readWatchedFiles(handle);
    const diff = diffWatched(snapshot, next);
    snapshot = next;
    results.textContent = '';
    status.textContent = `${diff.added.length} added · ${diff.removed.length} removed since the last refresh.`;
    if (diff.added.length || diff.removed.length) {
      listFindings(results, [
        ...diff.added.map((file) => ({
          title: `Added · ${file.name}`,
          body: `${(file.size / 1024).toFixed(1)} KB`,
        })),
        ...diff.removed.map((file) => ({
          title: `Removed · ${file.name}`,
          body: 'No action was taken.',
        })),
      ]);
    } else {
      results.append(el('p', 'sumi-ws__hedge', 'No changes detected.'));
    }
  });
  actions.append(choose, refresh);
  body.append(actions, results);
}
