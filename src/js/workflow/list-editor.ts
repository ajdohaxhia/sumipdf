import { nodeRegistry } from './nodes/registry';
import type { SerializedWorkflow } from './types';
import { preflightWorkflow, summarizeWorkflow } from './preflight';
import { escapeHtml } from '../utils/format';

export function isLinearPipeline(data: SerializedWorkflow): boolean {
  if (data.nodes.length === 0) return true;
  const outgoing = new Map<string, number>();
  const incoming = new Map<string, number>();
  for (const node of data.nodes) {
    outgoing.set(node.id, 0);
    incoming.set(node.id, 0);
  }
  for (const conn of data.connections) {
    outgoing.set(conn.source, (outgoing.get(conn.source) || 0) + 1);
    incoming.set(conn.target, (incoming.get(conn.target) || 0) + 1);
  }
  const starts = data.nodes.filter((node) => (incoming.get(node.id) || 0) === 0);
  const ends = data.nodes.filter((node) => (outgoing.get(node.id) || 0) === 0);
  if (starts.length !== 1 || ends.length !== 1) return false;
  return data.nodes.every((node) => {
    const out = outgoing.get(node.id) || 0;
    const inn = incoming.get(node.id) || 0;
    const isStart = inn === 0;
    const isEnd = out === 0;
    if (isStart) return out <= 1;
    if (isEnd) return inn <= 1;
    return out === 1 && inn === 1;
  });
}

function orderedIds(data: SerializedWorkflow): string[] {
  const incoming = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const node of data.nodes) {
    incoming.set(node.id, 0);
    adj.set(node.id, []);
  }
  for (const conn of data.connections) {
    adj.get(conn.source)?.push(conn.target);
    incoming.set(conn.target, (incoming.get(conn.target) || 0) + 1);
  }
  const queue = data.nodes.filter((node) => (incoming.get(node.id) || 0) === 0).map((n) => n.id);
  const ordered: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    ordered.push(id);
    for (const next of adj.get(id) || []) {
      const nextCount = (incoming.get(next) || 1) - 1;
      incoming.set(next, nextCount);
      if (nextCount === 0) queue.push(next);
    }
  }
  return ordered.length === data.nodes.length ? ordered : data.nodes.map((n) => n.id);
}

export function renderWorkflowList(
  host: HTMLElement,
  data: SerializedWorkflow,
  onMove?: (from: number, to: number) => void
): void {
  const issues = preflightWorkflow(data);
  const linear = isLinearPipeline(data);
  const order = orderedIds(data);
  const byId = new Map(data.nodes.map((node) => [node.id, node]));

  host.innerHTML = '';
  const summary = document.createElement('p');
  summary.className = 'sumi-workflow-list__summary';
  summary.textContent = summarizeWorkflow(data) || 'Empty workflow';
  host.appendChild(summary);

  if (!linear) {
    const note = document.createElement('p');
    note.className = 'sumi-workflow-list__note';
    note.textContent =
      'This recipe branches. Reorder in the visual canvas. The list below is read-only.';
    host.appendChild(note);
  }

  const list = document.createElement('ol');
  list.className = 'sumi-workflow-list__steps';
  order.forEach((id, index) => {
    const node = byId.get(id);
    if (!node) return;
    const meta = nodeRegistry[node.type];
    const item = document.createElement('li');
    const title = document.createElement('strong');
    title.textContent = meta?.label || node.type;
    const detail = document.createElement('span');
    const controlSummary = Object.entries(node.controls || {})
      .filter(([, value]) => value !== '' && value !== null && value !== undefined)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(' · ');
    detail.textContent = controlSummary || meta?.description || '';
    item.append(title, detail);
    if (linear && onMove) {
      const up = document.createElement('button');
      up.type = 'button';
      up.textContent = 'Move up';
      up.disabled = index === 0;
      up.addEventListener('click', () => onMove(index, index - 1));
      const down = document.createElement('button');
      down.type = 'button';
      down.textContent = 'Move down';
      down.disabled = index === order.length - 1;
      down.addEventListener('click', () => onMove(index, index + 1));
      item.append(up, down);
    }
    list.appendChild(item);
  });
  host.appendChild(list);

  if (issues.length) {
    const ul = document.createElement('ul');
    ul.className = 'sumi-workflow-list__issues';
    for (const issue of issues) {
      const li = document.createElement('li');
      li.dataset.level = issue.level;
      li.textContent = issue.message;
      ul.appendChild(li);
    }
    host.appendChild(ul);
  }
}

export function swapLinearSteps(
  data: SerializedWorkflow,
  from: number,
  to: number
): SerializedWorkflow {
  const order = orderedIds(data);
  if (to < 0 || to >= order.length) return data;
  const next = [...order];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  const byId = new Map(data.nodes.map((node) => [node.id, node]));
  const nodes = next.map((id, index) => {
    const node = byId.get(id)!;
    return { ...node, position: { x: 80 + index * 220, y: 120 } };
  });
  const connections = nodes.slice(0, -1).map((node, index) => ({
    id: `c${index}`,
    source: node.id,
    sourceOutput: 'pdf',
    target: nodes[index + 1].id,
    targetInput: 'pdf',
  }));
  return { ...data, nodes, connections };
}

export function listMarkupSafety(html: string): string {
  return escapeHtml(html);
}
