/**
 * Industry icon kit — Lucide geometry at stroke-width 1.5, taken from
 * `design/icons.js`.
 *
 * All 35 are here rather than only those currently used. The set is a design
 * asset delivered once: it cannot be re-derived, the source directory is
 * untracked reference material that may not survive, and the whole map is a few
 * kilobytes. Trimming it would trade nothing for a dependency on that directory
 * still being there later.
 *
 * The kit expresses non-path shapes as raw SVG strings; they are structured here
 * so an icon renders through the template rather than through v-html.
 */

export interface IconCircle {
  cx: number
  cy: number
  r: number
}

export interface IconRect {
  x: number
  y: number
  width: number
  height: number
  rx?: number
}

export interface IconGeometry {
  paths: readonly string[]
  circles?: readonly IconCircle[]
  rects?: readonly IconRect[]
}

export const ICONS = {
  'arrow-left': { paths: ["m12 19-7-7 7-7","M19 12H5"] },
  'arrow-up-right': { paths: ["M7 7h10v10","M7 17 17 7"] },
  'banknote': { paths: ["M6 12h.01","M18 12h.01"], circles: [{"cx":12,"cy":12,"r":2}], rects: [{"width":20,"height":12,"x":2,"y":6,"rx":2}] },
  'bell': { paths: ["M10.268 21a2 2 0 0 0 3.464 0","M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"] },
  'building-2': { paths: ["M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z","M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2","M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2","M10 6h4","M10 10h4","M10 14h4","M10 18h4"] },
  'calendar': { paths: ["M8 2v4","M16 2v4","M3 10h18"], rects: [{"width":18,"height":18,"x":3,"y":4,"rx":2}] },
  'check': { paths: ["M20 6 9 17l-5-5"] },
  'chevron-down': { paths: ["m6 9 6 6 6-6"] },
  'chevron-right': { paths: ["m9 18 6-6-6-6"] },
  'circle-check': { paths: ["m9 12 2 2 4-4"], circles: [{"cx":12,"cy":12,"r":10}] },
  'circle-dollar-sign': { paths: ["M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8","M12 18V6"], circles: [{"cx":12,"cy":12,"r":10}] },
  'clock': { paths: ["M12 6v6l4 2"], circles: [{"cx":12,"cy":12,"r":10}] },
  'copy': { paths: ["M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"], rects: [{"width":14,"height":14,"x":8,"y":8,"rx":2}] },
  'credit-card': { paths: ["M2 10h20"], rects: [{"width":20,"height":14,"x":2,"y":5,"rx":2}] },
  'download': { paths: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4","m7 10 5 5 5-5","M12 15V3"] },
  'ellipsis': { paths: [], circles: [{"cx":12,"cy":12,"r":1},{"cx":19,"cy":12,"r":1},{"cx":5,"cy":12,"r":1}] },
  'eye': { paths: ["M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"], circles: [{"cx":12,"cy":12,"r":3}] },
  'file-text': { paths: ["M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z","M14 2v4a2 2 0 0 0 2 2h4","M16 13H8","M16 17H8","M10 9H8"] },
  'list-filter': { paths: ["M3 6h18","M7 12h10","M10 18h4"] },
  'mail': { paths: ["m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"], rects: [{"width":20,"height":16,"x":2,"y":4,"rx":2}] },
  'minus': { paths: ["M5 12h14"] },
  'pencil': { paths: ["M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z","m15 5 4 4"] },
  'percent': { paths: ["M19 5 5 19"], circles: [{"cx":6.5,"cy":6.5,"r":2.5},{"cx":17.5,"cy":17.5,"r":2.5}] },
  'plus': { paths: ["M5 12h14","M12 5v14"] },
  'printer': { paths: ["M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2","M6 9V3h12v6"], rects: [{"width":12,"height":8,"x":6,"y":14}] },
  'receipt': { paths: ["M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z","M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8","M12 17.5v-11"] },
  'repeat': { paths: ["m17 2 4 4-4 4","M3 11v-1a4 4 0 0 1 4-4h14","m7 22-4-4 4-4","M21 13v1a4 4 0 0 1-4 4H3"] },
  'search': { paths: ["m21 21-4.3-4.3"], circles: [{"cx":11,"cy":11,"r":8}] },
  'send': { paths: ["m22 2-7 20-4-9-9-4Z","M22 2 11 13"] },
  'settings-2': { paths: ["M20 7h-9","M14 17H5"], circles: [{"cx":17,"cy":17,"r":3},{"cx":7,"cy":7,"r":3}] },
  'trash-2': { paths: ["M3 6h18","M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6","M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2","M10 11v6","M14 11v6"] },
  'triangle-alert': { paths: ["m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3","M12 9v4","M12 17h.01"] },
  'upload': { paths: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4","m17 8-5-5-5 5","M12 3v12"] },
  'users': { paths: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2","M22 21v-2a4 4 0 0 0-3-3.87","M16 3.13a4 4 0 0 1 0 7.75"], circles: [{"cx":9,"cy":7,"r":4}] },
  'x': { paths: ["M18 6 6 18","m6 6 12 12"] },
} as const satisfies Record<string, IconGeometry>

export type IconName = keyof typeof ICONS
