import { generateTempPassword, TEMP_PASSWORD_ALPHABET } from './temp-password';

describe('generateTempPassword', () => {
  it('is 12 characters from the alphabet, which has no look-alikes', () => {
    for (let i = 0; i < 200; i++) {
      const p = generateTempPassword();
      expect(p).toHaveLength(12);
      expect([...p].every((c) => TEMP_PASSWORD_ALPHABET.includes(c))).toBe(true);
    }
    for (const bad of '0O1lI') expect(TEMP_PASSWORD_ALPHABET).not.toContain(bad);
  });

  it('is different every time', () => {
    const seen = new Set(Array.from({ length: 100 }, () => generateTempPassword()));
    expect(seen.size).toBe(100);
  });

  it('is long enough for the server (8 to 256 bytes)', () => {
    expect(new TextEncoder().encode(generateTempPassword()).length).toBeGreaterThanOrEqual(8);
  });

  it('uses the random source it is given and throws away values that would favour some characters', () => {
    const n = TEMP_PASSWORD_ALPHABET.length;
    const limit = 256 - (256 % n); // values from here up are not used
    let calls = 0;
    const source = (bytes: Uint8Array<ArrayBuffer>) => {
      calls++;
      // the first request is all too high to be used; the second counts 0, 1, 2 ...
      for (let i = 0; i < bytes.length; i++) bytes[i] = calls === 1 ? limit + (i % (256 - limit)) : i % n;
      return bytes;
    };
    const p = generateTempPassword(12, source);
    expect(calls).toBe(2);
    expect(p).toBe(TEMP_PASSWORD_ALPHABET.slice(0, 12));
  });

  it('can make other lengths', () => {
    expect(generateTempPassword(20)).toHaveLength(20);
  });
});
