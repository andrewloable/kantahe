import qrcode from 'qrcode-generator';

/** The modules of the QR code of a text, row by row; true is dark. */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M'); // the smallest size that holds the text, with medium error correction
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** One SVG path that draws every dark module as a unit square; the view box is the matrix size. */
export function qrPath(matrix: boolean[][]): string {
  let d = '';
  matrix.forEach((row, r) => row.forEach((dark, c) => (d += dark ? `M${c} ${r}h1v1h-1z` : '')));
  return d;
}
