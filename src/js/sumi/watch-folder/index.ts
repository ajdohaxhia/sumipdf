export const WATCH_FOLDER_EXPERIMENTAL = true;

export interface WatchedFile {
  name: string;
  lastModified: number;
  size: number;
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
  return 'Watch Folder is experimental and opt-in. It uses the File System Access API in this browser only. Files stay on the device. It is off until you choose a folder.';
}
