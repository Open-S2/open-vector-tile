import {
  commandDecode,
  commandEncode,
  deltaDecodeArray,
  deltaDecodeSortedArray,
  deltaEncodeArray,
  deltaEncodeSortedArray,
  unweave2D,
  unweave3D,
  unweaveAndDeltaDecode3DArray,
  unweaveAndDeltaDecodeArray,
  weave2D,
  weave3D,
  weaveAndDeltaEncode3DArray,
  weaveAndDeltaEncodeArray,
  zagzig,
  zigzag,
} from '../src/util';
import { describe, expect, test } from 'bun:test';

describe('commandEncode and commandDecode', () => {
  test('commandEncode', () => {
    expect(commandEncode(0, 0)).toBe(0);
    expect(commandEncode(1, 1)).toBe(9);
  });
  test('commandDecode', () => {
    expect(commandDecode(0)).toEqual({ cmd: 0, len: 0 });
    expect(commandDecode(9)).toEqual({ cmd: 1, len: 1 });
  });
  test('both functions', () => {
    expect(commandDecode(commandEncode(0, 0))).toEqual({ cmd: 0, len: 0 });
    expect(commandDecode(commandEncode(1, 1))).toEqual({ cmd: 1, len: 1 });
  });
});

describe('zigzag and zagzig', () => {
  test('zigzag', () => {
    expect(zigzag(0)).toBe(0);
    expect(zigzag(1)).toBe(2);
    expect(zigzag(2)).toBe(4);
    expect(zigzag(3)).toBe(6);
    expect(zigzag(-1)).toBe(1);
    expect(zigzag(-2)).toBe(3);
    expect(zigzag(-3)).toBe(5);
  });

  test('zagzig', () => {
    expect(zagzig(0)).toBe(0);
    expect(zagzig(1)).toBe(-1);
    expect(zagzig(2)).toBe(1);
    expect(zagzig(3)).toBe(-2);
    expect(zagzig(4)).toBe(2);
    expect(zagzig(5)).toBe(-3);
    expect(zagzig(6)).toBe(3);
  });

  test('both functions', () => {
    expect(zagzig(zigzag(0))).toBe(0);
    expect(zagzig(zigzag(1))).toBe(1);
    expect(zagzig(zigzag(2))).toBe(2);
    expect(zagzig(zigzag(3))).toBe(3);
    expect(zagzig(zigzag(-1))).toBe(-1);
    expect(zagzig(zigzag(-2))).toBe(-2);
    expect(zagzig(zigzag(-3))).toBe(-3);
  });
});

describe('weave2D and unweave2D', () => {
  test('weave2D', () => {
    expect(weave2D(0, 0)).toBe(0);
    expect(weave2D(1, 0)).toBe(1);
    expect(weave2D(0, 1)).toBe(2);
    expect(weave2D(1, 1)).toBe(3);
  });
  test('unweave2D', () => {
    expect(unweave2D(0)).toEqual({ a: 0, b: 0 });
    expect(unweave2D(1)).toEqual({ a: 1, b: 0 });
    expect(unweave2D(2)).toEqual({ a: 0, b: 1 });
    expect(unweave2D(3)).toEqual({ a: 1, b: 1 });
  });
  test('both functions', () => {
    expect(unweave2D(weave2D(0, 0))).toEqual({ a: 0, b: 0 });
    expect(unweave2D(weave2D(1, 0))).toEqual({ a: 1, b: 0 });
    expect(unweave2D(weave2D(0, 1))).toEqual({ a: 0, b: 1 });
    expect(unweave2D(weave2D(1, 1))).toEqual({ a: 1, b: 1 });
    expect(unweave2D(weave2D(42_913, 32_382))).toEqual({
      a: 42_913,
      b: 32_382,
    });
    expect(unweave2D(weave2D(65_535, 65_535))).toEqual({
      a: 65_535,
      b: 65_535,
    });
  });
});

describe('weave3D and unweave3D', () => {
  test('weave3D', () => {
    expect(weave3D(0, 0, 0)).toBe(0);
    expect(weave3D(1, 0, 0)).toBe(1);
    expect(weave3D(0, 1, 0)).toBe(2);
    expect(weave3D(1, 1, 0)).toBe(3);
    expect(weave3D(0, 0, 1)).toBe(4);
    expect(weave3D(1, 0, 1)).toBe(5);
    expect(weave3D(0, 1, 1)).toBe(6);
    expect(weave3D(1, 1, 1)).toBe(7);
  });
  test('unweave3D', () => {
    expect(unweave3D(0)).toEqual({ a: 0, b: 0, c: 0 });
    expect(unweave3D(1)).toEqual({ a: 1, b: 0, c: 0 });
    expect(unweave3D(2)).toEqual({ a: 0, b: 1, c: 0 });
    expect(unweave3D(3)).toEqual({ a: 1, b: 1, c: 0 });
    expect(unweave3D(4)).toEqual({ a: 0, b: 0, c: 1 });
    expect(unweave3D(5)).toEqual({ a: 1, b: 0, c: 1 });
    expect(unweave3D(6)).toEqual({ a: 0, b: 1, c: 1 });
    expect(unweave3D(7)).toEqual({ a: 1, b: 1, c: 1 });
  });

  test('both functions', () => {
    expect(unweave3D(weave3D(0, 0, 0))).toEqual({ a: 0, b: 0, c: 0 });
    expect(unweave3D(weave3D(1, 0, 0))).toEqual({ a: 1, b: 0, c: 0 });
    expect(unweave3D(weave3D(0, 1, 0))).toEqual({ a: 0, b: 1, c: 0 });
    expect(unweave3D(weave3D(1, 1, 0))).toEqual({ a: 1, b: 1, c: 0 });
    expect(unweave3D(weave3D(0, 0, 1))).toEqual({ a: 0, b: 0, c: 1 });
    expect(unweave3D(weave3D(1, 0, 1))).toEqual({ a: 1, b: 0, c: 1 });
    expect(unweave3D(weave3D(0, 1, 1))).toEqual({ a: 0, b: 1, c: 1 });
    expect(unweave3D(weave3D(1, 1, 1))).toEqual({ a: 1, b: 1, c: 1 });
    expect(unweave3D(weave3D(42_913, 32_382, 12_382))).toEqual({
      a: 42_913,
      b: 32_382,
      c: 12_382,
    });
    expect(unweave3D(weave3D(65_535, 65_535, 65_535))).toEqual({
      a: 65_535,
      b: 65_535,
      c: 65_535,
    });
  });
});

describe('weaveAndDeltaEncodeArray and unweaveAndDeltaDecodeArray', () => {
  test('weaveAndDeltaEncodeArray', () => {
    expect(
      weaveAndDeltaEncodeArray([
        { x: 55, y: 22 },
        { x: 11, y: 33 },
        { x: 22, y: 44 },
        { x: 23, y: 42 },
      ]),
    ).toEqual([7412, 4925, 828, 14]);
  });

  test('unweaveAndDeltaDecodeArray', () => {
    expect(unweaveAndDeltaDecodeArray([7412, 4925, 828, 14])).toEqual([
      { x: 55, y: 22 },
      { x: 11, y: 33 },
      { x: 22, y: 44 },
      { x: 23, y: 42 },
    ]);
  });
});

describe('weaveAndDeltaEncode3DArray and unweaveAndDeltaDecode3DArray', () => {
  test('weaveAndDeltaEncode3DArray', () => {
    expect(
      weaveAndDeltaEncode3DArray([
        { x: 55, y: 22, z: 1 },
        { x: 11, y: 33, z: 2 },
        { x: 22, y: 44, z: 3 },
        { x: 23, y: 42, z: 4 },
      ]),
    ).toEqual([362216, 274681, 12536, 58]);
  });
  test('unweaveAndDeltaDecode3DArray', () => {
    expect(unweaveAndDeltaDecode3DArray([362216, 274681, 12536, 58])).toEqual([
      { x: 55, y: 22, z: 1 },
      { x: 11, y: 33, z: 2 },
      { x: 22, y: 44, z: 3 },
      { x: 23, y: 42, z: 4 },
    ]);
  });
});

describe('deltaEncodeArray and deltaDecodeArray', () => {
  test('deltaEncodeArray', () => {
    expect(deltaEncodeArray([55, 22, 11, 33, 22, 44, 23, 42])).toEqual([
      110, 65, 21, 44, 21, 44, 41, 38,
    ]);
  });

  test('deltaDecodeArray', () => {
    expect(deltaDecodeArray([110, 65, 21, 44, 21, 44, 41, 38])).toEqual([
      55, 22, 11, 33, 22, 44, 23, 42,
    ]);
  });
});

describe('deltaEncodeSortedArray and deltaDecodeSortedArray', () => {
  const sortedArray = [55, 22, 11, 33, 22, 44, 23, 42].sort((a, b) => a - b);
  test('deltaEncodeSortedArray', () => {
    expect(deltaEncodeSortedArray(sortedArray)).toEqual([11, 11, 0, 1, 10, 9, 2, 11]);
  });

  test('deltaDecodeSortedArray', () => {
    expect(deltaDecodeSortedArray([11, 11, 0, 1, 10, 9, 2, 11])).toEqual([
      11, 22, 22, 23, 33, 42, 44, 55,
    ]);
  });
});
