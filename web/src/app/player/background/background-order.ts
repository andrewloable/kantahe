/**
 * The order in which the background videos play for one pass over the list. Without shuffle it is the order the server gave (the
 * loop order the administrator set). With shuffle it is a new random permutation, and it never starts with the video that played
 * last, so a pass boundary does not repeat a video when there is a choice.
 */
export function nextPass<T>(items: readonly T[], shuffle: boolean, last: T | undefined, random: () => number = Math.random): T[] {
  const pass = [...items];
  if (!shuffle || pass.length < 2) return pass;
  for (let i = pass.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1)); // Fisher-Yates
    [pass[i], pass[j]] = [pass[j], pass[i]];
  }
  if (pass[0] === last) {
    const j = 1 + Math.floor(random() * (pass.length - 1));
    [pass[0], pass[j]] = [pass[j], pass[0]];
  }
  return pass;
}
