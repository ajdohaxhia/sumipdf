export const WATCH_FOLDER_EXPERIMENTAL = true;

export interface WatchedFile {
  name: string;
  lastModified: number;
  size: number;
}

export interface WatchDirectoryHandle {
  values(): AsyncIterableIterator<{
    kind: 'file' | 'directory';
    name: string;
    getFile?: () => Promise<File>;
  }>;
}

export async function readWatchedFiles(
  handle: WatchDirectoryHandle
): Promise<WatchedFile[]> {
  const files: WatchedFile[] = [];
  for await (const entry of handle.values()) {
    if (entry.kind !== 'file' || !entry.getFile) continue;
    const file = await entry.getFile();
    files.push({
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
    });
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}

export function diffWatched(
  previous: WatchedFile[],
  current: WatchedFile[]
): { added: WatchedFile[]; removed: WatchedFile[] } {
  const prev = new Map(
    previous.map((f) => [`${f.name}:${f.size}:${f.lastModified}`, f])
  );
  const next = new Map(
    current.map((f) => [`${f.name}:${f.size}:${f.lastModified}`, f])
  );
  const added = [...next.entries()]
    .filter(([key]) => !prev.has(key))
    .map(([, file]) => file);
  const removed = [...prev.entries()]
    .filter(([key]) => !next.has(key))
    .map(([, file]) => file);
  return { added, removed };
}

export function isWatchFolderAvailable(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export function watchFolderDisclaimer(): string {
  return 'Folder Import is experimental and opt-in. It reads the directory only when you choose or refresh it. This build does not run a background watcher or automated workflow.';
}
