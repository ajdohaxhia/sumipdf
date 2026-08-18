import {
  addWorkspaceFile,
  getWorkspaceItem,
  listWorkspaceItems,
  subscribeWorkspace,
  type WorkspaceItem,
} from './session';
import { FlowStack } from '../flow/stack';
import { recipeById, recipeToFlow } from '../flow/recipes';
import type { DocumentMap, InspectFinding } from '../inspect/types';
import type { FlowExecution } from '../flow/types';
import type { ProofReport } from '../proof/types';

export type WorkspacePane = 'inspect' | 'flow' | 'preview' | 'proof';

type Listener = () => void;

class WorkspaceController {
  pane: WorkspacePane = 'inspect';
  activeId: string | null = null;
  inspectMap: DocumentMap | null = null;
  inspectStatus: 'idle' | 'running' | 'done' | 'cancelled' | 'error' = 'idle';
  inspectMessage = '';
  inspectAbort: AbortController | null = null;
  flow = new FlowStack();
  secrets: Record<string, string> = {};
  highlightedPages: number[] = [];
  selectedPages: number[] = [];
  previewBytes: Uint8Array | null = null;
  execution: FlowExecution | null = null;
  proof: ProofReport | null = null;
  lastError: string | null = null;
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    const unflow = this.flow.subscribe(() => this.emit());
    const unws = subscribeWorkspace(() => this.emit());
    return () => {
      this.listeners.delete(listener);
      unflow();
      unws();
    };
  }

  emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  items(): WorkspaceItem[] {
    return listWorkspaceItems();
  }

  active(): WorkspaceItem | undefined {
    if (this.activeId) return getWorkspaceItem(this.activeId);
    return this.items()[0];
  }

  setPane(pane: WorkspacePane): void {
    this.pane = pane;
    const hash = `#${pane}`;
    if (typeof history !== 'undefined' && location.hash !== hash) {
      try {
        history.replaceState(null, '', hash);
      } catch {
        /* ignore */
      }
    }
    this.emit();
  }

  setActive(id: string): void {
    if (this.activeId === id) return;
    this.cancelInspect();
    this.activeId = id;
    this.inspectMap = null;
    this.inspectStatus = 'idle';
    this.previewBytes = null;
    this.execution = null;
    this.proof = null;
    this.highlightedPages = [];
    this.emit();
  }

  addFiles(files: File[]): WorkspaceItem[] {
    const added: WorkspaceItem[] = [];
    for (const file of files) {
      const item = addWorkspaceFile(file, {
        name: file.name,
        mimeType: file.type,
        sourceToolId: 'workspace',
      });
      added.push(item);
    }
    if (added[0]) this.setActive(added[0].id);
    return added;
  }

  highlightPages(pages: number[]): void {
    this.highlightedPages = [...pages];
    this.emit();
  }

  toggleSelectedPage(page: number): void {
    if (this.selectedPages.includes(page)) {
      this.selectedPages = this.selectedPages.filter((n) => n !== page);
    } else {
      this.selectedPages = [...this.selectedPages, page].sort((a, b) => a - b);
    }
    this.emit();
  }

  acceptFinding(finding: InspectFinding): void {
    if (!finding.recommendedOp) return;
    const step = this.flow.addStep(
      finding.recommendedOp,
      finding.recommendedParams,
      finding.explanation
    );
    if (finding.pages.length) {
      this.flow.setScope(step.id, finding.pages);
      this.selectedPages = finding.pages;
    }
    this.highlightPages(finding.pages);
    this.setPane('flow');
  }

  loadRecipe(id: string): boolean {
    const recipe = recipeById(id);
    if (!recipe) return false;
    this.flow.replace(recipeToFlow(recipe));
    this.setPane('flow');
    return true;
  }

  cancelInspect(): void {
    this.inspectAbort?.abort();
    this.inspectAbort = null;
    if (this.inspectStatus === 'running') {
      this.inspectStatus = 'cancelled';
      this.inspectMessage = 'Inspect cancelled. Nothing was modified.';
    }
  }

  cleanup(): void {
    this.cancelInspect();
    this.previewBytes = null;
    this.execution = null;
    this.proof = null;
    this.secrets = {};
  }
}

export const workspaceController = new WorkspaceController();

export function paneFromLocation(): WorkspacePane {
  const hash = (typeof location !== 'undefined' ? location.hash : '').replace(
    '#',
    ''
  );
  if (
    hash === 'flow' ||
    hash === 'preview' ||
    hash === 'proof' ||
    hash === 'inspect'
  ) {
    return hash;
  }
  const pane = document.body?.dataset?.sumiPane;
  if (
    pane === 'flow' ||
    pane === 'preview' ||
    pane === 'proof' ||
    pane === 'inspect'
  ) {
    return pane;
  }
  return 'inspect';
}
