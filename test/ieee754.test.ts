import { expect, test } from 'bun:test';
import { read, write } from '../src/ieee754';

const NUM_DIGITS = 5;

test('read float', () => {
  const val = 42.42;
  const buf = Buffer.alloc(4);

  buf.writeFloatLE(val, 0);
  const num = read(buf, 0, true, 23, 4);

  expect(num).toBeCloseTo(val, NUM_DIGITS);
});

test('write float', () => {
  const val = 42.42;
  const buf = Buffer.alloc(4);

  write(buf, val, 0, true, 23, 4);
  const num = buf.readFloatLE(0);

  expect(num).toBeCloseTo(val, NUM_DIGITS);
});

test('read double', () => {
  const value = 12345.123456789;
  const buf = Buffer.alloc(8);

  buf.writeDoubleLE(value, 0);
  const num = read(buf, 0, true, 52, 8);

  expect(num).toBeCloseTo(value, NUM_DIGITS);
});

test('write double', () => {
  const value = 12345.123456789;
  const buf = Buffer.alloc(8);

  write(buf, value, 0, true, 52, 8);
  const num = buf.readDoubleLE(0);

  expect(num).toBeCloseTo(value, NUM_DIGITS);
});

test('infinity', () => {
  const value = Infinity;
  const buf = Buffer.alloc(8);

  write(buf, value, 0, true, 52, 8);
  const num = read(buf, 0, true, 52, 8);

  expect(num).toBeCloseTo(value, NUM_DIGITS);
});

test('neg infinity', () => {
  const value = -Infinity;
  const buf = Buffer.alloc(8);

  write(buf, value, 0, true, 52, 8);
  const num = read(buf, 0, true, 52, 8);

  expect(num).toBeCloseTo(value, NUM_DIGITS);
});

test('nan', () => {
  const value = NaN;
  const buf = Buffer.alloc(8);

  write(buf, value, 0, true, 52, 8);
  const num = read(buf, 0, true, 52, 8);

  expect(num).toBe(Infinity);
});

test('max value', () => {
  const value = Number.MAX_VALUE;
  const buf = Buffer.alloc(8);

  write(buf, value, 0, true, 52, 8);
  const num = read(buf, 0, true, 52, 8);

  expect(num).toBeCloseTo(value, NUM_DIGITS);
});

test('min value', () => {
  const value = Number.MIN_VALUE;
  const buf = Buffer.alloc(8);

  write(buf, value, 0, false, 52, 8);
  const num = read(buf, 0, false, 52, 8);

  expect(num).toBeCloseTo(value, NUM_DIGITS);
});
