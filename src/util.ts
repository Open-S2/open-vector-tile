import type { Point, Point3D } from "./vectorTile.spec";

/**
 * Encode a command with the given length of the data that follows.
 */
export function commandEncode(cmd: number, len: number): number {
  return (len << 3) + (cmd & 0x7);
}

/**
 * Decode a command with the given length of the data that follows.
 */
export function commandDecode(cmd: number): { cmd: number; len: number } {
  return { cmd: cmd & 0x7, len: cmd >> 3 };
}

/**
 * Perform zigzag encoding on the input number.
 */
export function zigzag(num: number): number {
  return (num << 1) ^ (num >> 31);
}

/**
 * Perform zigzag decoding on the input number.
 */
export function zagzig(num: number): number {
  return (num >> 1) ^ -(num & 1);
}

/**
 * Interweave two 16-bit numbers into a 32-bit number.
 * In theory two small numbers can end up varint encoded to use less space.
 */
export function weave2D(a: number, b: number): number {
  let result = 0;
  for (let i = 0; i < 16; i++) {
    result |= (a & 1) << (i * 2); // Take ith bit from `a` and put it at position 2*i
    result |= (b & 1) << (i * 2 + 1); // Take ith bit from `b` and put it at position 2*i+1
    // move to next bit
    a >>= 1;
    b >>= 1;
  }
  return result;
}

/**
 * Deweave a 32-bit number into two 16-bit numbers.
 */
export function unweave2D(num: number): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (let i = 0; i < 16; i++) {
    const bit = 1 << i;
    if (num & 1) a |= bit;
    if (num & 2) b |= bit;
    num >>= 2;
  }
  return { a, b };
}

/**
 * Interweave three 16-bit numbers into a 48-bit number.
 * In theory three small numbers can end up varint encoded to use less space.
 */
export function weave3D(a: number, b: number, c: number): number {
  // return result
  let result = BigInt(0);
  let bigA = BigInt(a);
  let bigB = BigInt(b);
  let bigC = BigInt(c);

  for (let i = 0; i < 16; i++) {
    if (bigA & 1n) result |= 1n << BigInt(i * 3); // Take ith bit from `a` and put it at position 3*i
    if (bigB & 1n) result |= 1n << BigInt(i * 3 + 1); // Take ith bit from `b` and put it at position 3*i+1
    if (bigC & 1n) result |= 1n << BigInt(i * 3 + 2); // Take ith bit from `c` and put it at position 3*i+2
    // Move to the next bit
    bigA >>= 1n;
    bigB >>= 1n;
    bigC >>= 1n;
  }

  return Number(result);
}

/**
 * Deweave a 48-bit number into three 16-bit numbers.
 */
export function unweave3D(num: number): { a: number; b: number; c: number } {
  // let bNum = BigInt(num)
  let a = 0;
  let b = 0;
  let c = 0;
  for (let i = 0; i < 16; i++) {
    const bit = 1 << i;
    if (num & 1) a |= bit;
    if (num & 2) b |= bit;
    if (num & 4) c |= bit;
    // num >>= 3 <-- we cant do this for numbers > 32 bits in javascript
    for (let j = 0; j < 3; j++) {
      num /= 2;
    }
  }
  return { a, b, c };
}

/**
 * Encode an array of points using interweaving and delta encoding
 */
export function weaveAndDeltaEncodeArray(array: Point[]): number[] {
  const res: number[] = [];

  let prevX = 0;
  let prevY = 0;
  for (let i = 0; i < array.length; i++) {
    const { x, y } = array[i];
    const posX = zigzag(x - prevX);
    const posY = zigzag(y - prevY);
    res.push(weave2D(posX, posY));
    prevX = x;
    prevY = y;
  }

  return res;
}

/**
 * Decode an array of points that were encoded using interweaving and delta encoding
 */
export function unweaveAndDeltaDecodeArray(array: number[]): Point[] {
  const res: Point[] = [];

  let prevX = 0;
  let prevY = 0;
  for (let i = 0; i < array.length; i++) {
    const { a, b } = unweave2D(array[i]);
    const x = zagzig(a) + prevX;
    const y = zagzig(b) + prevY;
    res.push({ x, y });
    prevX = x;
    prevY = y;
  }

  return res;
}

/**
 * Encode an array of 3D points using interweaving and delta encoding
 */
export function weaveAndDeltaEncode3DArray(array: Point3D[]): number[] {
  const res: number[] = [];

  let offsetX = 0;
  let offsetY = 0;
  let offsetZ = 0;
  for (let i = 0; i < array.length; i++) {
    const { x, y, z } = array[i];
    const posX = zigzag(x - offsetX);
    const posY = zigzag(y - offsetY);
    const posZ = zigzag(z - offsetZ);
    res.push(weave3D(posX, posY, posZ));
    offsetX = x;
    offsetY = y;
    offsetZ = z;
  }

  return res;
}

/**
 * Decode an array of 3D points that were encoded using interweaving and delta encoding
 */
export function unweaveAndDeltaDecode3DArray(array: number[]): Point3D[] {
  const res: Point3D[] = [];

  let offsetX = 0;
  let offsetY = 0;
  let offsetZ = 0;
  for (let i = 0; i < array.length; i++) {
    const { a, b, c } = unweave3D(array[i]);
    const x = zagzig(a) + offsetX;
    const y = zagzig(b) + offsetY;
    const z = zagzig(c) + offsetZ;
    res.push({ x, y, z });
    offsetX = x;
    offsetY = y;
    offsetZ = z;
  }

  return res;
}

/**
 * Encode an array using delta encoding
 */
export function deltaEncodeArray(array: number[]): number[] {
  const res: number[] = [];

  let offset = 0;
  for (let i = 0; i < array.length; i++) {
    const num = array[i];
    res.push(zigzag(num - offset));
    offset = num;
  }

  return res;
}

/**
 * Decode an array that was encoded using delta encoding
 */
export function deltaDecodeArray(array: number[]): number[] {
  const res: number[] = [];

  let offset = 0;
  for (let i = 0; i < array.length; i++) {
    const num = zagzig(array[i]) + offset;
    res.push(num);
    offset = num;
  }

  return res;
}
