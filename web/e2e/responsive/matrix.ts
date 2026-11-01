// The sizes the responsive audit looks at (see README.md). Chromium emulates the viewport, the device pixel ratio and touch; it is not Safari
// and not an Android WebView, so a clean run proves the layout, not the device.

export type Theme = 'light' | 'dark';
export const THEMES: Theme[] = ['light', 'dark'];

export interface Viewport {
  /** Stable name used in ids and file names, e.g. "phone-390x844". */
  name: string;
  kind: 'phone' | 'phone-landscape' | 'tablet' | 'tablet-landscape' | 'desktop';
  width: number;
  height: number;
  /** True when the page is also looked at with the text at 200% (the operating system's large-text setting). */
  zoom?: boolean;
}

const sizes = (kind: Viewport['kind'], list: [number, number][]): Viewport[] =>
  list.map(([width, height]) => ({ name: `${kind}-${width}x${height}`, kind, width, height }));

const BASE: Viewport[] = [
  ...sizes('phone', [[320, 568], [360, 640], [375, 667], [390, 844], [412, 915], [430, 932]]),
  ...sizes('phone-landscape', [[568, 320], [667, 375], [844, 390], [915, 412]]),
  ...sizes('tablet', [[600, 960], [744, 1133], [768, 1024], [810, 1080], [820, 1180], [834, 1194], [1024, 1366]]),
  ...sizes('tablet-landscape', [[960, 600], [1024, 768], [1080, 810], [1180, 820], [1194, 834], [1366, 1024]]),
  ...sizes('desktop', [[1280, 800], [1920, 1080]]),
];

/** The text-zoom variants: the same page with the root font at 200%. */
const ZOOMED = ['phone-390x844', 'tablet-768x1024'];

export const VIEWPORTS: Viewport[] = [
  ...BASE,
  ...BASE.filter((v) => ZOOMED.includes(v.name)).map((v) => ({ ...v, name: `${v.name}-zoom200`, zoom: true })),
];

/** Phones and tablets are touch devices with a mobile browser; the desktops are not. */
export const isTouch = (v: Viewport): boolean => v.kind !== 'desktop';
export const DEVICE_SCALE_FACTOR = 2;

/** Keeps the entries named by a comma separated list: a whole name, or else every name that contains the word ("390x844" gives the phone and its zoom variant). */
export function pick<T extends { name: string }>(all: T[], list: string | undefined): T[] {
  const wanted = (list ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (wanted.length === 0) return all;
  const chosen = all.filter((e) => wanted.some((w) => (all.some((x) => x.name === w) ? e.name === w : e.name.includes(w))));
  if (chosen.length === 0) throw new Error(`Nothing matches "${list}"; the choices are ${all.map((e) => e.name).join(', ')}`);
  return chosen;
}
