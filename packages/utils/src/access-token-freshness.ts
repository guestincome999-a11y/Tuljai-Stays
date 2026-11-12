/** Scheduling hint only: protected APIs still verify signatures and session validity. */
export function isAccessTokenFresh(token: string | undefined, now = Date.now()): boolean {
  if (!token) return false;
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return false;
    if (!/^[\w-]+={0,2}$/.test(parts[1])) return false;
    const payload = parts[1].replace(/=+$/, '');
    if (payload.length > 16_384 || payload.length % 4 === 1 || !/^[\w-]+$/.test(payload)) return false;
    // JWT claim names/expiry are ASCII. Decode without Node Buffer or browser-only globals.
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let bits = 0;
    let bitCount = 0;
    let decoded = '';
    for (const character of payload) {
      bits = (bits << 6) | alphabet.indexOf(character);
      bitCount += 6;
      if (bitCount >= 8) {
        bitCount -= 8;
        decoded += String.fromCharCode((bits >> bitCount) & 255);
        bits &= (1 << bitCount) - 1;
      }
    }
    const { exp } = JSON.parse(decoded) as { exp?: unknown };
    return typeof exp === 'number' && Number.isFinite(exp) && exp * 1000 > now + 60_000;
  } catch {
    return false;
  }
}
