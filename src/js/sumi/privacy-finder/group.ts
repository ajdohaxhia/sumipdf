import type { PrivacyGroup, PrivacyHit } from './types';

export function groupHits(hits: PrivacyHit[]): PrivacyGroup[] {
  const map = new Map<string, PrivacyGroup>();
  for (const hit of hits) {
    const key = `${hit.kind}|${hit.value.toLowerCase()}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        kind: hit.kind,
        value: hit.value,
        count: 1,
        pages: [hit.page],
        confidence: hit.confidence,
        hitIds: [hit.id],
      });
      continue;
    }
    existing.count += 1;
    if (!existing.pages.includes(hit.page)) existing.pages.push(hit.page);
    existing.hitIds.push(hit.id);
    if (hit.confidence === 'high') existing.confidence = 'high';
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.kind.localeCompare(b.kind)
  );
}

export function hitsForSelection(
  hits: PrivacyHit[],
  selectedIds: string[],
  excludedValues: string[] = []
): PrivacyHit[] {
  const selected = new Set(selectedIds);
  const excluded = new Set(excludedValues.map((v) => v.toLowerCase()));
  return hits.filter(
    (hit) => selected.has(hit.id) && !excluded.has(hit.value.toLowerCase())
  );
}
