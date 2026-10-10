/**
 * Where a panel sits: floating over the map, not beside it, so opening one
 * never shrinks or shifts the map. Top right beside the zoom buttons on a
 * wide map; a sheet along the bottom of a narrow one. It scrolls inside
 * itself when it is taller than the map.
 */
export const FLOATING_PANEL =
  "absolute z-20 flex flex-col overflow-y-auto overscroll-contain rounded-xl border border-hairline bg-canvas shadow-overlay inset-x-3 bottom-3 max-h-[62%] @[720px]:inset-x-auto @[720px]:bottom-auto @[720px]:right-14 @[720px]:top-3 @[720px]:w-[348px] @[720px]:max-h-[calc(100%-1.5rem)]";
