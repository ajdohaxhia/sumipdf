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
  onFiles: (files: File[]) => void
): void {
  const input = zone.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement | null;
  if (input) input.accept = accept;
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
    lead: 'Photograph or import pages, straighten, and build a PDF here.',
    hedge: 'The camera starts only after you click. Nothing is uploaded.',
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
    title: 'Watch Folder',
    lead: 'Experimental opt-in folder watch using the File System Access API.',
    hedge: 'Off until you choose a folder. Files stay on this device.',
  },
};

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
  const drop = el('div', 'sumi-drop');
  drop.setAttribute('role', 'button');
  drop.tabIndex = 0;
  drop.append(
    el('strong', undefined, 'Choose a file'),
    el('p', undefined, 'Stays in this tab. Engines load after you pick a file.')
  );
  const input = el('input') as HTMLInputElement;
  input.type = 'file';
  input.id = 'original-file';
  drop.append(input);
  const status = el('p', 'sumi-ws__status', '');
  status.dataset.testid = 'original-status';
  const body = el('div', 'sumi-original__body');
  body.dataset.testid = 'original-body';
  shell.append(head, drop, status, body);
  root.append(shell);

  const accept =
    toolId === 'batch-forms'
      ? 'application/pdf,.csv,.xlsx,.xls,.json'
      : toolId === 'capture'
        ? 'image/*,application/pdf'
        : toolId === 'proof-verifier'
          ? 'application/pdf,application/json'
          : 'application/pdf';
  mountDrop(drop, accept, (files) => {
    void runTool(toolId, files, body, status);
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
    void runTool(toolId, [file], body, status);
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
    const cover = el('button', 'sumi-btn', 'Visual cover selected');
    cover.type = 'button';
    const redact = el(
      'button',
      'sumi-btn sumi-btn--signal',
      'True-redact selected'
    );
    redact.type = 'button';
    const apply = async (mode: 'true' | 'cover') => {
      const hits = hitsForSelection(result.hits, [...selected], excluded);
      const out = await applyPrivacyRedaction(bytes, { hits, mode });
      addWorkspaceFile(
        new Blob([new Uint8Array(out.bytes)], { type: 'application/pdf' }),
        {
          name: file.name.replace(/\.pdf$/i, `-${mode}.pdf`),
          sourceToolId: 'privacy-finder',
        }
      );
      download(
        out.bytes,
        file.name.replace(/\.pdf$/i, `-${mode}.pdf`),
        'application/pdf'
      );
      status.textContent = out.notes.join(' ');
    };
    cover.addEventListener('click', () => void apply('cover'));
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
  const mapping = fields
    .filter((f) => f.type !== 'signature')
    .map((f) => ({
      field: f.name,
      column:
        Object.keys(rows[0] || {}).find(
          (k) => k.toLowerCase() === f.name.toLowerCase()
        ) || f.name,
      transform: 'trim' as const,
    }));
  const result = await fillBatch(templateBytes, rows, {
    mapping,
    flatten: true,
    skipInvalid: true,
    filenameTemplate: '{original}-{counter}.pdf',
  });
  status.textContent = `${result.files.length} PDF(s), ${result.skipped.length} skipped.`;
  body.append(el('p', 'sumi-ws__hedge', result.notes.join(' ')));
  const zip = await zipBatch(result);
  const btn = el('button', 'sumi-btn sumi-btn--signal', 'Download ZIP');
  btn.type = 'button';
  btn.addEventListener('click', () =>
    download(zip, 'batch-forms.zip', 'application/zip')
  );
  body.append(btn);
}

async function runPacket(
  files: File[],
  body: HTMLElement,
  status: HTMLElement
): Promise<void> {
  const { PACKET_TEMPLATES, buildPacket } =
    await import('../packet-builder/index.js');
  const tmpl = PACKET_TEMPLATES[0];
  const slots = tmpl.slots.map((slot, i) => ({
    ...slot,
    fileName: files[i]?.name,
    bytes: undefined as Uint8Array | undefined,
  }));
  for (let i = 0; i < Math.min(files.length, slots.length); i++) {
    slots[i].bytes = await bytesOf(files[i]);
    slots[i].fileName = files[i].name;
  }
  const built = await buildPacket(slots, {
    normalize: true,
    compress: false,
    coverTitle: tmpl.name,
    separators: true,
    bookmarks: true,
    toc: false,
    pageNumbers: true,
    cleanMetadata: true,
  });
  status.textContent = built.warnings.map((w) => w.message).join(' ');
  addWorkspaceFile(
    new Blob([new Uint8Array(built.bytes)], { type: 'application/pdf' }),
    {
      name: 'packet.pdf',
      sourceToolId: 'packet-builder',
    }
  );
  const stack = new FlowStack();
  stack.addStep('remove-metadata');
  const execution = await executeFlow(stack.document, {
    bytes: built.bytes,
    fileName: 'packet.pdf',
  });
  const proof = await buildProofReport({ execution });
  const dl = el(
    'button',
    'sumi-btn sumi-btn--signal',
    'Download packet + Proof JSON'
  );
  dl.type = 'button';
  dl.addEventListener('click', () => {
    download(built.bytes, 'packet.pdf', 'application/pdf');
    download(
      new TextEncoder().encode(proofReportToJson(proof)),
      'packet-proof.json',
      'application/json'
    );
  });
  body.append(el('p', 'sumi-ws__hedge', tmpl.summary), dl);
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

async function runCapture(
  files: File[],
  body: HTMLElement,
  status: HTMLElement
): Promise<void> {
  const { imagesToPdf, cameraConstraints } =
    await import('../capture/index.js');
  status.textContent =
    'Import images or start the camera after you click. Nothing is uploaded.';
  const start = el('button', 'sumi-btn', 'Start camera');
  start.type = 'button';
  start.addEventListener('click', async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      status.textContent = 'Camera API missing. Use image import.';
      return;
    }
    const stream =
      await navigator.mediaDevices.getUserMedia(cameraConstraints());
    stream.getTracks().forEach((t) => t.stop());
    status.textContent =
      'Camera permission worked. Capture frames in a later pass; import is the reliable path.';
  });
  const images = files.filter((f) => f.type.startsWith('image/'));
  if (images.length) {
    const pngs: Uint8Array[] = [];
    for (const image of images) pngs.push(await bytesOf(image));
    try {
      const pdf = await imagesToPdf(pngs.map((png) => ({ png })));
      download(pdf, 'capture.pdf', 'application/pdf');
      addWorkspaceFile(
        new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }),
        {
          name: 'capture.pdf',
          sourceToolId: 'capture',
        }
      );
      status.textContent = 'Imported images into a local PDF.';
    } catch {
      status.textContent =
        'Import needs PNG bytes in this build. Convert photos to PNG or use Images to PDF.';
    }
  }
  body.append(start);
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
  const { isWatchFolderAvailable, watchFolderDisclaimer } =
    await import('../watch-folder/index.js');
  status.textContent = watchFolderDisclaimer();
  const btn = el('button', 'sumi-btn', 'Choose folder (opt-in)');
  btn.type = 'button';
  btn.disabled = !isWatchFolderAvailable();
  btn.addEventListener('click', async () => {
    const picker = (
      window as unknown as {
        showDirectoryPicker?: () => Promise<FileSystemDirectoryHandle>;
      }
    ).showDirectoryPicker;
    if (!picker) return;
    await picker();
    status.textContent =
      'Folder selected in this session. Polling stays experimental and local.';
  });
  body.append(btn);
}
