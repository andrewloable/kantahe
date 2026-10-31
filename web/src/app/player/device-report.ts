/** The memory of this device in MB, or 0 when the browser does not tell (navigator.deviceMemory is in GB). */
export function deviceMemoryMb(nav: Navigator = navigator): number {
  const gb = (nav as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof gb === 'number' && Number.isFinite(gb) && gb > 0 ? Math.round(gb * 1024) : 0;
}
