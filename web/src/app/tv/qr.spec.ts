import { qrMatrix, qrPath } from './qr';

describe('qr', () => {
  it('makes a square matrix with the three finder squares', () => {
    const m = qrMatrix('http://192.168.1.20:8080/code');
    const n = m.length;
    expect(n).toBeGreaterThanOrEqual(21);
    expect(m.every((row) => row.length === n)).toBe(true);
    for (const [r, c] of [
      [0, 0],
      [0, n - 1],
      [n - 1, 0],
    ]) {
      expect(m[r][c], `corner ${r},${c}`).toBe(true);
    }
    // inside a finder square the ring is light and the centre dark
    expect(m[1][1]).toBe(false);
    expect(m[3][3]).toBe(true);
  });

  it('is the same for the same text and different for another', () => {
    expect(qrMatrix('a')).toEqual(qrMatrix('a'));
    expect(qrMatrix('a')).not.toEqual(qrMatrix('b'));
  });

  it('draws one square per dark module', () => {
    const m = qrMatrix('hello');
    const dark = m.flat().filter(Boolean).length;
    const d = qrPath(m);
    expect(d.split('M').length - 1).toBe(dark);
    expect(d.startsWith('M0 0h1v1h-1z')).toBe(true); // the top-left module is always dark
  });
});
