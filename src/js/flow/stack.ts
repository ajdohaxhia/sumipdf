import { getFlowOp } from './catalog';
import { stripSecretsFromParams } from './privacy';
import type { FlowDocument, FlowStep } from './types';

function newId(): string {
  return `step_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function cloneDoc(doc: FlowDocument): FlowDocument {
  return JSON.parse(JSON.stringify(doc)) as FlowDocument;
}

export function emptyFlow(name = 'Untitled flow'): FlowDocument {
  return { version: 1, name, steps: [] };
}

export function createStep(
  op: string,
  params?: Record<string, unknown>,
  notes?: string
): FlowStep {
  const def = getFlowOp(op);
  return {
    id: newId(),
    op,
    enabled: true,
    params: { ...(def?.defaultParams || {}), ...(params || {}) },
    notes,
  };
}

export class FlowStack {
  private current: FlowDocument;
  private past: FlowDocument[] = [];
  private future: FlowDocument[] = [];
  private listeners = new Set<() => void>();
  selectedId: string | null = null;

  constructor(initial?: FlowDocument) {
    this.current = initial ? cloneDoc(initial) : emptyFlow();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    this.listeners.forEach((fn) => fn());
  }

  private commit(next: FlowDocument): void {
    this.past.push(cloneDoc(this.current));
    if (this.past.length > 80) this.past.shift();
    this.current = next;
    this.future = [];
    this.emit();
  }

  get document(): FlowDocument {
    return this.current;
  }

  get steps(): FlowStep[] {
    return this.current.steps;
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  undo(): void {
    const prev = this.past.pop();
    if (!prev) return;
    this.future.push(cloneDoc(this.current));
    this.current = prev;
    this.emit();
  }

  redo(): void {
    const next = this.future.pop();
    if (!next) return;
    this.past.push(cloneDoc(this.current));
    this.current = next;
    this.emit();
  }

  setName(name: string): void {
    const next = cloneDoc(this.current);
    next.name = name.trim() || next.name;
    this.commit(next);
  }

  addStep(
    op: string,
    params?: Record<string, unknown>,
    notes?: string
  ): FlowStep {
    const step = createStep(op, params, notes);
    const next = cloneDoc(this.current);
    next.steps.push(step);
    this.selectedId = step.id;
    this.commit(next);
    return step;
  }

  duplicateStep(id: string): void {
    const index = this.current.steps.findIndex((s) => s.id === id);
    if (index < 0) return;
    const copy = cloneDoc({
      version: 1,
      name: '',
      steps: [this.current.steps[index]],
    }).steps[0];
    copy.id = newId();
    const next = cloneDoc(this.current);
    next.steps.splice(index + 1, 0, copy);
    this.selectedId = copy.id;
    this.commit(next);
  }

  removeStep(id: string): void {
    const next = cloneDoc(this.current);
    next.steps = next.steps.filter((s) => s.id !== id);
    if (this.selectedId === id) this.selectedId = next.steps[0]?.id ?? null;
    this.commit(next);
  }

  setEnabled(id: string, enabled: boolean): void {
    const next = cloneDoc(this.current);
    const step = next.steps.find((s) => s.id === id);
    if (!step) return;
    step.enabled = enabled;
    this.commit(next);
  }

  updateParams(id: string, params: Record<string, unknown>): void {
    const next = cloneDoc(this.current);
    const step = next.steps.find((s) => s.id === id);
    if (!step) return;
    step.params = { ...step.params, ...params };
    this.commit(next);
  }

  setScope(id: string, pages: number[] | undefined): void {
    const next = cloneDoc(this.current);
    const step = next.steps.find((s) => s.id === id);
    if (!step) return;
    step.scope = pages && pages.length ? { pages } : undefined;
    this.commit(next);
  }

  select(id: string | null): void {
    this.selectedId = id;
    this.emit();
  }

  move(from: number, to: number): void {
    if (to < 0 || to >= this.current.steps.length || from === to) return;
    const next = cloneDoc(this.current);
    const [item] = next.steps.splice(from, 1);
    next.steps.splice(to, 0, item);
    this.commit(next);
  }

  replace(doc: FlowDocument): void {
    this.commit(cloneDoc(doc));
  }

  toJSON(): FlowDocument {
    const doc = cloneDoc(this.current);
    for (const step of doc.steps) {
      step.params = stripSecretsFromParams(step.params);
    }
    return doc;
  }
}
