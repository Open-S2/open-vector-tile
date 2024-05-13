import * as ieee754 from "./ieee754";

const SHIFT_LEFT_32 = (1 << 16) * (1 << 16);
const SHIFT_RIGHT_32 = 1 / SHIFT_LEFT_32;

export type ReadFieldFunction<U> = (tag: number, input: U, pbf: Pbf) => void;

export default class Pbf {
  buf: Uint8Array;
  pos: number;
  length: number;
  type: number;
  static Varint = 0; // varint: int32, int64, uint32, uint64, sint32, sint64, bool, enum
  static Fixed64 = 1; // 64-bit: double, fixed64, sfixed64
  static Bytes = 2; // length-delimited: string, bytes, embedded messages, packed repeated fields
  static Fixed32 = 5; // 32-bit: float, fixed32, sfixed32
  static None = 7; // null value
  constructor(buf: Uint8Array = new Uint8Array(0)) {
    this.buf = buf;
    this.pos = 0;
    this.type = 0;
    this.length = this.buf.length;
  }

  destroy(): void {
    this.buf = new Uint8Array(0);
  }

  // === READING =================================================================

  readFields<U>(readField: ReadFieldFunction<U>, input: U, end: number): U {
    if (end === 0) end = this.length;

    while (this.pos < end) {
      const val = this.readVarint();
      const tag = val >> 3;
      const startPos = this.pos;

      this.type = val & 0x7;
      readField(tag, input, this);

      if (this.pos === startPos) this.skip(val);
    }

    return input;
  }

  readMessage<U>(readField: ReadFieldFunction<U>, input: U): U {
    return this.readFields<U>(readField, input, this.readVarint() + this.pos);
  }

  readFixed32(): number {
    const val = readUInt32(this.buf, this.pos);
    this.pos += 4;
    return val;
  }

  readSFixed32(): number {
    const val = readInt32(this.buf, this.pos);
    this.pos += 4;
    return val;
  }

  // 64-bit int handling is based on github.com/dpw/node-buffer-more-ints (MIT-licensed)

  readFixed64(): number {
    const val = readUInt32(this.buf, this.pos) + readUInt32(this.buf, this.pos + 4) * SHIFT_LEFT_32;
    this.pos += 8;
    return val;
  }

  readSFixed64(): number {
    const val = readUInt32(this.buf, this.pos) + readInt32(this.buf, this.pos + 4) * SHIFT_LEFT_32;
    this.pos += 8;
    return val;
  }

  readFloat(): number {
    const val = ieee754.read(this.buf, this.pos, true, 23, 4);
    this.pos += 4;
    return val;
  }

  readDouble(): number {
    const val = ieee754.read(this.buf, this.pos, true, 52, 8);
    this.pos += 8;
    return val;
  }

  readVarint(isSigned = false): number {
    const buf = this.buf;
    let val;
    let b;

    b = buf[this.pos++];
    val = b & 0x7f;
    if (b < 0x80) return val;
    b = buf[this.pos++];
    val |= (b & 0x7f) << 7;
    if (b < 0x80) return val;
    b = buf[this.pos++];
    val |= (b & 0x7f) << 14;
    if (b < 0x80) return val;
    b = buf[this.pos++];
    val |= (b & 0x7f) << 21;
    if (b < 0x80) return val;
    b = buf[this.pos];
    val |= (b & 0x0f) << 28;

    return readVarintRemainder(val, isSigned, this);
  }

  readVarint64(): number {
    // for compatibility with v2.0.1
    return this.readVarint(true);
  }

  readSVarint(): number {
    const num = this.readVarint();
    return num % 2 === 1 ? (num + 1) / -2 : num / 2; // zigzag encoding
  }

  readBoolean(): boolean {
    return Boolean(this.readVarint());
  }

  readString(): string {
    const end = this.readVarint() + this.pos;
    const pos = this.pos;
    this.pos = end;

    return readUtf8(this.buf, pos, end);
  }

  readBytes(): Uint8Array {
    const end = this.readVarint() + this.pos;
    const buffer = this.buf.subarray(this.pos, end);
    this.pos = end;
    return buffer;
  }

  // verbose for performance reasons; doesn't affect gzipped size

  readPackedVarint(arr: number[] = [], isSigned = false): number[] {
    if (this.type !== Pbf.Bytes) {
      arr.push(this.readVarint(isSigned));
    } else {
      const end = readPackedEnd(this);
      while (this.pos < end) arr.push(this.readVarint(isSigned));
    }
    return arr;
  }

  readPackedSVarint(arr: number[] = []): number[] {
    if (this.type !== Pbf.Bytes) {
      arr.push(this.readSVarint());
    } else {
      const end = readPackedEnd(this);
      while (this.pos < end) arr.push(this.readSVarint());
    }
    return arr;
  }

  readPackedBoolean(arr: boolean[] = []): boolean[] {
    if (this.type !== Pbf.Bytes) {
      arr.push(this.readBoolean());
    } else {
      const end = readPackedEnd(this);
      while (this.pos < end) arr.push(this.readBoolean());
    }
    return arr;
  }

  readPackedFloat(arr: number[] = []): number[] {
    if (this.type !== Pbf.Bytes) {
      arr.push(this.readFloat());
    } else {
      const end = readPackedEnd(this);
      while (this.pos < end) arr.push(this.readFloat());
    }
    return arr;
  }

  readPackedDouble(arr: number[] = []): number[] {
    if (this.type !== Pbf.Bytes) {
      arr.push(this.readDouble());
    } else {
      const end = readPackedEnd(this);
      while (this.pos < end) arr.push(this.readDouble());
    }
    return arr;
  }

  readPackedFixed32(arr: number[] = []): number[] {
    if (this.type !== Pbf.Bytes) {
      arr.push(this.readFixed32());
    } else {
      const end = readPackedEnd(this);
      while (this.pos < end) arr.push(this.readFixed32());
    }
    return arr;
  }

  readPackedSFixed32(arr: number[] = []): number[] {
    if (this.type !== Pbf.Bytes) {
      arr.push(this.readSFixed32());
    } else {
      const end = readPackedEnd(this);
      while (this.pos < end) arr.push(this.readSFixed32());
    }
    return arr;
  }

  readPackedFixed64(arr: number[] = []): number[] {
    if (this.type !== Pbf.Bytes) {
      arr.push(this.readFixed64());
    } else {
      const end = readPackedEnd(this);
      while (this.pos < end) arr.push(this.readFixed64());
    }
    return arr;
  }

  readPackedSFixed64(arr: number[] = []): number[] {
    if (this.type !== Pbf.Bytes) {
      arr.push(this.readSFixed64());
    } else {
      const end = readPackedEnd(this);
      while (this.pos < end) arr.push(this.readSFixed64());
    }
    return arr;
  }

  skip(val: number): void {
    const type = val & 0x7;
    if (type === Pbf.Varint) {
      while (this.buf[this.pos++] > 0x7f) {
        continue;
      }
    } else if (type === Pbf.Bytes) this.pos = this.readVarint() + this.pos;
    else if (type === Pbf.Fixed32) this.pos += 4;
    else if (type === Pbf.Fixed64) this.pos += 8;
    else throw new Error("Unimplemented type: " + String(type));
  }

  // === WRITING =================================================================

  writeTag(tag: number, type: number): void {
    this.writeVarint((tag << 3) | type);
  }

  realloc(min: number): void {
    let length = this.length > 0 ? this.length : 16;

    while (length < this.pos + min) length *= 2;

    if (length !== this.length) {
      const buf = new Uint8Array(length);
      buf.set(this.buf);
      this.buf = buf;
      this.length = length;
    }
  }

  commit(): Uint8Array {
    this.length = this.pos;
    this.pos = 0;
    return this.buf.subarray(0, this.length);
  }

  writeFixed32(val: number): void {
    this.realloc(4);
    writeInt32(this.buf, val, this.pos);
    this.pos += 4;
  }

  writeSFixed32(val: number): void {
    this.realloc(4);
    writeInt32(this.buf, val, this.pos);
    this.pos += 4;
  }

  writeFixed64(val: number): void {
    this.realloc(8);
    writeInt32(this.buf, val & -1, this.pos);
    writeInt32(this.buf, Math.floor(val * SHIFT_RIGHT_32), this.pos + 4);
    this.pos += 8;
  }

  writeSFixed64(val: number): void {
    this.realloc(8);
    writeInt32(this.buf, val & -1, this.pos);
    writeInt32(this.buf, Math.floor(val * SHIFT_RIGHT_32), this.pos + 4);
    this.pos += 8;
  }

  writeVarint(val: number): void {
    if (val > 0xfffffff || val < 0) {
      writeBigVarint(val, this);
      return;
    }

    this.realloc(4);

    this.buf[this.pos++] = (val & 0x7f) | (val > 0x7f ? 0x80 : 0);
    if (val <= 0x7f) return;
    this.buf[this.pos++] = ((val >>>= 7) & 0x7f) | (val > 0x7f ? 0x80 : 0);
    if (val <= 0x7f) return;
    this.buf[this.pos++] = ((val >>>= 7) & 0x7f) | (val > 0x7f ? 0x80 : 0);
    if (val <= 0x7f) return;
    this.buf[this.pos++] = (val >>> 7) & 0x7f;
  }

  writeSVarint(val: number): void {
    this.writeVarint(val < 0 ? -val * 2 - 1 : val * 2);
  }

  writeBoolean(val: boolean | number): void {
    const bool = Boolean(val);
    this.writeVarint(Number(bool));
  }

  writeString(str: string): void {
    str = String(str);
    this.realloc(str.length * 4);

    this.pos++; // reserve 1 byte for short string length

    const startPos = this.pos;
    // write the string directly to the buffer and see how much was written
    this.pos = writeUtf8(this.buf, str, this.pos);
    const len = this.pos - startPos;

    if (len >= 0x80) makeRoomForExtraLength(startPos, len, this);

    // finally, write the message length in the reserved place and restore the position
    this.pos = startPos - 1;
    this.writeVarint(len);
    this.pos += len;
  }

  writeFloat(val: number): void {
    this.realloc(4);
    ieee754.write(this.buf, val, this.pos, true, 23, 4);
    this.pos += 4;
  }

  writeDouble(val: number): void {
    this.realloc(8);
    ieee754.write(this.buf, val, this.pos, true, 52, 8);
    this.pos += 8;
  }

  writeBytes(buf: Buffer): void {
    const len = buf.length;
    this.writeVarint(len);
    this.realloc(len);
    for (let i = 0; i < len; i++) this.buf[this.pos++] = buf[i];
  }

  writeRawMessage<T>(fn: (obj: T, pbf: Pbf) => void, obj: T): void {
    this.pos++; // reserve 1 byte for short message length

    // write the message directly to the buffer and see how much was written
    const startPos = this.pos;
    fn(obj, this);
    const len = this.pos - startPos;

    if (len >= 0x80) makeRoomForExtraLength(startPos, len, this);

    // finally, write the message length in the reserved place and restore the position
    this.pos = startPos - 1;
    this.writeVarint(len);
    this.pos += len;
  }

  writeMessage<T>(tag: number, fn: (obj: T, pbf: Pbf) => void, obj: T): void {
    this.writeTag(tag, Pbf.Bytes);
    this.writeRawMessage(fn, obj);
  }

  writePackedVarint(tag: number, arr: number[]): void {
    if (arr.length > 0) this.writeMessage(tag, writePackedVarint, arr);
  }

  writePackedSVarint(tag: number, arr: number[]): void {
    if (arr.length > 0) this.writeMessage(tag, writePackedSVarint, arr);
  }

  writePackedBoolean(tag: number, arr: number[]): void {
    if (arr.length > 0) this.writeMessage(tag, writePackedBoolean, arr);
  }

  writePackedFloat(tag: number, arr: number[]): void {
    if (arr.length > 0) this.writeMessage(tag, writePackedFloat, arr);
  }

  writePackedDouble(tag: number, arr: number[]): void {
    if (arr.length > 0) this.writeMessage(tag, writePackedDouble, arr);
  }

  writePackedFixed32(tag: number, arr: number[]): void {
    if (arr.length > 0) this.writeMessage(tag, writePackedFixed32, arr);
  }

  writePackedSFixed32(tag: number, arr: number[]): void {
    if (arr.length > 0) this.writeMessage(tag, writePackedSFixed32, arr);
  }

  writePackedFixed64(tag: number, arr: number[]): void {
    if (arr.length > 0) this.writeMessage(tag, writePackedFixed64, arr);
  }

  writePackedSFixed64(tag: number, arr: number[]): void {
    if (arr.length > 0) this.writeMessage(tag, writePackedSFixed64, arr);
  }

  writeBytesField(tag: number, buffer: Buffer): void {
    this.writeTag(tag, Pbf.Bytes);
    this.writeBytes(buffer);
  }

  writeFixed32Field(tag: number, val: number): void {
    this.writeTag(tag, Pbf.Fixed32);
    this.writeFixed32(val);
  }

  writeSFixed32Field(tag: number, val: number): void {
    this.writeTag(tag, Pbf.Fixed32);
    this.writeSFixed32(val);
  }

  writeFixed64Field(tag: number, val: number): void {
    this.writeTag(tag, Pbf.Fixed64);
    this.writeFixed64(val);
  }

  writeSFixed64Field(tag: number, val: number): void {
    this.writeTag(tag, Pbf.Fixed64);
    this.writeSFixed64(val);
  }

  writeVarintField(tag: number, val: number): void {
    this.writeTag(tag, Pbf.Varint);
    this.writeVarint(val);
  }

  writeSVarintField(tag: number, val: number): void {
    this.writeTag(tag, Pbf.Varint);
    this.writeSVarint(val);
  }

  writeStringField(tag: number, str: string): void {
    this.writeTag(tag, Pbf.Bytes);
    this.writeString(str);
  }

  writeFloatField(tag: number, val: number): void {
    this.writeTag(tag, Pbf.Fixed32);
    this.writeFloat(val);
  }

  writeDoubleField(tag: number, val: number): void {
    this.writeTag(tag, Pbf.Fixed64);
    this.writeDouble(val);
  }

  writeBooleanField(tag: number, val: boolean): void {
    this.writeVarintField(tag, Number(val));
  }
}

function readVarintRemainder(l: number, s: boolean, p: Pbf): number {
  const buf = p.buf;
  let h;
  let b;

  b = buf[p.pos++];
  h = (b & 0x70) >> 4;
  if (b < 0x80) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 0x7f) << 3;
  if (b < 0x80) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 0x7f) << 10;
  if (b < 0x80) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 0x7f) << 17;
  if (b < 0x80) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 0x7f) << 24;
  if (b < 0x80) return toNum(l, h, s);
  b = buf[p.pos++];
  h |= (b & 0x01) << 31;
  if (b < 0x80) return toNum(l, h, s);

  throw new Error("Expected varint not more than 10 bytes");
}

function readPackedEnd(pbf: Pbf): number {
  return pbf.type === Pbf.Bytes ? pbf.readVarint() + pbf.pos : pbf.pos + 1;
}

function toNum(low: number, high: number, isSigned: boolean): number {
  if (isSigned) {
    return high * 0x100000000 + (low >>> 0);
  }

  return (high >>> 0) * 0x100000000 + (low >>> 0);
}

function writeBigVarint(val: number, pbf: Pbf): void {
  let low = val % 0x100000000 | 0;
  let high = (val / 0x100000000) | 0;

  if (val < 0) {
    low = ~(-val % 0x100000000);
    high = ~(-val / 0x100000000);

    if ((low ^ 0xffffffff) !== 0) {
      low = (low + 1) | 0;
    } else {
      low = 0;
      high = (high + 1) | 0;
    }
  }

  if (val >= 0x10000000000000000n || val < -0x10000000000000000n) {
    throw new Error("Given varint doesn't fit into 10 bytes");
  }

  pbf.realloc(10);

  writeBigVarintLow(low, high, pbf);
  writeBigVarintHigh(high, pbf);
}

function writeBigVarintLow(low: number, _high: number, pbf: Pbf): void {
  pbf.buf[pbf.pos++] = (low & 0x7f) | 0x80;
  low >>>= 7;
  pbf.buf[pbf.pos++] = (low & 0x7f) | 0x80;
  low >>>= 7;
  pbf.buf[pbf.pos++] = (low & 0x7f) | 0x80;
  low >>>= 7;
  pbf.buf[pbf.pos++] = (low & 0x7f) | 0x80;
  low >>>= 7;
  pbf.buf[pbf.pos] = low & 0x7f;
}

function writeBigVarintHigh(high: number, pbf: Pbf): void {
  const lsb = (high & 0x07) << 4;

  pbf.buf[pbf.pos++] |= lsb | ((high >>>= 3) !== 0 ? 0x80 : 0);
  if (high === 0) return;
  pbf.buf[pbf.pos++] = (high & 0x7f) | ((high >>>= 7) !== 0 ? 0x80 : 0);
  if (high === 0) return;
  pbf.buf[pbf.pos++] = (high & 0x7f) | ((high >>>= 7) !== 0 ? 0x80 : 0);
  if (high === 0) return;
  pbf.buf[pbf.pos++] = (high & 0x7f) | ((high >>>= 7) !== 0 ? 0x80 : 0);
  if (high === 0) return;
  pbf.buf[pbf.pos++] = (high & 0x7f) | ((high >>>= 7) !== 0 ? 0x80 : 0);
  if (high === 0) return;
  pbf.buf[pbf.pos++] = high & 0x7f;
}

function makeRoomForExtraLength(startPos: number, len: number, pbf: Pbf): void {
  const extraLen =
    len <= 0x3fff
      ? 1
      : len <= 0x1fffff
        ? 2
        : len <= 0xfffffff
          ? 3
          : Math.floor(Math.log(len) / (Math.LN2 * 7));

  // if 1 byte isn't enough for encoding message length, shift the data to the right
  pbf.realloc(extraLen);
  for (let i = pbf.pos - 1; i >= startPos; i--) {
    pbf.buf[i + extraLen] = pbf.buf[i];
  }
}

function writePackedVarint(arr: number[], pbf: Pbf): void {
  for (let i = 0; i < arr.length; i++) pbf.writeVarint(arr[i]);
}
function writePackedSVarint(arr: number[], pbf: Pbf): void {
  for (let i = 0; i < arr.length; i++) pbf.writeSVarint(arr[i]);
}
function writePackedFloat(arr: number[], pbf: Pbf): void {
  for (let i = 0; i < arr.length; i++) pbf.writeFloat(arr[i]);
}
function writePackedDouble(arr: number[], pbf: Pbf): void {
  for (let i = 0; i < arr.length; i++) pbf.writeDouble(arr[i]);
}
function writePackedBoolean(arr: number[], pbf: Pbf): void {
  for (let i = 0; i < arr.length; i++) pbf.writeBoolean(arr[i]);
}
function writePackedFixed32(arr: number[], pbf: Pbf): void {
  for (let i = 0; i < arr.length; i++) pbf.writeFixed32(arr[i]);
}
function writePackedSFixed32(arr: number[], pbf: Pbf): void {
  for (let i = 0; i < arr.length; i++) pbf.writeSFixed32(arr[i]);
}
function writePackedFixed64(arr: number[], pbf: Pbf): void {
  for (let i = 0; i < arr.length; i++) pbf.writeFixed64(arr[i]);
}
function writePackedSFixed64(arr: number[], pbf: Pbf): void {
  for (let i = 0; i < arr.length; i++) pbf.writeSFixed64(arr[i]);
}

// Buffer code below from https://github.com/feross/buffer, MIT-licensed

function readUInt32(buf: Uint8Array, pos: number): number {
  return (buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16)) + buf[pos + 3] * 0x1000000;
}

function writeInt32(buf: Uint8Array, val: number, pos: number): void {
  buf[pos] = val;
  buf[pos + 1] = val >>> 8;
  buf[pos + 2] = val >>> 16;
  buf[pos + 3] = val >>> 24;
}

function readInt32(buf: Uint8Array, pos: number): number {
  return (buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16)) + (buf[pos + 3] << 24);
}

function readUtf8(buf: Uint8Array, pos: number, end: number): string {
  let str = "";
  let i = pos;

  while (i < end) {
    const b0 = buf[i];
    let c: number | null = null; // codepoint
    let bytesPerSequence = b0 > 0xef ? 4 : b0 > 0xdf ? 3 : b0 > 0xbf ? 2 : 1;

    if (i + bytesPerSequence > end) break;

    let b1: number, b2: number, b3: number;

    if (bytesPerSequence === 1) {
      if (b0 < 0x80) {
        c = b0;
      }
    } else if (bytesPerSequence === 2) {
      b1 = buf[i + 1];
      if ((b1 & 0xc0) === 0x80) {
        c = ((b0 & 0x1f) << 0x6) | (b1 & 0x3f);
        if (c <= 0x7f) {
          c = null;
        }
      }
    } else if (bytesPerSequence === 3) {
      b1 = buf[i + 1];
      b2 = buf[i + 2];
      if ((b1 & 0xc0) === 0x80 && (b2 & 0xc0) === 0x80) {
        c = ((b0 & 0xf) << 0xc) | ((b1 & 0x3f) << 0x6) | (b2 & 0x3f);
        if (c <= 0x7ff || (c >= 0xd800 && c <= 0xdfff)) {
          c = null;
        }
      }
    } else if (bytesPerSequence === 4) {
      b1 = buf[i + 1];
      b2 = buf[i + 2];
      b3 = buf[i + 3];
      if ((b1 & 0xc0) === 0x80 && (b2 & 0xc0) === 0x80 && (b3 & 0xc0) === 0x80) {
        c = ((b0 & 0xf) << 0x12) | ((b1 & 0x3f) << 0xc) | ((b2 & 0x3f) << 0x6) | (b3 & 0x3f);
        if (c <= 0xffff || c >= 0x110000) {
          c = null;
        }
      }
    }

    if (c === null) {
      c = 0xfffd;
      bytesPerSequence = 1;
    } else if (c > 0xffff) {
      c -= 0x10000;
      str += String.fromCharCode(((c >>> 10) & 0x3ff) | 0xd800);
      c = 0xdc00 | (c & 0x3ff);
    }

    str += String.fromCharCode(c);
    i += bytesPerSequence;
  }

  return str;
}

function writeUtf8(buf: Uint8Array, str: string, pos: number): number {
  for (let i = 0, c, lead = null; i < str.length; i++) {
    c = str.charCodeAt(i); // code point

    if (c > 0xd7ff && c < 0xe000) {
      if (lead !== null) {
        if (c < 0xdc00) {
          buf[pos++] = 0xef;
          buf[pos++] = 0xbf;
          buf[pos++] = 0xbd;
          lead = c;
          continue;
        } else {
          c = ((lead - 0xd800) << 10) | (c - 0xdc00) | 0x10000;
          lead = null;
        }
      } else {
        if (c > 0xdbff || i + 1 === str.length) {
          buf[pos++] = 0xef;
          buf[pos++] = 0xbf;
          buf[pos++] = 0xbd;
        } else {
          lead = c;
        }
        continue;
      }
    } else if (lead !== null) {
      buf[pos++] = 0xef;
      buf[pos++] = 0xbf;
      buf[pos++] = 0xbd;
      lead = null;
    }

    if (c < 0x80) {
      buf[pos++] = c;
    } else {
      if (c < 0x800) {
        buf[pos++] = (c >> 0x6) | 0xc0;
      } else {
        if (c < 0x10000) {
          buf[pos++] = (c >> 0xc) | 0xe0;
        } else {
          buf[pos++] = (c >> 0x12) | 0xf0;
          buf[pos++] = ((c >> 0xc) & 0x3f) | 0x80;
        }
        buf[pos++] = ((c >> 0x6) & 0x3f) | 0x80;
      }
      buf[pos++] = (c & 0x3f) | 0x80;
    }
  }
  return pos;
}
