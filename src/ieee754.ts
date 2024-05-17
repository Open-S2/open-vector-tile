/**
 * Read the IEEE 754 double-precision floating-point number from a byte array
 * @param buffer - u8 byte array to read from
 * @param offset - offset into the byte array
 * @param isLE - endianness
 * @param mLen - mantissa length
 * @param nBytes - number of bytes
 * @returns - the parsed double size number
 */
export function read(
  buffer: Uint8Array,
  offset: number,
  isLE: boolean,
  mLen: number,
  nBytes: number,
): number {
  const { pow } = Math;
  let e: number;
  let m: number;
  const eLen = nBytes * 8 - mLen - 1;
  const eMax = (1 << eLen) - 1;
  const eBias = eMax >> 1;
  let nBits = -7;
  let i = isLE ? nBytes - 1 : 0;
  const d = isLE ? -1 : 1;
  let s = buffer[offset + i];

  i += d;

  e = s & ((1 << -nBits) - 1);
  s >>= -nBits;
  nBits += eLen;
  while (nBits > 0) {
    e = e * 256 + buffer[offset + i];
    i += d;
    nBits -= 8;
  }

  m = e & ((1 << -nBits) - 1);
  e >>= -nBits;
  nBits += mLen;
  while (nBits > 0) {
    m = m * 256 + buffer[offset + i];
    i += d;
    nBits -= 8;
  }

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m === undefined ? NaN : (s !== 0 ? -1 : 1) * Infinity;
  } else {
    m = m + pow(2, mLen);
    e = e - eBias;
  }
  return (s !== 0 ? -1 : 1) * m * pow(2, e - mLen);
}

/**
 * Write the IEEE 754 double-precision floating-point number to a byte array
 * @param buffer - u8 byte array to write to
 * @param value - the parsed double size number
 * @param offset - offset into the byte array
 * @param isLE - endianness
 * @param mLen - mantissa length
 * @param nBytes - number of bytes
 */
export function write(
  buffer: Uint8Array,
  value: number,
  offset: number,
  isLE: boolean,
  mLen: number,
  nBytes: number,
): void {
  const { pow } = Math;
  let e, m, c;
  let eLen = nBytes * 8 - mLen - 1;
  const eMax = (1 << eLen) - 1;
  const eBias = eMax >> 1;
  const rt = mLen === 23 ? pow(2, -24) - pow(2, -77) : 0;
  let i = isLE ? 0 : nBytes - 1;
  const d = isLE ? 1 : -1;
  const s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * pow(2, eBias - 1) * pow(2, mLen);
      e = 0;
    }
  }

  while (mLen >= 8) {
    buffer[offset + i] = m & 0xff;
    i += d;
    m /= 256;
    mLen -= 8;
  }

  e = (e << mLen) | m;
  eLen += mLen;
  while (eLen > 0) {
    buffer[offset + i] = e & 0xff;
    i += d;
    e /= 256;
    eLen -= 8;
  }

  buffer[offset + i - d] |= s * 128;
}
