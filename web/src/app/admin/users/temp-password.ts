/** No 0, O, 1, l or I: a password read out or typed in from paper is not mistaken. */
export const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

type FillRandom = (bytes: Uint8Array<ArrayBuffer>) => Uint8Array<ArrayBuffer>;

/**
 * A temporary password of random characters from the browser's cryptographic generator. Values that
 * would make some characters likelier than others (the remainder of 256 / alphabet size) are skipped.
 */
export function generateTempPassword(length = 12, fill: FillRandom = (b) => crypto.getRandomValues(b)): string {
  const n = TEMP_PASSWORD_ALPHABET.length;
  const limit = 256 - (256 % n);
  let out = '';
  while (out.length < length) {
    for (const byte of fill(new Uint8Array(length * 2))) {
      if (byte < limit) out += TEMP_PASSWORD_ALPHABET[byte % n];
      if (out.length === length) break;
    }
  }
  return out;
}
