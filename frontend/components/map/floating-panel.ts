/**
 * Where a panel sits: floating over the map, not beside it, so opening one
 * never shrinks or shifts the map. Top left under the search box on a wide
 * map, because Malaysia lies along the region's east edge (Sabah ends 0.7
 * degrees from it) and a place there could never be moved out from under a
 * panel on the right. A sheet along the bottom of a narrow map. It scrolls
 * inside itself when it is taller than the space it has.
 */
export const FLOATING_PANEL =
  "absolute z-20 flex flex-col overflow-y-auto overscroll-contain rounded-xl border border-hairline bg-canvas shadow-overlay inset-x-3 bottom-3 max-h-[62%] @[720px]:inset-x-auto @[720px]:bottom-auto @[720px]:left-3 @[720px]:top-16 @[720px]:w-[348px] @[720px]:max-h-[calc(100%-8.5rem)]";

/** What the panel covers, so a glide can put its place in the middle of what is left. Matches the classes above. */
export function panelInset(size: { width: number; height: number }): { left: number; bottom: number } {
  return size.width >= 720 ? { left: 12 + 348, bottom: 0 } : { left: 0, bottom: Math.round(size.height * 0.62) + 12 };
}
