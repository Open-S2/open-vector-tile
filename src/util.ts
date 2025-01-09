import type { BBOX, BBox, BBox3D, Point, Point3D } from './vectorTile.spec';

/**
 * Encode a command with the given length of the data that follows.
 * @param cmd - the command
 * @param len - the length
 * @returns - the encoded command and length into a single number
 */
export function commandEncode(cmd: number, len: number): number {
  return (len << 3) + (cmd & 0x7);
}

/** Object shape for a command and its length */
export interface Command {
  /** The command */
  cmd: number;
  /** The length */
  len: number;
}

/**
 * Decode a command with the given length of the data that follows.
 * @param cmd - the encoded command
 * @returns - the command and length
 */
export function commandDecode(cmd: number): Command {
  return { cmd: cmd & 0x7, len: cmd >> 3 };
}

/**
 * Perform zigzag encoding on the input number.
 * @param num - the input
 * @returns - the incoded unsigned output
 */
export function zigzag(num: number): number {
  return (num << 1) ^ (num >> 31);
}

/**
 * Perform zigzag decoding on the input number.
 * @param num - the input
 * @returns - the decoded signed output
 */
export function zagzig(num: number): number {
  return (num >> 1) ^ -(num & 1);
}

/**
 * Interweave two 16-bit numbers into a 32-bit number.
 * In theory two small numbers can end up varint encoded to use less space.
 * @param a - the first number
 * @param b - the second number
 * @returns - the interwoven number
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

/** Object shape for two 16-bit numbers */
export interface Weave2D {
  a: number;
  b: number;
}

/**
 * Deweave a 32-bit number into two 16-bit numbers.
 * @param num - the input
 * @returns - the two numbers
 */
export function unweave2D(num: number): Weave2D {
  let a = 0;
  let b = 0;
  for (let i = 0; i < 16; i++) {
    const bit = 1 << i;
    if ((num & 1) > 0) a |= bit;
    if ((num & 2) > 0) b |= bit;
    num >>= 2;
  }
  return { a, b };
}

/**
 * Interweave three 16-bit numbers into a 48-bit number.
 * In theory three small numbers can end up varint encoded to use less space.
 * @param a - the first number
 * @param b - the second number
 * @param c - the third number
 * @returns - the interwoven number
 */
export function weave3D(a: number, b: number, c: number): number {
  // return result
  let result = BigInt(0);
  let bigA = BigInt(a);
  let bigB = BigInt(b);
  let bigC = BigInt(c);

  for (let i = 0; i < 16; i++) {
    if ((bigA & 1n) > 0n) result |= 1n << BigInt(i * 3); // Take ith bit from `a` and put it at position 3*i
    if ((bigB & 1n) > 0n) result |= 1n << BigInt(i * 3 + 1); // Take ith bit from `b` and put it at position 3*i+1
    if ((bigC & 1n) > 0n) result |= 1n << BigInt(i * 3 + 2); // Take ith bit from `c` and put it at position 3*i+2
    // Move to the next bit
    bigA >>= 1n;
    bigB >>= 1n;
    bigC >>= 1n;
  }

  return Number(result);
}

/** Object shape for three 16-bit numbers */
export interface Weave3D {
  a: number;
  b: number;
  c: number;
}

/**
 * Deweave a 48-bit number into three 16-bit numbers.
 * @param num - the input
 * @returns - the three numbers
 */
export function unweave3D(num: number): Weave3D {
  // let bNum = BigInt(num)
  let a = 0;
  let b = 0;
  let c = 0;
  for (let i = 0; i < 16; i++) {
    const bit = 1 << i;
    if ((num & 1) > 0) a |= bit;
    if ((num & 2) > 0) b |= bit;
    if ((num & 4) > 0) c |= bit;
    // num >>= 3 <-- we cant do this for numbers > 32 bits in javascript
    for (let j = 0; j < 3; j++) {
      num /= 2;
    }
  }
  return { a, b, c };
}

/**
 * Encode an array of points using interweaving and delta encoding
 * @param array - the array of points
 * @returns - the encoded array as interwoven numbers
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
 * @param array - the encoded array
 * @returns - the decoded array of points
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
 * @param array - the array of 3D points
 * @returns - the encoded array as interwoven numbers
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
 * @param array - the encoded array
 * @returns - the decoded array of 3D points
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
 * @param array - the array
 * @returns - the encoded array
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
 * @param array - the encoded array
 * @returns - the decoded array
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

/**
 * Encode a sorted array using delta encoding (doesn't require zigzag)
 * @param array - the array
 * @returns - the encoded array
 */
export function deltaEncodeSortedArray(array: number[]): number[] {
  const res: number[] = [];

  let offset = 0;
  for (let i = 0; i < array.length; i++) {
    const num = array[i];
    res.push(num - offset);
    offset = num;
  }

  return res;
}

/**
 * Decode a sorted array that was encoded using delta encoding
 * @param array - the encoded array
 * @returns - the decoded array
 */
export function deltaDecodeSortedArray(array: number[]): number[] {
  const res: number[] = [];

  let offset = 0;
  for (let i = 0; i < array.length; i++) {
    const num = array[i] + offset;
    res.push(num);
    offset = num;
  }

  return res;
}

/**
 * 24-bit quantization
 * ~0.000021457672119140625 degrees precision
 * ~2.388 meters precision
 * @param lon - the longitude
 * @returns - the quantized longitude
 */
export function quantizeLon(lon: number): number {
  return Math.round(((lon + 180) * 16_777_215) / 360);
}

/**
 * 24-bit quantization
 * ~0.000010728836059570312 degrees precision
 * ~1.194 meters precision
 * @param lat - the latitude
 * @returns - the quantized latitude
 */
export function quantizeLat(lat: number): number {
  return Math.round(((lat + 90) * 16_777_215) / 180);
}

/**
 * @param qLon - the quantized longitude
 * @returns - the longitude
 */
export function dequantizeLon(qLon: number): number {
  return (qLon * 360) / 16_777_215 - 180;
}

/**
 * @param qLat - the quantized latitude
 * @returns - the latitude
 */
export function dequantizeLat(qLat: number): number {
  return (qLat * 180) / 16_777_215 - 90;
}

/**
 * Packs a 24-bit integer into a buffer at the specified offset.
 * @param buffer - The buffer to pack the integer into
 * @param value - The 24-bit integer to pack
 * @param offset - The offset in the buffer to start packing
 */
function pack24BitUInt(buffer: Uint8Array, value: number, offset: number): void {
  buffer[offset] = (value >> 16) & 0xff;
  buffer[offset + 1] = (value >> 8) & 0xff;
  buffer[offset + 2] = value & 0xff;
}

/**
 * @param buffer - The buffer containing the packed 24-bit integer
 * @param offset - The offset in the buffer to start unpacking
 * @returns - The unpacked 24-bit integer
 */
function unpack24BitUInt(buffer: Uint8Array, offset: number): number {
  return (buffer[offset] << 16) | (buffer[offset + 1] << 8) | buffer[offset + 2];
}

/**
 * @param buffer - the buffer to write to
 * @param value - the float to write
 * @param offset - the offset at which we start writting to the buffer
 */
function packFloat(buffer: Uint8Array, value: number, offset: number): void {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  view.setFloat32(offset, value, true); // true for little-endian
}

/**
 * @param buffer - The buffer containing the packed float
 * @param offset - The offset in the buffer to start unpacking
 * @returns - The unpacked float
 */
function unpackFloat(buffer: Uint8Array, offset: number): number {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  return view.getFloat32(offset, true); // true for little-endian
}

/**
 * | Decimal Places | Approximate Accuracy in Distance       |
 * |----------------|----------------------------------------|
 * | 0              | 111 km (69 miles)                      |
 * | 1              | 11.1 km (6.9 miles)                    |
 * | 2              | 1.11 km (0.69 miles)                   |
 * | 3              | 111 meters (364 feet)                  |
 * | 4              | 11.1 meters (36.4 feet)                |
 * | 5              | 1.11 meters (3.64 feet)                |
 * | 6              | 0.111 meters (11.1 cm or 4.39 inches)  |
 * | 7              | 1.11 cm (0.44 inches)                  |
 * | 8              | 1.11 mm (0.044 inches)                 |
 * 24-bit quantization for longitude and latitude
 * LONGITUDE:
 * - ~0.000021457672119140625 degrees precision
 * - ~2.388 meters precision
 * LATITUDE:
 * - ~0.000010728836059570312 degrees precision
 * - ~1.194 meters precision
 * @param bbox - either 2D or 3D.
 * @returns - the quantized bounding box
 */
export function quantizeBBox(bbox: BBOX): Uint8Array {
  const is3D = bbox.length === 6;
  const buffer = new Uint8Array(is3D ? 20 : 12);

  const qLon1 = quantizeLon(bbox[0]);
  const qLat1 = quantizeLat(bbox[1]);
  const qLon2 = quantizeLon(bbox[2]);
  const qLat2 = quantizeLat(bbox[3]);

  pack24BitUInt(buffer, qLon1, 0);
  pack24BitUInt(buffer, qLat1, 3);
  pack24BitUInt(buffer, qLon2, 6);
  pack24BitUInt(buffer, qLat2, 9);
  if (is3D) {
    packFloat(buffer, bbox[4], 12);
    packFloat(buffer, bbox[5], 16);
  }

  return buffer;
}

/**
 * @param buffer - The buffer containing the quantized bounding box
 * @returns - The decoded bounding box
 */
export function dequantizeBBox(buffer: Uint8Array): BBox {
  const qLon1 = unpack24BitUInt(buffer, 0);
  const qLat1 = unpack24BitUInt(buffer, 3);
  const qLon2 = unpack24BitUInt(buffer, 6);
  const qLat2 = unpack24BitUInt(buffer, 9);

  const lon1 = dequantizeLon(qLon1);
  const lat1 = dequantizeLat(qLat1);
  const lon2 = dequantizeLon(qLon2);
  const lat2 = dequantizeLat(qLat2);

  return [lon1, lat1, lon2, lat2];
}

/**
 * @param buffer - The buffer containing the quantized 3D bounding box
 * @returns - The decoded 3D bounding box
 */
export function dequantizeBBox3D(buffer: Uint8Array): BBox3D {
  const qLon1 = unpack24BitUInt(buffer, 0);
  const qLat1 = unpack24BitUInt(buffer, 3);
  const qLon2 = unpack24BitUInt(buffer, 6);
  const qLat2 = unpack24BitUInt(buffer, 9);
  const zLow = unpackFloat(buffer, 12);
  const zHigh = unpackFloat(buffer, 16);

  const lon1 = dequantizeLon(qLon1);
  const lat1 = dequantizeLat(qLat1);
  const lon2 = dequantizeLon(qLon2);
  const lat2 = dequantizeLat(qLat2);

  return [lon1, lat1, lon2, lat2, zLow, zHigh];
}
