export function parsePageRange(rangeStr: string, totalPages: number): number[] {
  const indices = new Set<number>();
  const parts = rangeStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = Math.max(1, parseInt(startStr, 10) || 1);
      const end = Math.min(totalPages, parseInt(endStr, 10) || totalPages);
      for (let i = start; i <= end; i++) indices.add(i - 1);
    } else {
      const page = parseInt(part, 10);
      if (page >= 1 && page <= totalPages) indices.add(page - 1);
    }
  }
  return Array.from(indices).sort((a, b) => a - b);
}

export function parseDeletePages(str: string, totalPages: number): Set<number> {
  const pages = new Set<number>();
  const parts = str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = Math.max(1, parseInt(startStr, 10) || 1);
      const end = Math.min(totalPages, parseInt(endStr, 10) || totalPages);
      for (let i = start; i <= end; i++) pages.add(i);
    } else {
      const page = parseInt(part, 10);
      if (page >= 1 && page <= totalPages) pages.add(page);
    }
  }
  return pages;
}
