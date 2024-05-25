import * as ieee754 from './ieee754';

const SHIFT_LEFT_32 = (1 << 16) * (1 << 16);
const SHIFT_RIGHT_32 = 1 / SHIFT_LEFT_32;

/**
 * User defined function to read in fields from a Pbf instance into input.
 * @template U - the input type
 */
export type ReadFieldFunction<U> = (tag: number, input: U, pbf: Pbf) => void;

/**
 * A tag is a pair of a number and a type.
 */
export interface Tag {
  /** the number of the tag */
  tag: number;
  /** the type of the tag */
  type: number;
}

/**
 * Create a new PBF instance and either read or write to it.
 * Follows the early Protobuf spec supporting various types of encoding
 * including messages (which are usually representative of class objects).
 *
 * Reading:
 * ```ts
 * const data = fs.readFileSync(path);
 * const pbf = new Pbf(data);
 * ```
 *
 * Writing:
 * ```ts
 * const pbf = new Pbf();
 * pbf.writeVarintField(1, 1);
 * // ...
 * ```
 */
export class Pbf {
  buf: Uint8Array;
  pos: number;
  length: number;
  type: number;
  static Varint = 0; // varint: int32, int64, uint32, uint64, sint32, sint64, bool, enum
  static Fixed64 = 1; // 64-bit: double, fixed64, sfixed64
  static Bytes = 2; // length-delimited: string, bytes, embedded messages, packed repeated fields
  static Fixed32 = 5; // 32-bit: float, fixed32, sfixed32
  static None = 7; // null value
  /**
   * @param buf - an optional Uint8Array to use for reading. otherwise defaults to an empty
   * Uint8Array for writing
   */
  constructor(buf: Uint8Array = new Uint8Array(0)) {
    this.buf = buf;
    this.pos = 0;
    this.type = 0;
    this.length = this.buf.length;
  }

  /**
   * Destroys the PBF instance. You can still use the Pbf instance after calling
   * this method. However, the buffer will be emptied.
   */
  destroy(): void {
    this.buf = new Uint8Array(0);
    this.pos = 0;
    this.type = 0;
    this.length = 0;
  }

  // === READING =================================================================

  /**
   * Reads a tag from the buffer, pulls out the tag and type and returns it.
   * @returns - {tag: number, type: number}
   */
  readTag(): Tag {
    const input = this.readVarint();
    const tag = input >> 3;
    const type = (this.type = input & 7);
    return { tag, type };
  }

  /**
   * If you know you are reading a message, but have already read the length of
   * the message OR you're reading fields of the top level data, then this method
   * is the alternative. It's often used by sub-classes So that it can be
   * instationated prior to reading the message. @see {@link readMessage}.
   *
   * Ex.
   *
   * ```ts
   * export class MapboxVectorLayer {
   *   constructor(pbf: Protobuf, end: number) {
   *     this.#pbf = pbf;
   *     pbf.readFields(this.#readLayer, this, end);
   *   }
   *
   *   #readLayer(tag: number, layer: MapboxVectorLayer, pbf: Protobuf): void {
   *     if (tag === 15) layer.version = pbf.readVarint();
   *     else if (tag === 1) layer.name = pbf.readString();
   *     ...
   *   }
   * }
   * ```
   * @param readField - user defined input function to parse the message fields
   * @param input - The class to mutate given field data
   * @param end - the end position of the message in the buffer
   * @returns - The class we mutated will be returned
   */
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

  /**
   * Reads a message from the buffer. Sometimes it's easier to manage sub structures
   * so that the current method can build multiples of an entire structure/class.
   * If you you are at the top level, or parsing the message inside a class, then
   * @see {@link readFields}.
   *
   * Ex.
   *
   * ```ts
   * class Test {
   *   a: number = 0;
   *
   *   static read(tag: number, test: Test, pbf: Protobuf): void {
   *     if (tag === 1) test.a = pbf.readVarint();
   *     // ...
   *   }
   * }
   *
   * const pbf = new Pbf(data);
   * const t = new Test();
   * pbf3.readTag();
   * pbf3.readMessage(Test.read, t);
   * ```
   * @param readField - user defined input function
   * @param input - an instance of the class you are reading into
   * @returns - The class itself will be returned
   */
  readMessage<U>(readField: ReadFieldFunction<U>, input: U): U {
    return this.readFields<U>(readField, input, this.readVarint() + this.pos);
  }

  /**
   * Read in a 32-bit unsigned integer from the buffer. There are no compression advantages
   * with this type of encoding.
   * @returns - 32-bit unsigned integer
   */
  readFixed32(): number {
    const val = readUInt32(this.buf, this.pos);
    this.pos += 4;
    return val;
  }

  /**
   * Read in a 32-bit signed integer from the buffer. There are no compression advantages
   * with this type of encoding.
   * @returns - 32-bit signed integer
   */
  readSFixed32(): number {
    const val = readInt32(this.buf, this.pos);
    this.pos += 4;
    return val;
  }

  // 64-bit int handling is based on github.com/dpw/node-buffer-more-ints (MIT-licensed)

  /**
   * Read in a 64-bit unsigned integer from the buffer. There are no compression advantages
   * with this type of encoding.
   * @returns - 64-bit unsigned integer
   */
  readFixed64(): number {
    const val = readUInt32(this.buf, this.pos) + readUInt32(this.buf, this.pos + 4) * SHIFT_LEFT_32;
    this.pos += 8;
    return val;
  }

  /**
   * Read in a 64-bit signed integer from the buffer. There are no compression advantages
   * with this type of encoding.
   * @returns - 64-bit signed integer
   */
  readSFixed64(): number {
    const val = readUInt32(this.buf, this.pos) + readInt32(this.buf, this.pos + 4) * SHIFT_LEFT_32;
    this.pos += 8;
    return val;
  }

  /**
   * Read in a 32-bit float from the buffer. There are no compression advantages
   * with this type of encoding.
   * @returns - 32-bit float
   */
  readFloat(): number {
    const val = ieee754.read(this.buf, this.pos, true, 23, 4);
    this.pos += 4;
    return val;
  }

  /**
   * Read in a 64-bit float from the buffer. There are no compression advantages
   * with this type of encoding.
   * @returns - 64-bit float
   */
  readDouble(): number {
    const val = ieee754.read(this.buf, this.pos, true, 52, 8);
    this.pos += 8;
    return val;
  }

  /**
   * @param isSigned - true if the number is signed
   * @returns - the decoded number
   */
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

  /**
   * @see {@link readVarint} for better performance
   * @returns - the decoded number
   */
  readVarint64(): number {
    // for compatibility with v2.0.1
    return this.readVarint(true);
  }

  /**
   * @returns - the decoded number as a signed number
   */
  readSVarint(): number {
    const num = this.readVarint();
    return num % 2 === 1 ? (num + 1) / -2 : num / 2; // zigzag encoding
  }

  /**
   * @returns - parses the varint byte as a boolean expression
   */
  readBoolean(): boolean {
    return Boolean(this.readVarint());
  }

  /**
   * @returns - the decoded string
   */
  readString(): string {
    const end = this.readVarint() + this.pos;
    const pos = this.pos;
    this.pos = end;

    return readUtf8(this.buf, pos, end);
  }

  /**
   * NOTE: bytes is preceeded by a varint dscribing the length of the bytes.
   * The bytes themselves are presumed to be u8s and therefore don't need to be decoded
   * @returns - the decoded byte array
   */
  readBytes(): Uint8Array {
    const end = this.readVarint() + this.pos;
    const buffer = this.buf.subarray(this.pos, end);
    this.pos = end;
    return buffer;
  }

  // verbose for performance reasons; doesn't affect gzipped size

  /**
   * @param arr - the array to write to
   * @param isSigned - true if the numbers are signed
   * @returns - the `arr` input with the decoded numbers is also returned
   */
  readPackedVarint(arr: number[] = [], isSigned = false): number[] {
    if (this.type !== Pbf.Bytes) {
      arr.push(this.readVarint(isSigned));
    } else {
      const end = readPackedEnd(this);
      while (this.pos < end) arr.push(this.readVarint(isSigned));
    }
    return arr;
  }

  /**
   * @param arr - the array to write to
   * @returns - the `arr` input with the decoded numbers is also returned
   */
  readPackedSVarint(arr: number[] = []): number[] {
    if (this.type !== Pbf.Bytes) {
      arr.push(this.readSVarint());
    } else {
      const end = readPackedEnd(this);
      while (this.pos < end) arr.push(this.readSVarint());
    }
    return arr;
  }

  /**
   * @param arr - the array to write to
   * @returns - the `arr` input with the decoded boolean values is also returned
   */
  readPackedBoolean(arr: boolean[] = []): boolean[] {
    if (this.type !== Pbf.Bytes) {
      arr.push(this.readBoolean());
    } else {
      const end = readPackedEnd(this);
      while (this.pos < end) arr.push(this.readBoolean());
    }
    return arr;
  }

  /**
   * @param arr - the array to write to
   * @returns - the `arr` input with the decoded floats is also returned
   */
  readPackedFloat(arr: number[] = []): number[] {
    if (this.type !== Pbf.Bytes) {
      arr.push(this.readFloat());
    } else {
      const end = readPackedEnd(this);
      while (this.pos < end) arr.push(this.readFloat());
    }
    return arr;
  }

  /**
   * @param arr - the array to write to
   * @returns - the `arr` input with the decoded doubles is also returned
   */
  readPackedDouble(arr: number[] = []): number[] {
    if (this.type !== Pbf.Bytes) {
      arr.push(this.readDouble());
    } else {
      const end = readPackedEnd(this);
      while (this.pos < end) arr.push(this.readDouble());
    }
    return arr;
  }

  /**
   * @param arr - the array to write to
   * @returns - the `arr` input with the decoded unsigned integers is also returned
   */
  readPackedFixed32(arr: number[] = []): number[] {
    if (this.type !== Pbf.Bytes) {
      arr.push(this.readFixed32());
    } else {
      const end = readPackedEnd(this);
      while (this.pos < end) arr.push(this.readFixed32());
    }
    return arr;
  }

  /**
   * @param arr - the array to write to
   * @returns - the `arr` input with the decoded signed integers is also returned
   */
  readPackedSFixed32(arr: number[] = []): number[] {
    if (this.type !== Pbf.Bytes) {
      arr.push(this.readSFixed32());
    } else {
      const end = readPackedEnd(this);
      while (this.pos < end) arr.push(this.readSFixed32());
    }
    return arr;
  }

  /**
   * @param arr - the array to write to
   * @returns - the `arr` input with the decoded unsigned 64-bit integers is also returned
   */
  readPackedFixed64(arr: number[] = []): number[] {
    if (this.type !== Pbf.Bytes) {
      arr.push(this.readFixed64());
    } else {
      const end = readPackedEnd(this);
      while (this.pos < end) arr.push(this.readFixed64());
    }
    return arr;
  }

  /**
   * @param arr - the array to write to
   * @returns - the `arr` input with the decoded signed 64-bit integers is also returned
   */
  readPackedSFixed64(arr: number[] = []): number[] {
    if (this.type !== Pbf.Bytes) {
      arr.push(this.readSFixed64());
    } else {
      const end = readPackedEnd(this);
      while (this.pos < end) arr.push(this.readSFixed64());
    }
    return arr;
  }

  /**
   * Skip a value we are not interested in parsing
   * @param val - the type to skip
   */
  skip(val: number): void {
    const type = val & 0x7;
    if (type === Pbf.Varint) {
      while (this.buf[this.pos++] > 0x7f) {
        continue;
      }
    } else if (type === Pbf.Bytes) this.pos = this.readVarint() + this.pos;
    else if (type === Pbf.Fixed32) this.pos += 4;
    else if (type === Pbf.Fixed64) this.pos += 8;
    else throw new Error('Unimplemented type: ' + String(type));
  }

  // === WRITING =================================================================

  /**
   * Write a tag and its associated type
   * @param tag - the tag to write
   * @param type - the type to write  (will never be greater than 3 bits)
   */
  writeTag(tag: number, type: number): void {
    this.writeVarint((tag << 3) | type);
  }

  /**
   * Allocate more space in the buffer
   * @param min - the minimum number of bytes to allocate
   */
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

  /**
   * @returns - the entire written buffer
   */
  commit(): Uint8Array {
    this.length = this.pos;
    this.pos = 0;
    return this.buf.subarray(0, this.length);
  }

  /**
   * Write a 32-bit unsigned integer
   * @param val - the 32-bit unsigned integer to write
   */
  writeFixed32(val: number): void {
    this.realloc(4);
    writeInt32(this.buf, val, this.pos);
    this.pos += 4;
  }

  /**
   * Write a 32-bit signed integer
   * @param val - the 32-bit signed integer to write
   */
  writeSFixed32(val: number): void {
    this.realloc(4);
    writeInt32(this.buf, val, this.pos);
    this.pos += 4;
  }

  /**
   * Write a 64-bit unsigned integer
   * @param val - the 64-bit unsigned integer to write
   */
  writeFixed64(val: number): void {
    this.realloc(8);
    writeInt32(this.buf, val & -1, this.pos);
    writeInt32(this.buf, Math.floor(val * SHIFT_RIGHT_32), this.pos + 4);
    this.pos += 8;
  }

  /**
   * Write a 64-bit signed integer
   * @param val - the 64-bit signed integer to write
   */
  writeSFixed64(val: number): void {
    this.realloc(8);
    writeInt32(this.buf, val & -1, this.pos);
    writeInt32(this.buf, Math.floor(val * SHIFT_RIGHT_32), this.pos + 4);
    this.pos += 8;
  }

  /**
   * Write a varint. Can be max 64-bits. Numbers are coerced to an unsigned
   * while number before using this function.
   * @param val - any whole unsigned number. It's usually best practice to
   * not use this function directly unless you know what you're doing.
   */
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

  /**
   * Write a signed varint. Can be max 64-bits. Numbers can be negative
   * but must still be a while number.
   * @param val - any whole signed number. It's usually best practice to
   * not use this function directly unless you know what you're doing.
   */
  writeSVarint(val: number): void {
    this.writeVarint(val < 0 ? -val * 2 - 1 : val * 2);
  }

  /**
   * Write a boolean value. Can also be a number, in which case
   * it will be converted to a boolean. 0 is false, anything else is true.
   * @param val - the boolean to write.
   */
  writeBoolean(val: boolean | number): void {
    const bool = Boolean(val);
    this.writeVarint(Number(bool));
  }

  /**
   * Write a string. Strings larger then 128 bytes will be written
   * in chunks of 128 bytes and are slightly less efficient.
   * @param str - the string to write
   */
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

  /**
   * Write a 32-bit floating point number
   * @param val - a 32-bit floating point number to write
   */
  writeFloat(val: number): void {
    this.realloc(4);
    ieee754.write(this.buf, val, this.pos, true, 23, 4);
    this.pos += 4;
  }

  /**
   * Write a 64-bit floating point number
   * @param val - a 64-bit floating point number to write
   */
  writeDouble(val: number): void {
    this.realloc(8);
    ieee754.write(this.buf, val, this.pos, true, 52, 8);
    this.pos += 8;
  }

  /**
   * Write a byte array
   * @param buf - a Buffer to write. Will write the length of the buffer first.
   * After that, the buffer will be written byte by byte.
   */
  writeBytes(buf: Buffer): void {
    const len = buf.length;
    this.writeVarint(len);
    this.realloc(len);
    for (let i = 0; i < len; i++) this.buf[this.pos++] = buf[i];
  }

  /**
   * Write a message to the buffer. Allows you to pass in an object
   * with a write function to define how the message should be written.
   * A good tool to abstract away storing classes or sub-classes.
   * @param fn - the user defined function to call to write the message
   * @param obj - the object to pass to the user defined function
   */
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

  /**
   * Write a message to the buffer. Allows you to pass in an object
   * with a write function to define how the message should be written.
   * A good tool to abstract away storing classes or sub-classes.
   * @param tag - the tag to write to associate with the message. This will help track how to
   * read following data.
   * @param fn - user defined function to call to manually define how to write the object
   * @param obj - the object to pass to the user defined function
   */
  writeMessage<T>(tag: number, fn: (obj: T, pbf: Pbf) => void, obj: T): void {
    this.writeTag(tag, Pbf.Bytes);
    this.writeRawMessage(fn, obj);
  }

  /**
   * Write a packed repeated unsigned whole number array to the buffer.
   * @param tag - the tag to write to associate with the value.
   * @param arr - the array of unsigned whole numbers to write.
   */
  writePackedVarint(tag: number, arr: number[]): void {
    this.writeMessage(tag, writePackedVarint, arr);
  }

  /**
   * Write a packed repeated signed whole number array to the buffer.
   * @param tag - the tag to write to associate with the value.
   * @param arr - the array of signed whole numbers to write.
   */
  writePackedSVarint(tag: number, arr: number[]): void {
    this.writeMessage(tag, writePackedSVarint, arr);
  }

  /**
   * Write a packed repeated boolean array to the buffer.
   * Supports numbers: `0` is false, everything else is true.
   * @param tag - the tag to write to associate with the value.
   * @param arr - the array of booleans to write.
   */
  writePackedBoolean(tag: number, arr: (number | boolean)[]): void {
    this.writeMessage(tag, writePackedBoolean, arr);
  }

  /**
   * Write a packed repeated 32-bit float array to the buffer.
   * @param tag - the tag to write to associate with the value.
   * @param arr - the array of floats to write.
   */
  writePackedFloat(tag: number, arr: number[]): void {
    this.writeMessage(tag, writePackedFloat, arr);
  }

  /**
   * Write a packed repeated 64-bit double array to the buffer.
   * @param tag - the tag to write to associate with the value.
   * @param arr - the array of doubles to write.
   */
  writePackedDouble(tag: number, arr: number[]): void {
    this.writeMessage(tag, writePackedDouble, arr);
  }

  /**
   * Write a packed repeated 32-bit unsigned integer array to the buffer.
   * @param tag - the tag to write to associate with the value.
   * @param arr - the array of unsigned 32-bit numbers to write.
   */
  writePackedFixed32(tag: number, arr: number[]): void {
    this.writeMessage(tag, writePackedFixed32, arr);
  }

  /**
   * Write a packed repeated 32-bit signed integer array to the buffer.
   * @param tag - the tag to write to associate with the value.
   * @param arr - the array of signed 32-bit numbers to write.
   */
  writePackedSFixed32(tag: number, arr: number[]): void {
    this.writeMessage(tag, writePackedSFixed32, arr);
  }

  /**
   * Write a packed repeated 64-bit unsigned integer array to the buffer.
   * @param tag - the tag to write to associate with the value.
   * @param arr - the array of unsigned 64-bit numbers to write.
   */
  writePackedFixed64(tag: number, arr: number[]): void {
    this.writeMessage(tag, writePackedFixed64, arr);
  }

  /**
   * Write a packed repeated 64-bit signed integer array to the buffer.
   * @param tag - the tag to write to associate with the value.
   * @param arr - the array of signed 64-bit numbers to write.
   */
  writePackedSFixed64(tag: number, arr: number[]): void {
    this.writeMessage(tag, writePackedSFixed64, arr);
  }

  /**
   * Write a packed repeated byte array to the buffer with
   * an associated tag.
   * @param tag - the tag to write to associate with the value.
   * @param buffer - the buffer of bytes to write.
   */
  writeBytesField(tag: number, buffer: Buffer): void {
    this.writeTag(tag, Pbf.Bytes);
    this.writeBytes(buffer);
  }

  /**
   * write a packed repeated fixed 32-bit integer array to the buffer
   * with an associated tag.
   * @param tag - the tag to write to associate with the value.
   * @param val - the unsigned 32-bit integer to write.
   */
  writeFixed32Field(tag: number, val: number): void {
    this.writeTag(tag, Pbf.Fixed32);
    this.writeFixed32(val);
  }

  /**
   * Write a packed repeated signed 32-bit integer array to the buffer
   * with an associated tag.
   * @param tag - the tag to write to associate with the value.
   * @param val - the signed 32-bit integer to write.
   */
  writeSFixed32Field(tag: number, val: number): void {
    this.writeTag(tag, Pbf.Fixed32);
    this.writeSFixed32(val);
  }

  /**
   * Write a packed repeated unsigned 64-bit integer array to the buffer
   * with an associated tag.
   * @param tag - the tag to write to associate with the value.
   * @param val - the unsigned 64-bit integer to write.
   */
  writeFixed64Field(tag: number, val: number): void {
    this.writeTag(tag, Pbf.Fixed64);
    this.writeFixed64(val);
  }

  /**
   * Write a packed repeated signed 64-bit integer array to the buffer
   * with an associated tag.
   * @param tag - the tag to write to associate with the value.
   * @param val - the signed 64-bit integer to write.
   */
  writeSFixed64Field(tag: number, val: number): void {
    this.writeTag(tag, Pbf.Fixed64);
    this.writeSFixed64(val);
  }

  /**
   * Write a packed repeated unsigned integer array to the buffer
   * with an associated tag.
   * @param tag - the tag to write to associate with the value.
   * @param val - the unsigned number to write.
   */
  writeVarintField(tag: number, val: number): void {
    this.writeTag(tag, Pbf.Varint);
    this.writeVarint(val);
  }

  /**
   * Write a packed repeated signed integer array to the buffer
   * with an associated tag.
   * @param tag - the tag to write to associate with the value.
   * @param val - the signed number to write.
   */
  writeSVarintField(tag: number, val: number): void {
    this.writeTag(tag, Pbf.Varint);
    this.writeSVarint(val);
  }

  /**
   * Write a packed repeated string array to the buffer
   * with an associated tag.
   * @param tag - the tag to write to associate with the value.
   * @param str - the string to write.
   */
  writeStringField(tag: number, str: string): void {
    this.writeTag(tag, Pbf.Bytes);
    this.writeString(str);
  }

  /**
   * Write a packed repeated float array to the buffer
   * with an associated tag.
   * @param tag - the tag to write to associate with the value.
   * @param val - the float to write.
   */
  writeFloatField(tag: number, val: number): void {
    this.writeTag(tag, Pbf.Fixed32);
    this.writeFloat(val);
  }

  /**
   * Write a packed repeated double array to the buffer
   * with an associated tag.
   * @param tag - the tag to write to associate with the value.
   * @param val - the double to write.
   */
  writeDoubleField(tag: number, val: number): void {
    this.writeTag(tag, Pbf.Fixed64);
    this.writeDouble(val);
  }

  /**
   * Write a packed repeated boolean array to the buffer
   * with an associated tag.
   * @param tag - the tag to write to associate with the value.
   * @param val - the boolean to write.
   */
  writeBooleanField(tag: number, val: boolean | number): void {
    this.writeVarintField(tag, Number(val));
  }
}

/**
 * @param l - the low 32 bits of the number
 * @param s - the signedness
 * @param p - the protobuf
 * @returns - the decoded remainder
 */
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

  throw new Error('Expected varint not more than 10 bytes');
}

/**
 * @param pbf - the protobuf
 * @returns - the end of the packed array
 */
function readPackedEnd(pbf: Pbf): number {
  return pbf.type === Pbf.Bytes ? pbf.readVarint() + pbf.pos : pbf.pos + 1;
}

/**
 * @param low - the low 32 bits of the number
 * @param high - the high 32 bits of the number
 * @param isSigned - whether the number is signed
 * @returns - the decoded number
 */
function toNum(low: number, high: number, isSigned: boolean): number {
  if (isSigned) {
    return high * 0x100000000 + (low >>> 0);
  }

  return (high >>> 0) * 0x100000000 + (low >>> 0);
}

/**
 * @param val - the number
 * @param pbf - the protobuf
 */
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

/**
 * @param low - lower 32 bits
 * @param _high - unused "high" bits
 * @param pbf - the Protobuf class
 */
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

/**
 * @param high - the high 32 bits
 * @param pbf - the Protobuf class
 */
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

/**
 * @param startPos - the start position
 * @param len - the length to make room for
 * @param pbf - the Protobuf class
 */
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

/**
 * @param arr - the array of numbers to write
 * @param pbf - the Protobuf class
 */
function writePackedVarint(arr: number[], pbf: Pbf): void {
  for (let i = 0; i < arr.length; i++) pbf.writeVarint(arr[i]);
}
/**
 * @param arr - the array of numbers to write
 * @param pbf - the Protobuf class
 */
function writePackedSVarint(arr: number[], pbf: Pbf): void {
  for (let i = 0; i < arr.length; i++) pbf.writeSVarint(arr[i]);
}
/**
 * @param arr - the array of numbers to write
 * @param pbf - the Protobuf class
 */
function writePackedFloat(arr: number[], pbf: Pbf): void {
  for (let i = 0; i < arr.length; i++) pbf.writeFloat(arr[i]);
}
/**
 * @param arr - the array of numbers to write
 * @param pbf - the Protobuf class
 */
function writePackedDouble(arr: number[], pbf: Pbf): void {
  for (let i = 0; i < arr.length; i++) pbf.writeDouble(arr[i]);
}
/**
 * @param arr - the array of numbers to write
 * @param pbf - the Protobuf class
 */
function writePackedBoolean(arr: (number | boolean)[], pbf: Pbf): void {
  for (let i = 0; i < arr.length; i++) pbf.writeBoolean(arr[i]);
}
/**
 * @param arr - the array of numbers to write
 * @param pbf - the Protobuf class
 */
function writePackedFixed32(arr: number[], pbf: Pbf): void {
  for (let i = 0; i < arr.length; i++) pbf.writeFixed32(arr[i]);
}
/**
 * @param arr - the array of numbers to write
 * @param pbf - the Protobuf class
 */
function writePackedSFixed32(arr: number[], pbf: Pbf): void {
  for (let i = 0; i < arr.length; i++) pbf.writeSFixed32(arr[i]);
}
/**
 * @param arr - the array of numbers to write
 * @param pbf - the Protobuf class
 */
function writePackedFixed64(arr: number[], pbf: Pbf): void {
  for (let i = 0; i < arr.length; i++) pbf.writeFixed64(arr[i]);
}
/**
 * @param arr - the array of numbers to write
 * @param pbf - the Protobuf class
 */
function writePackedSFixed64(arr: number[], pbf: Pbf): void {
  for (let i = 0; i < arr.length; i++) pbf.writeSFixed64(arr[i]);
}

// Buffer code below from https://github.com/feross/buffer, MIT-licensed

/**
 * @param buf - the buffer of bytes to read
 * @param pos - the position in the buffer to read from
 * @returns - the unsigned 32-bit number
 */
function readUInt32(buf: Uint8Array, pos: number): number {
  return (buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16)) + buf[pos + 3] * 0x1000000;
}

/**
 * @param buf - the buffer of bytes to write
 * @param val - the unsigned 32-bit number
 * @param pos - the position in the buffer to write
 */
function writeInt32(buf: Uint8Array, val: number, pos: number): void {
  buf[pos] = val;
  buf[pos + 1] = val >>> 8;
  buf[pos + 2] = val >>> 16;
  buf[pos + 3] = val >>> 24;
}

/**
 * @param buf - the buffer of bytes to read
 * @param pos - the position in the buffer to read from
 * @returns - the signed 32-bit number
 */
function readInt32(buf: Uint8Array, pos: number): number {
  return (buf[pos] | (buf[pos + 1] << 8) | (buf[pos + 2] << 16)) + (buf[pos + 3] << 24);
}

/**
 * Read UTF-8 string from buffer at "pos" till "end"
 * @param buf - the buffer of bytes
 * @param pos - the position in the buffer to read from
 * @param end - the position in the buffer to stop at
 * @returns - the utf-8 string
 */
function readUtf8(buf: Uint8Array, pos: number, end: number): string {
  let str = '';
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

/**
 * Write a utf8 string to the buffer
 * @param buf - the buffer of bytes
 * @param str - the string to write
 * @param pos - the position in the buffer to start write to
 * @returns - new position in the buffer
 */
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
