import { Pbf as Protobuf } from '../src/pbf';
import { expect, test } from 'bun:test';

test('constructor', () => {
  const pbf = new Protobuf();
  expect(pbf.buf).toEqual(new Uint8Array(0));
});

test('destroy', () => {
  const pbf = new Protobuf();
  pbf.buf = new Uint8Array(10);
  expect(pbf.buf).toEqual(new Uint8Array(10));
  pbf.destroy();
  expect(pbf.buf).toEqual(new Uint8Array(0));
});

test('realloc', () => {
  const pbf = new Protobuf();
  pbf.realloc(10);
  // will always be in 16 byte increments
  expect(pbf.buf).toEqual(new Uint8Array(16));

  const pbf2 = new Protobuf();
  pbf2.realloc(50);
  expect(pbf2.buf).toEqual(new Uint8Array(64));
});

test('commit', () => {
  const pbf = new Protobuf();
  pbf.writeVarint(1);
  expect(pbf.commit()).toEqual(new Uint8Array([1]));
});

test('writeTag', () => {
  const pbf = new Protobuf();
  pbf.writeTag(1, 2);
  expect(pbf.commit()).toEqual(new Uint8Array([10]));
});

test('writeFixed32 & readFixed32', () => {
  const pbf = new Protobuf();
  pbf.writeFixed32(1);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([1, 0, 0, 0]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readFixed32()).toEqual(1);
});

test('writeSFixed32 & readSFixed32', () => {
  const pbf = new Protobuf();
  pbf.writeSFixed32(-1);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([255, 255, 255, 255]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readSFixed32()).toEqual(-1);
});

// writeFixed64
test('writeFixed64 & readFixed64', () => {
  const pbf = new Protobuf();
  pbf.writeFixed64(1);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([1, 0, 0, 0, 0, 0, 0, 0]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readFixed64()).toEqual(1);
});

// writeSFixed64
test('writeSFixed64 & readSFixed64', () => {
  const pbf = new Protobuf();
  pbf.writeSFixed64(-1);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([255, 255, 255, 255, 255, 255, 255, 255]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readSFixed64()).toEqual(-1);
});

// writeVarint
test('writeVarint & readVarint', () => {
  const pbf = new Protobuf();
  pbf.writeVarint(1);
  pbf.writeVarint(849383);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([1, 231, 235, 51]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readVarint()).toEqual(1);
  expect(pbf2.readVarint()).toEqual(849383);
});

// writeVarint LARGE
test('writeVarint & readVarint LARGE', () => {
  const pbf = new Protobuf();
  pbf.writeVarint(839483929049384);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([168, 242, 138, 171, 153, 240, 190, 1]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readVarint64()).toEqual(839483929049384);
});

// writeSVarint
test('writeSVarint & readSVarint', () => {
  const pbf = new Protobuf();
  pbf.writeSVarint(-1);
  pbf.writeSVarint(-849383);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([1, 205, 215, 103]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readSVarint()).toEqual(-1);
  expect(pbf2.readSVarint()).toEqual(-849383);
});

// writeBoolean
test('writeBoolean & readBoolean', () => {
  const pbf = new Protobuf();
  pbf.writeBoolean(true);
  pbf.writeBoolean(false);
  pbf.writeBoolean(0);
  pbf.writeBoolean(100);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([1, 0, 0, 1]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readBoolean()).toEqual(true);
  expect(pbf2.readBoolean()).toEqual(false);
  expect(pbf2.readBoolean()).toEqual(false);
  expect(pbf2.readBoolean()).toEqual(true);
});

// writeString
test('writeString & readString', () => {
  const pbf = new Protobuf();
  pbf.writeString('hello');
  pbf.writeString('world');
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([5, 104, 101, 108, 108, 111, 5, 119, 111, 114, 108, 100]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readString()).toEqual('hello');
  expect(pbf2.readString()).toEqual('world');
});

// writeString LONG
test('writeString & readString LONG', () => {
  const pbf = new Protobuf();
  const str =
    'This is a long paragraph of random text that needs to be longer then you would assume to make sure it works correctly. Seems like this is not long enough yet so let us keep going';
  pbf.writeString(str);
  const data = pbf.commit();
  const pbf2 = new Protobuf(data);
  expect(pbf2.readString()).toEqual(str);
});

// writeFloat
test('writeFloat & readFloat', () => {
  const pbf = new Protobuf();
  pbf.writeFloat(1.234);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([182, 243, 157, 63]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readFloat()).toBeCloseTo(1.234);
});

// writeDouble
test('writeDouble & readDouble', () => {
  const pbf = new Protobuf();
  pbf.writeDouble(-1.234);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([88, 57, 180, 200, 118, 190, 243, 191]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readDouble()).toBeCloseTo(-1.234);
});

// writeBytes
test('writeBytes & readBytes', () => {
  const pbf = new Protobuf();
  pbf.writeBytes(Buffer.from([1, 2, 3]));
  const data = pbf.commit();
  expect(data).toEqual(Buffer.from([3, 1, 2, 3]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readBytes()).toEqual(Buffer.from([1, 2, 3]));
});

// writePackedVarint
test('writePackedVarint & readPackedVarint', () => {
  const pbf = new Protobuf();
  pbf.writePackedVarint(22, [1, 2, 3]);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([178, 1, 3, 1, 2, 3]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 22, type: Protobuf.Bytes });
  expect(pbf2.readPackedVarint()).toEqual([1, 2, 3]);
});

// writePackedSVarint
test('writePackedSVarint & readPackedSVarint', () => {
  const pbf = new Protobuf();
  pbf.writePackedSVarint(5, [-1, -2, -3]);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([42, 3, 1, 3, 5]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Bytes });
  expect(pbf2.readPackedSVarint()).toEqual([-1, -2, -3]);
});

// writePackedBoolean
test('writePackedBoolean & readPackedBoolean', () => {
  const pbf = new Protobuf();
  pbf.writePackedBoolean(5, [true, false, true, 0, 22]);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([42, 5, 1, 0, 1, 0, 1]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Bytes });
  expect(pbf2.readPackedBoolean()).toEqual([true, false, true, false, true]);
});

// writePackedFloat
test('writePackedFloat & readPackedFloat', () => {
  const pbf = new Protobuf();
  pbf.writePackedFloat(5, [1.1, -2.2, 3.3]);
  const data = pbf.commit();
  expect(data).toEqual(
    new Uint8Array([42, 12, 205, 204, 140, 63, 205, 204, 12, 192, 51, 51, 83, 64]),
  );
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Bytes });
  expect(pbf2.readPackedFloat()).toEqual([
    1.100000023841858, -2.200000047683716, 3.299999952316284,
  ]);
});

// writePackedDouble
test('writePackedDouble & readPackedDouble', () => {
  const pbf = new Protobuf();
  pbf.writePackedDouble(5, [1.1, -2.2, 3.3]);
  const data = pbf.commit();
  expect(data).toEqual(
    new Uint8Array([
      42, 24, 154, 153, 153, 153, 153, 153, 241, 63, 154, 153, 153, 153, 153, 153, 1, 192, 102, 102,
      102, 102, 102, 102, 10, 64,
    ]),
  );
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Bytes });
  expect(pbf2.readPackedDouble()).toEqual([1.1, -2.2, 3.3]);
});

// writePackedFixed32
test('writePackedFixed32 & readPackedFixed32', () => {
  const pbf = new Protobuf();
  pbf.writePackedFixed32(5, [1, 2, 3]);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([42, 12, 1, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Bytes });
  expect(pbf2.readPackedFixed32()).toEqual([1, 2, 3]);
});

// writePackedSFixed32
test('writePackedSFixed32 & readPackedSFixed32', () => {
  const pbf = new Protobuf();
  pbf.writePackedSFixed32(5, [1, -2, 3]);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([42, 12, 1, 0, 0, 0, 254, 255, 255, 255, 3, 0, 0, 0]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Bytes });
  expect(pbf2.readPackedSFixed32()).toEqual([1, -2, 3]);
});

// writePackedFixed64
test('writePackedFixed64 & readPackedFixed64', () => {
  const pbf = new Protobuf();
  pbf.writePackedFixed64(5, [1, 2, 3]);
  const data = pbf.commit();
  expect(data).toEqual(
    new Uint8Array([
      42, 24, 1, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0,
    ]),
  );
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Bytes });
  expect(pbf2.readPackedFixed64()).toEqual([1, 2, 3]);
});

// writePackedSFixed64
test('writePackedSFixed64 & readPackedSFixed64', () => {
  const pbf = new Protobuf();
  pbf.writePackedSFixed64(5, [1, -2, 3]);
  const data = pbf.commit();
  expect(data).toEqual(
    new Uint8Array([
      42, 24, 1, 0, 0, 0, 0, 0, 0, 0, 254, 255, 255, 255, 255, 255, 255, 255, 3, 0, 0, 0, 0, 0, 0,
      0,
    ]),
  );
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Bytes });
  expect(pbf2.readPackedSFixed64()).toEqual([1, -2, 3]);
});

// writeBytesField
test('writeBytesField & readBytes', () => {
  const pbf = new Protobuf();
  pbf.writeBytesField(5, Buffer.from([1, 2, 3]));
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([42, 3, 1, 2, 3]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Bytes });
  expect(pbf2.readBytes()).toEqual(Buffer.from([1, 2, 3]));
});

// writeFixed32Field
test('writeFixed32Field & readFixed32', () => {
  const pbf = new Protobuf();
  pbf.writeFixed32Field(5, 1);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([45, 1, 0, 0, 0]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Fixed32 });
  expect(pbf2.readFixed32()).toEqual(1);
});

// writeSFixed32Field
test('writeSFixed32Field & readSFixed32', () => {
  const pbf = new Protobuf();
  pbf.writeSFixed32Field(5, -1);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([45, 255, 255, 255, 255]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Fixed32 });
  expect(pbf2.readSFixed32()).toEqual(-1);
});

// writeFixed64Field
test('writeFixed64Field & readFixed64', () => {
  const pbf = new Protobuf();
  pbf.writeFixed64Field(5, 1);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([41, 1, 0, 0, 0, 0, 0, 0, 0]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Fixed64 });
  expect(pbf2.readFixed64()).toEqual(1);
});

// writeSFixed64Field
test('writeSFixed64Field & readSFixed64', () => {
  const pbf = new Protobuf();
  pbf.writeSFixed64Field(5, -1);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([41, 255, 255, 255, 255, 255, 255, 255, 255]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Fixed64 });
  expect(pbf2.readSFixed64()).toEqual(-1);
});

// writeVarintField
test('writeVarintField & readVarint', () => {
  const pbf = new Protobuf();
  pbf.writeVarintField(5, 1);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([40, 1]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Varint });
  expect(pbf2.readVarint()).toEqual(1);
});

// writeSVarintField
test('writeSVarintField & readSVarint', () => {
  const pbf = new Protobuf();
  pbf.writeSVarintField(5, -1);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([40, 1]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Varint });
  expect(pbf2.readSVarint()).toEqual(-1);
});

// writeStringField
test('writeStringField & readString', () => {
  const pbf = new Protobuf();
  pbf.writeStringField(5, 'test');
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([42, 4, 116, 101, 115, 116]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Bytes });
  expect(pbf2.readString()).toEqual('test');
});

// writeFloatField
test('writeFloatField & readFloat', () => {
  const pbf = new Protobuf();
  pbf.writeFloatField(5, 1);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([45, 0, 0, 128, 63]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Fixed32 });
  expect(pbf2.readFloat()).toEqual(1);
});

// writeDoubleField
test('writeDoubleField & readDouble', () => {
  const pbf = new Protobuf();
  pbf.writeDoubleField(5, 1);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([41, 0, 0, 0, 0, 0, 0, 240, 63]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Fixed64 });
});

// writeBooleanField
test('writeBooleanField & readBoolean', () => {
  const pbf = new Protobuf();
  pbf.writeBooleanField(5, 1);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([40, 1]));
  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Varint });
  expect(pbf2.readBoolean()).toEqual(true);
});

// writeMessage
test('writeMessage & (readMessage/readFields)', () => {
  /**
   * Building a class to test with.
   */
  class Test {
    a = 0;
    b = 0;
    c = 0;
    /**
     * @param pbf - the Protobuf object to read from
     * @param end - the position to stop at
     */
    constructor(pbf: Protobuf, end = 0) {
      pbf.readFields(Test.read, this, end);
    }
    /**
     * @param t - the test object to write.
     * @param pbf - the Protobuf object to write to.
     */
    static writeMessage(t: Test, pbf: Protobuf): void {
      pbf.writeVarintField(1, t.a);
      pbf.writeFloatField(2, t.b);
      pbf.writeSVarintField(3, t.c);
    }

    /**
     * @param tag - the tag to read.
     * @param test - the test to modify
     * @param pbf - the Protobuf object to read from
     */
    static read(tag: number, test: Test, pbf: Protobuf): void {
      if (tag === 1) test.a = pbf.readVarint();
      else if (tag === 2) test.b = pbf.readFloat();
      else if (tag === 3) test.c = pbf.readSVarint();
      else throw new Error(`Unexpected tag: ${tag}`);
    }

    /**
     * @returns - a new test object
     */
    static newTest(): Test {
      return { a: 1, b: 2.2, c: -3 } as Test;
    }

    /**
     * @returns - a new default test object
     */
    static newTestDefault(): Test {
      return { a: 0, b: 0, c: 0 } as Test;
    }
  }

  const pbf = new Protobuf();
  const t = Test.newTest();
  pbf.writeMessage(5, Test.writeMessage, t);
  const data = pbf.commit();
  expect(data).toEqual(new Uint8Array([42, 9, 8, 1, 21, 205, 204, 12, 64, 24, 5]));

  const pbf2 = new Protobuf(data);
  expect(pbf2.readTag()).toEqual({ tag: 5, type: Protobuf.Bytes });
  const t2 = new Test(pbf2, pbf2.readVarint() + pbf2.pos);
  expect(t2).toEqual({ a: 1, b: 2.200000047683716, c: -3 } as Test);

  const pbf3 = new Protobuf(data);
  const t3 = Test.newTestDefault();
  expect(pbf3.readTag()).toEqual({ tag: 5, type: Protobuf.Bytes });
  pbf3.readMessage(Test.read, t3);
});
