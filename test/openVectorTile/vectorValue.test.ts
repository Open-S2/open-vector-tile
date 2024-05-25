import { Pbf } from '../../src/pbf';
import {
  ColumnCacheReader,
  ColumnCacheWriter,
  ColumnValue,
  OColumnBaseChunk,
  OColumnName,
} from '../../src/openVectorTile/columnCache';
import { describe, expect, it } from 'bun:test';
import { encodeShape, readShape } from '../../src/openVectorTile/vectorValue';

import type { OValue } from '../../src/vectorTile.spec';

describe('encodeShape and decodeValue', () => {
  const pbf = new Pbf();
  const col = new ColumnCacheWriter();
  const exampleValue = {
    a: 3,
    b: 1,
    c: 2,
  };

  encodeShape(col, exampleValue);
  // Next we store the column in a pbf
  col.write(col, pbf);
  const rawData = pbf.commit();

  it('encodedValue stored in pbf', () => {
    expect(rawData).toEqual(
      new Uint8Array([
        2, 1, 97, 2, 1, 98, 2, 1, 99, 8, 1, 8, 2, 8, 3, 66, 7, 13, 0, 6, 1, 6, 2, 6, 66, 3, 2, 0, 1,
      ]),
    );
  });

  it('encodedValue stored in column', () => {
    expect(col[OColumnName.string]).toEqual(
      new Map<string, OColumnBaseChunk<string>>([
        ['a', { col: OColumnName.string, data: 'a', index: 0, count: 1 }],
        ['b', { col: OColumnName.string, data: 'b', index: 1, count: 1 }],
        ['c', { col: OColumnName.string, data: 'c', index: 2, count: 1 }],
      ]),
    );
    expect(col[OColumnName.unsigned]).toEqual(
      new Map<number, OColumnBaseChunk<number>>([
        [1, { col: OColumnName.unsigned, data: 1, index: 0, count: 1 }],
        [2, { col: OColumnName.unsigned, data: 2, index: 1, count: 1 }],
        [3, { col: OColumnName.unsigned, data: 3, index: 2, count: 1 }],
      ]),
    );
    expect(col[OColumnName.shapes]).toEqual(
      new Map([
        [
          '[13,0,6,1,6,2,6]',
          {
            col: 8,
            count: 1,
            data: [13, 0, 6, 1, 6, 2, 6],
            index: 0,
          },
        ],
        [
          '[{"col":1,"data":3},{"col":1,"data":1},{"col":1,"data":2}]',
          {
            col: 8,
            count: 1,
            data: [
              {
                col: 1,
                count: 1,
                data: 3,
                index: 2,
              },
              {
                col: 1,
                count: 1,
                data: 1,
                index: 0,
              },
              {
                col: 1,
                count: 1,
                data: 2,
                index: 1,
              },
            ],
            index: 1,
          },
        ],
      ]),
    );
  });

  // Now we decode the column
  const newPbf = new Pbf(rawData);
  const newCol = new ColumnCacheReader(newPbf);

  it('new Column is build correctly', () => {
    expect(newCol[OColumnName.string]).toEqual([{ pos: 1 }, { pos: 4 }, { pos: 7 }]);
    expect(newCol[OColumnName.unsigned]).toEqual([{ pos: 10 }, { pos: 12 }, { pos: 14 }]);
    expect(newCol[OColumnName.shapes]).toEqual([{ pos: 16 }, { pos: 25 }]);
  });

  it('decodeValue works', () => {
    const decodedValue: OValue = newCol.getColumn(OColumnName.shapes, 0);
    expect(decodedValue).toEqual([13, 0, 6, 1, 6, 2, 6]);
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

  encodeShape(col, exampleValue);
  // Next we store the column in a pbf
  col.write(col, pbf);
  const rawData = pbf.commit();

  // Now we decode the column
  const newPbf = new Pbf(rawData);
  const newCol = new ColumnCacheReader(newPbf);

  const returnedValue = newCol.getColumn(OColumnName.shapes, 0);
  expect(returnedValue).toEqual([
    25, 0, 22, 1, 22, 2, 22, 3, 2, 5, 20, 2, 2, 2, 2, 2, 10, 13, 11, 6, 12, 10, 13, 18,
  ]);
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
        ['a', { col: 0, data: 'a', index: 0, count: 2 }],
        ['b', { col: 0, data: 'b', index: 1, count: 2 }],
        ['c', { col: 0, data: 'c', index: 2, count: 2 }],
      ]),
    );
    expect(col[OColumnName.unsigned]).toEqual(
      new Map<number, OColumnBaseChunk<number>>([
        [
          3,
          {
            col: 1,
            data: 3,
            index: 3,
            count: 1,
          },
        ],
        [
          1,
          {
            col: 1,
            data: 1,
            index: 2,
            count: 1,
          },
        ],
        [
          2,
          {
            col: 1,
            data: 2,
            index: 0,
            count: 2,
          },
        ],
        [
          5,
          {
            col: 1,
            data: 5,
            index: 4,
            count: 1,
          },
        ],
        [
          0,
          {
            col: 1,
            data: 0,
            index: 1,
            count: 1,
          },
        ],
      ]),
    );
    expect(col[OColumnName.indices]).toEqual(new Map([]));
    expect(col[OColumnName.shapes]).toEqual(
      new Map<string, OColumnBaseChunk<ColumnValue[]>>([
        [
          '[13,0,6,1,6,2,6]',
          {
            col: 8,
            count: 2,
            data: [13, 0, 6, 1, 6, 2, 6],
            index: 0,
          },
        ],
        [
          '[{"col":1,"data":3},{"col":1,"data":1},{"col":1,"data":2}]',
          {
            col: 8,
            count: 1,
            data: [
              {
                col: 1,
                count: 1,
                data: 3,
                index: 3,
              },
              {
                col: 1,
                count: 1,
                data: 1,
                index: 2,
              },
              {
                col: 1,
                count: 2,
                data: 2,
                index: 0,
              },
            ],
            index: 1,
          },
        ],
        [
          '[{"col":1,"data":5},{"col":1,"data":2},{"col":1,"data":0}]',
          {
            col: 8,
            count: 1,
            data: [
              {
                col: 1,
                count: 1,
                data: 5,
                index: 4,
              },
              {
                col: 1,
                count: 2,
                data: 2,
                index: 0,
              },
              {
                col: 1,
                count: 1,
                data: 0,
                index: 1,
              },
            ],
            index: 2,
          },
        ],
      ]),
    );
  });

  // raw data
  it('rawData is encoded to pbf', () => {
    expect(rawData).toEqual(
      new Uint8Array([
        2, 1, 97, 2, 1, 98, 2, 1, 99, 8, 2, 8, 0, 8, 1, 8, 3, 8, 5, 66, 7, 13, 0, 6, 1, 6, 2, 6, 66,
        3, 3, 2, 0, 66, 3, 4, 0, 1,
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
      g: 3.3,
      h: -1,
      i: 2,
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
        111, 114, 108, 100, 8, 2, 8, 3, 16, 199, 1, 16, 1, 33, 154, 153, 153, 153, 153, 153, 1, 64,
        33, 102, 102, 102, 102, 102, 102, 10, 64, 66, 24, 25, 0, 22, 1, 22, 2, 22, 3, 2, 5, 20, 2,
        2, 2, 2, 2, 10, 13, 11, 18, 12, 10, 13, 6, 66, 12, 2, 1, 0, 4, 6, 7, 8, 9, 3, 1, 1, 0, 66,
        12, 2, 0, 1, 14, 12, 5, 9, 9, 7, 0, 0, 1,
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
