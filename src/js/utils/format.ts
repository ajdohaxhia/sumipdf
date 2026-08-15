export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / k ** i).toFixed(dm)) + ' ' + sizes[i];
}

export function formatStars(num: number): string {
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return String(num);
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatShortcutDisplay(
  shortcut: string,
  isMac: boolean
): string {
  return shortcut
    .replace(/mod/g, isMac ? '⌘' : 'Ctrl')
    .replace(/shift/g, isMac ? '⇧' : 'Shift')
    .replace(/alt/g, isMac ? '⌥' : 'Alt')
    .replace(/\+/g, isMac ? '' : '+');
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16) / 255,
        g: parseInt(result[2], 16) / 255,
        b: parseInt(result[3], 16) / 255,
      }
    : { r: 0, g: 0, b: 0 };
}

export function truncateFilename(filename: string, maxLength = 32): string {
  if (filename.length <= maxLength) return filename;
  const extIndex = filename.lastIndexOf('.');
  const ext = extIndex > 0 ? filename.slice(extIndex) : '';
  const keep = maxLength - ext.length - 1;
  return filename.slice(0, Math.max(keep, 1)) + '…' + ext;
}
