import { formatBytes } from '../utils/format';

const MEMORY_WARN_BYTES = 80 * 1024 * 1024;

export interface WorkspaceItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  pageCount?: number;
  blob: Blob;
  objectUrl: string;
  sourceToolId?: string;
  createdAt: number;
}

type Listener = () => void;

const items = new Map<string, WorkspaceItem>();
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

function newId(): string {
  return `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function subscribeWorkspace(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function listWorkspaceItems(): WorkspaceItem[] {
  return [...items.values()].sort((a, b) => b.createdAt - a.createdAt);
}

export function getWorkspaceItem(id: string): WorkspaceItem | undefined {
  return items.get(id);
}

export function workspaceBytes(): number {
  let total = 0;
  for (const item of items.values()) total += item.size;
  return total;
}

export function workspaceMemoryWarning(): string | null {
  const total = workspaceBytes();
  if (total < MEMORY_WARN_BYTES) return null;
  return `This session is holding ${formatBytes(total)} in memory. Clear the workspace if the browser feels slow.`;
}

export function addWorkspaceFile(
  file: Blob,
  options: {
    name: string;
    sourceToolId?: string;
    pageCount?: number;
    mimeType?: string;
  }
): WorkspaceItem {
  const item: WorkspaceItem = {
    id: newId(),
    name: options.name,
    mimeType: options.mimeType || file.type || 'application/pdf',
    size: file.size,
    pageCount: options.pageCount,
    blob: file,
    objectUrl: URL.createObjectURL(file),
    sourceToolId: options.sourceToolId,
    createdAt: Date.now(),
  };
  items.set(item.id, item);
  notify();
  return item;
}

export function renameWorkspaceItem(id: string, name: string): void {
  const item = items.get(id);
  if (!item) return;
  item.name = name.trim() || item.name;
  notify();
}

export function removeWorkspaceItem(id: string): void {
  const item = items.get(id);
  if (!item) return;
  URL.revokeObjectURL(item.objectUrl);
  items.delete(id);
  notify();
}

export function clearWorkspace(): void {
  for (const item of items.values()) {
    URL.revokeObjectURL(item.objectUrl);
  }
  items.clear();
  notify();
}

export function fileFromWorkspaceItem(item: WorkspaceItem): File {
  return new File([item.blob], item.name, { type: item.mimeType });
}

const RECENT_KEY = 'sumi:recent-tools';

export function recordRecentTool(toolId: string): void {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const ids: string[] = raw ? JSON.parse(raw) : [];
    const next = [toolId, ...ids.filter((id) => id !== toolId)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

export function getRecentToolIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
