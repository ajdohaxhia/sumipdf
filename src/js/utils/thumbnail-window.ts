/** First-pass thumbnail window for merge/organize previews. */
export function initialThumbnailRenderCount(
  totalPages: number,
  useLazyLoading = true
): number {
  if (!useLazyLoading) return totalPages;
  return Math.min(20, totalPages);
}
