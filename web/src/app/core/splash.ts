/** How long the fade-out takes (index.html), and how long to wait for it before the element goes anyway. */
const SAFETY_MS = 600;

/**
 * Takes the splash of index.html (the brand logo that shows while the bundle loads) off the screen: it fades out and the element is
 * removed when the fade has ended, or after a safety timeout when no transition event comes (a hidden tab, an engine without
 * transitions). With reduced motion it goes at once. Calling it again, or when there is no splash, does nothing.
 */
export function removeSplash(doc: Document): void {
  const splash = doc.getElementById('splash');
  if (!splash || splash.classList.contains('done')) return;
  const remove = () => splash.remove();
  if (doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    remove();
    return;
  }
  splash.classList.add('done');
  splash.addEventListener('transitionend', remove, { once: true });
  setTimeout(remove, SAFETY_MS);
}
