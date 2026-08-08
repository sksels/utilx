// Pure password/UUID generation logic shared by tools/password-generator.html and
// tests/password.test.js. Randomness sources (crypto.getRandomValues output) are passed
// in as arguments rather than generated here, so the logic itself is deterministic and testable.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PasswordLib = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  function buildCharset(opts) {
    let charset = '';
    if (opts.upper) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (opts.lower) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (opts.numbers) charset += '0123456789';
    if (opts.symbols) charset += '!@#$%^&*()-_=+[]{};:,.<>?';
    if (opts.excludeAmbiguous) charset = charset.replace(/[l1IO0]/g, '');
    return charset;
  }

  // randomValues must be an array-like of length >= length, e.g. from
  // crypto.getRandomValues(new Uint32Array(length)).
  function pickFromCharset(charset, length, randomValues) {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset[randomValues[i] % charset.length];
    }
    return result;
  }

  function computeEntropy(charsetLength, length) {
    return Math.log2(charsetLength) * length;
  }

  function strengthLabel(entropy) {
    if (entropy >= 80) return 'Very strong';
    if (entropy >= 60) return 'Strong';
    if (entropy >= 40) return 'Moderate';
    return 'Weak';
  }

  // timestamp: integer ms since epoch (Number or BigInt).
  // randBytes: array-like of at least 10 random bytes (0-255 each).
  function generateUuidV7(timestamp, randBytes) {
    const ts = BigInt(timestamp);
    const bytes = new Uint8Array(16);
    bytes[0] = Number((ts >> 40n) & 0xffn);
    bytes[1] = Number((ts >> 32n) & 0xffn);
    bytes[2] = Number((ts >> 24n) & 0xffn);
    bytes[3] = Number((ts >> 16n) & 0xffn);
    bytes[4] = Number((ts >> 8n) & 0xffn);
    bytes[5] = Number(ts & 0xffn);
    bytes[6] = 0x70 | (randBytes[0] & 0x0f);   // version 7
    bytes[7] = randBytes[1];
    bytes[8] = 0x80 | (randBytes[2] & 0x3f);   // variant 10
    bytes[9] = randBytes[3];
    bytes[10] = randBytes[4];
    bytes[11] = randBytes[5];
    bytes[12] = randBytes[6];
    bytes[13] = randBytes[7];
    bytes[14] = randBytes[8];
    bytes[15] = randBytes[9];

    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return hex.slice(0,8) + '-' + hex.slice(8,12) + '-' + hex.slice(12,16) + '-' + hex.slice(16,20) + '-' + hex.slice(20,32);
  }

  const UUID_V7_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  return {
    buildCharset, pickFromCharset, computeEntropy, strengthLabel,
    generateUuidV7, UUID_V7_RE, UUID_V4_RE,
  };
});
