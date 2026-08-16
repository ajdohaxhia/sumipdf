import {
  addWorkspaceFile,
  fileFromWorkspaceItem,
  listWorkspaceItems,
} from '../workspace/session';
import { t } from '../i18n/i18n';

export interface FileSuggestion {
  id: string;
  href: string;
  label: string;
  reason: string;
}

function isPdf(file: File): boolean {
  return (
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  );
}

function isImage(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(png|jpe?g|webp|gif|bmp|tif{1,2}|heic|heif|svg)$/i.test(file.name);
}

export function suggestToolsForFiles(files: File[]): FileSuggestion[] {
  const pdfs = files.filter(isPdf);
  const images = files.filter(isImage);

  if (pdfs.length >= 2) {
    return [
      {
        id: 'merge-pdf',
        href: 'merge-pdf.html',
        label: t('tools:mergePdf.name') || 'Merge PDF',
        reason:
          t('suggest.multiplePdfs') ||
          'Several PDFs — merge them or run a workflow.',
      },
      {
        id: 'pdf-workflow',
        href: 'pdf-workflow.html',
        label: t('tools:pdfWorkflow.name') || 'Workflow Builder',
        reason:
          t('suggest.workflow') ||
          'Chain several steps without re-selecting files.',
      },
    ];
  }

  if (pdfs.length === 1 && images.length === 0) {
    return [
      {
        id: 'organize-pdf',
        href: 'organize-pdf.html',
        label: t('tools:duplicateOrganize.name') || 'Organize',
        reason:
          t('suggest.onePdfOrganize') || 'Reorder, rotate, or remove pages.',
      },
      {
        id: 'compress-pdf',
        href: 'compress-pdf.html',
        label: t('tools:compressPdf.name') || 'Compress',
        reason: t('suggest.onePdfCompress') || 'Reduce size before sending.',
      },
      {
        id: 'sign-pdf',
        href: 'sign-pdf.html',
        label: t('tools:signPdf.name') || 'Sign',
        reason: t('suggest.onePdfSign') || 'Add a visual signature.',
      },
      {
        id: 'sanitize-pdf',
        href: 'sanitize-pdf.html',
        label: t('tools:sanitizePdf.name') || 'Privacy Clean',
        reason:
          t('suggest.onePdfSanitize') || 'Inspect and remove hidden data.',
      },
    ];
  }

  if (images.length > 0 && pdfs.length === 0) {
    return [
      {
        id: 'image-to-pdf',
        href: 'image-to-pdf.html',
        label: t('tools:imagesToPdf.name') || 'Images to PDF',
        reason: t('suggest.images') || 'Combine images into a single PDF.',
      },
    ];
  }

  return [];
}

export function stashFilesForTool(files: File[], toolId: string): string {
  const ids: string[] = [];
  for (const file of files) {
    const item = addWorkspaceFile(file, {
      name: file.name,
      sourceToolId: 'home',
      mimeType: file.type,
    });
    ids.push(item.id);
  }
  sessionStorage.setItem(
    'sumi:handoff',
    JSON.stringify({ toolId, itemIds: ids })
  );
  return ids[0];
}

export function peekHandoff(toolId: string): File[] {
  try {
    const raw = sessionStorage.getItem('sumi:handoff');
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { toolId: string; itemIds: string[] };
    if (parsed.toolId !== toolId) return [];
    return parsed.itemIds
      .map((id) => listWorkspaceItems().find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .map(fileFromWorkspaceItem);
  } catch {
    return [];
  }
}

export function consumeHandoff(toolId: string): File[] {
  const files = peekHandoff(toolId);
  if (files.length > 0) {
    sessionStorage.removeItem('sumi:handoff');
  }
  return files;
}

export function initHomeDrop(): void {
  void import('./workspace-app.js').then((mod) => {
    mod.initWorkspaceEntrance();
  });

  document.querySelectorAll('a[href*="workspace.html"]').forEach((anchor) => {
    anchor.addEventListener('click', (event) => {
      if (listWorkspaceItems().length === 0) return;
      event.preventDefault();
      const url = new URL(
        (anchor as HTMLAnchorElement).href,
        window.location.href
      );
      const pane = (url.hash.replace('#', '') || 'inspect') as
        | 'inspect'
        | 'flow'
        | 'preview'
        | 'proof';
      void import('./workspace-app.js').then((mod) =>
        mod.mountWorkspaceApp({ pane })
      );
    });
  });
}
