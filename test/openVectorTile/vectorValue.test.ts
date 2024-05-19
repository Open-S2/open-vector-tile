import { Pbf } from '../../src/pbf';
import {
  ColumnCacheReader,
  ColumnCacheWriter,
  ColumnValue,
  OColumnBaseChunk,
  OColumnName,
} from '../../src/openVectorTile/columnCache';
import { describe, expect, it } from 'bun:test';
import { encodeShape, encodeValue, readShape } from '../../src/openVectorTile/vectorValue';

import type { OValue } from '../../src/vectorTile.spec';

describe('encodeValue and decodeValue', () => {
  const pbf = new Pbf();
  const col = new ColumnCacheWriter();
  const exampleValue = {
    a: 3,
    b: 1,
    c: 2,
  };

  encodeValue(col, exampleValue);
  // Next we store the column in a pbf
  col.write(col, pbf);
  const rawData = pbf.commit();

  it('encodedValue stored in column', () => {
    expect(col[OColumnName.string]).toEqual(
      new Map<string, OColumnBaseChunk<string>>([
        ['a', { col: OColumnName.string, data: 'a', index: 0 }],
        ['b', { col: OColumnName.string, data: 'b', index: 1 }],
        ['c', { col: OColumnName.string, data: 'c', index: 2 }],
      ]),
    );
    expect(col[OColumnName.unsigned]).toEqual(
      new Map<number, OColumnBaseChunk<number>>([
        [1, { col: OColumnName.unsigned, data: 1, index: 0 }],
        [2, { col: OColumnName.unsigned, data: 2, index: 1 }],
        [3, { col: OColumnName.unsigned, data: 3, index: 2 }],
      ]),
    );
    expect(col[OColumnName.values]).toEqual(
      new Map([
        [
          '[6,3,0,3,{"col":1,"data":3,"index":0},1,3,{"col":1,"data":1,"index":1},2,3,{"col":1,"data":2,"index":2}]',
          {
            col: 7,
            data: [
              6,
              3,
              0,
              3,
              {
                col: 1,
                data: 3,
                index: 2,
              },
              1,
              3,
              {
                col: 1,
                data: 1,
                index: 0,
              },
              2,
              3,
              {
                col: 1,
                data: 2,
                index: 1,
              },
            ],
            index: 0,
          },
        ],
      ]),
    );
  });

  it('encodedValue stored in pbf', () => {
    expect(rawData).toEqual(
      new Uint8Array([
        2, 1, 97, 2, 1, 98, 2, 1, 99, 8, 1, 8, 2, 8, 3, 58, 11, 6, 3, 0, 3, 17, 1, 3, 1, 2, 3, 9,
      ]),
    );
  });

  // Now we decode the column
  const newPbf = new Pbf(rawData);
  const newCol = new ColumnCacheReader(newPbf);

  it('new Column is build correctly', () => {
    expect(newCol[OColumnName.string]).toEqual([{ pos: 1 }, { pos: 4 }, { pos: 7 }]);
    expect(newCol[OColumnName.unsigned]).toEqual([{ pos: 10 }, { pos: 12 }, { pos: 14 }]);
    expect(newCol[OColumnName.values]).toEqual([{ pos: 16 }]);
  });

  it('decodeValue works', () => {
    const decodedValue: OValue = newCol.getColumn(OColumnName.values, 0);
    expect(decodedValue).toEqual({ a: 3, b: 1, c: 2 });
  });

  it('post decode, the column should have read data', () => {
    expect(newCol[OColumnName.string]).toEqual(['a', 'b', 'c']);
    expect(newCol[OColumnName.unsigned]).toEqual([1, 2, 3]);
    expect(newCol[OColumnName.values]).toEqual([{ data: { a: 3, b: 1, c: 2 } }]);
  });
});

describe('encodeValue and decodeValue complex object', () => {
  const pbf = new Pbf();
  const col = new ColumnCacheWriter();
  const exampleValue = {
    a: null,
    b: true,
    c: false,
    d: 'hello',
    e: ['w', 'o', 'r', 'l', 'd'],
    f: {
      g: 3,
      h: -1,
      i: 2.2,
    },
  };

  encodeValue(col, exampleValue);
  // Next we store the column in a pbf
  col.write(col, pbf);
  const rawData = pbf.commit();

  // Now we decode the column
  const newPbf = new Pbf(rawData);
  const newCol = new ColumnCacheReader(newPbf);

  const returnedValue = newCol.getColumn(OColumnName.values, 0);
  expect(returnedValue).toEqual(exampleValue);
});

describe('encodeShape and decodeShape', () => {
  const pbf = new Pbf();
  const col = new ColumnCacheWriter();
  const exampleValue = {
    a: 3,
    b: 1,
    c: 2,
  };
  const exampleValue2 = {
    a: 5,
    b: 2,
    c: 0,
  };

  const [shapeIndex1, valuesIndex1] = encodeShape(col, exampleValue);
  const [shapeIndex2, valuesIndex2] = encodeShape(col, exampleValue2);

  // Next we store the column in a pbf
  col.write(col, pbf);
  const rawData = pbf.commit();

  it('shapeIndexes should be the same; values are unique', () => {
    expect(shapeIndex1).toEqual(shapeIndex2);
    expect(valuesIndex1).toEqual(1);
    expect(valuesIndex2).toEqual(2);
  });

  it('encodedShape stored in column', () => {
    expect(col[OColumnName.string]).toEqual(
      new Map<string, OColumnBaseChunk<string>>([
        ['a', { col: 0, data: 'a', index: 0 }],
        ['b', { col: 0, data: 'b', index: 1 }],
        ['c', { col: 0, data: 'c', index: 2 }],
      ]),
    );
    expect(col[OColumnName.unsigned]).toEqual(
      new Map<number, OColumnBaseChunk<number>>([
        [
          0,
          {
            col: 1,
            data: 0,
            index: 0,
          },
        ],
        [
          1,
          {
            col: 1,
            data: 1,
            index: 1,
          },
        ],
        [
          2,
          {
            col: 1,
            data: 2,
            index: 2,
          },
        ],
        [
          3,
          {
            col: 1,
            data: 3,
            index: 3,
          },
        ],
        [
          5,
          {
            col: 1,
            data: 5,
            index: 4,
          },
        ],
      ]),
    );
    expect(col[OColumnName.indices]).toEqual(
      new Map([
        [
          '[3,0,1,1,1,2,1]',
          {
            col: 6,
            data: [3, 0, 1, 1, 1, 2, 1],
            index: 0,
          },
        ],
        [
          '[0,1,2]',
          {
            col: 6,
            data: [0, 1, 2],
            index: 1,
          },
        ],
        [
          '[3,2,4]',
          {
            col: 6,
            data: [3, 2, 4],
            index: 2,
          },
        ],
      ]),
    );
    expect(col[OColumnName.values]).toEqual(
      new Map<string, OColumnBaseChunk<ColumnValue[]>>([
        [
          '[3,{"col":1,"data":3,"index":0}]',
          {
            col: 7,
            data: [
              3,
              {
                col: 1,
                data: 3,
                index: 3,
              },
            ],
            index: 0,
          },
        ],
        [
          '[3,{"col":1,"data":1,"index":1}]',
          {
            col: 7,
            data: [
              3,
              {
                col: 1,
                data: 1,
                index: 1,
              },
            ],
            index: 1,
          },
        ],
        [
          '[3,{"col":1,"data":2,"index":2}]',
          {
            col: 7,
            data: [
              3,
              {
                col: 1,
                data: 2,
                index: 2,
              },
            ],
            index: 2,
          },
        ],
        [
          '[3,{"col":1,"data":5,"index":3}]',
          {
            col: 7,
            data: [
              3,
              {
                col: 1,
                data: 5,
                index: 4,
              },
            ],
            index: 3,
          },
        ],
        [
          '[3,{"col":1,"data":0,"index":4}]',
          {
            col: 7,
            data: [
              3,
              {
                col: 1,
                data: 0,
                index: 0,
              },
            ],
            index: 4,
          },
        ],
      ]),
    );
  });

  // raw data
  it('rawData is encoded to pbf', () => {
    expect(rawData).toEqual(
      new Uint8Array([
        2, 1, 97, 2, 1, 98, 2, 1, 99, 8, 0, 8, 1, 8, 2, 8, 3, 8, 5, 50, 7, 6, 5, 2, 0, 0, 2, 1, 50,
        3, 0, 2, 2, 50, 3, 6, 1, 4, 58, 2, 3, 25, 58, 2, 3, 9, 58, 2, 3, 17, 58, 2, 3, 33, 58, 2, 3,
        1,
      ]),
    );
  });

  // Now we decode the column
  const newPbf = new Pbf(rawData);
  const newCol = new ColumnCacheReader(newPbf);

  it('decodeShape works', () => {
    const decodedValue = readShape(shapeIndex1, valuesIndex1, newCol);
    expect(decodedValue).toEqual(exampleValue);
    const decodedValue2 = readShape(shapeIndex2, valuesIndex2, newCol);
    expect(decodedValue2).toEqual(exampleValue2);
  });
});

describe('encodeShape and decodeShape complex objects', () => {
  const pbf = new Pbf();
  const col = new ColumnCacheWriter();
  const exampleValue = {
    a: null,
    b: true,
    c: false,
    d: 'hello',
    e: ['w', 'o', 'r', 'l', 'd'],
    f: {
      g: 3,
      h: -1,
      i: 2.2,
    },
  };
  const exampleValue2 = {
    a: null,
    b: false,
    c: true,
    d: 'world',
    e: ['h', 'e', 'l', 'l', 'o'],
    f: {
      g: 2.2,
      h: -100,
      i: 3,
    },
  };

  const [shapeIndex1, valuesIndex1] = encodeShape(col, exampleValue);
  const [shapeIndex2, valuesIndex2] = encodeShape(col, exampleValue2);

  // Next we store the column in a pbf
  col.write(col, pbf);
  const rawData = pbf.commit();

  it('rawData is encoded to pbf', () => {
    expect(rawData).toEqual(
      new Uint8Array([
        2, 1, 97, 2, 1, 98, 2, 1, 99, 2, 1, 100, 2, 5, 104, 101, 108, 108, 111, 2, 1, 101, 2, 1,
        119, 2, 1, 111, 2, 1, 114, 2, 1, 108, 2, 1, 102, 2, 1, 103, 2, 1, 104, 2, 1, 105, 2, 5, 119,
        111, 114, 108, 100, 8, 3, 16, 199, 1, 16, 1, 25, 154, 153, 153, 153, 153, 153, 1, 64, 50,
        20, 12, 11, 2, 0, 0, 2, 1, 4, 3, 8, 7, 18, 19, 6, 16, 19, 22, 21, 24, 23, 50, 8, 0, 2, 2, 2,
        2, 2, 2, 2, 50, 8, 0, 4, 1, 14, 2, 3, 6, 9, 58, 1, 0, 58, 1, 1, 58, 1, 2, 58, 2, 4, 4, 58,
        12, 5, 5, 4, 6, 4, 7, 4, 8, 4, 9, 4, 3, 58, 2, 3, 1, 58, 2, 3, 10, 58, 2, 3, 3, 58, 2, 4,
        14, 58, 12, 5, 5, 4, 12, 4, 5, 4, 9, 4, 9, 4, 7, 58, 2, 3, 2,
      ]),
    );
  });

  it('shapeIndexes should be the same; values are unique', () => {
    expect(shapeIndex1).toEqual(shapeIndex2);
    expect(valuesIndex1).toEqual(1);
    expect(valuesIndex2).toEqual(2);
  });

  // Now we decode the column
  const newPbf = new Pbf(rawData);
  const newCol = new ColumnCacheReader(newPbf);

  it('decodeShape works', () => {
    const decodedValue = readShape(shapeIndex1, valuesIndex1, newCol);
    expect(decodedValue).toEqual(exampleValue);
    const decodedValue2 = readShape(shapeIndex2, valuesIndex2, newCol);
    expect(decodedValue2).toEqual(exampleValue2);
  });
});
