import { Pbf } from '../../src/pbf';
import { ColumnCacheReader, ColumnCacheWriter } from '../../src/open/columnCache';
import {
  createShapeFromData,
  decodeShape,
  decodeValue,
  encodeShape,
  encodeValue,
  updateShapeFromData,
  validateTypes,
} from '../../src/open/shape';
import { describe, expect, it } from 'bun:test';

import type { OProperties } from '../../src/vectorTile.spec';
import type { Shape } from '../../src/open/shape';

describe('encodeShape and decodeShape', () => {
  it('encodes + decodes simple shape', () => {
    const pbf = new Pbf();
    const col = new ColumnCacheWriter();
    const basicShape: Shape = {
      a: 'i64',
      b: ['string'],
      c: {
        d: 'f64',
        e: 'bool',
        f: 'null',
      },
    };
    const encodedShapeIndex = encodeShape(col, basicShape);
    expect(encodedShapeIndex).toEqual(0);

    // store the column in a pbf
    ColumnCacheWriter.write(col, pbf);
    const rawData = pbf.commit();

    // Now we decode the column
    const newPbf = new Pbf(rawData);
    const newCol = new ColumnCacheReader(newPbf);

    const decodedShape = decodeShape(encodedShapeIndex, newCol);
    expect(decodedShape).toEqual(basicShape);
  });
});

describe('encodeValue and decodeValue', () => {
  it('encodes + decodes simple value', () => {
    const pbf = new Pbf();
    const col = new ColumnCacheWriter();
    const exampleShape: Shape = {
      a: 'i64',
      b: 'u64',
      c: 'f64',
    };
    const exampleValue: OProperties = {
      a: 3,
      b: 1,
      c: 2.2,
    };
    const encodedValueIndex = encodeValue(exampleValue, exampleShape, col);

    // store the column in a pbf
    ColumnCacheWriter.write(col, pbf);
    const rawData = pbf.commit();

    // Now we decode the column
    const newPbf = new Pbf(rawData);
    const newCol = new ColumnCacheReader(newPbf);

    const decodedValue = decodeValue(encodedValueIndex, exampleShape, newCol);
    expect(decodedValue).toEqual(exampleValue);
  });

  it('encodes + decodes nested value', () => {
    const pbf = new Pbf();
    const col = new ColumnCacheWriter();
    const exampleShape: Shape = {
      a: 'i64',
      b: ['string'],
      c: {
        d: 'f64',
        e: 'bool',
        f: 'null',
        g: 'f32',
        h: {
          i: 'u64',
        },
      },
    };
    const exampleValue: OProperties = {
      a: 3,
      b: ['hello', 'world'],
      c: {
        d: 2.2,
        e: true,
        f: null,
        g: 4.5,
        h: {
          i: 2,
        },
      },
    };
    const exampleValue2: OProperties = {
      a: -1,
      b: ['word', 'up', 'hello'],
    };
    const encodedValueIndex = encodeValue(exampleValue, exampleShape, col);
    const encodedValueIndex2 = encodeValue(exampleValue2, exampleShape, col);

    // store the column in a pbf
    ColumnCacheWriter.write(col, pbf);
    const rawData = pbf.commit();

    // Now we decode the column
    const newPbf = new Pbf(rawData);
    const newCol = new ColumnCacheReader(newPbf);

    const decodedValue = decodeValue(encodedValueIndex, exampleShape, newCol);
    expect(decodedValue).toEqual(exampleValue);

    const decodedValue2 = decodeValue(encodedValueIndex2, exampleShape, newCol);
    expect(decodedValue2).toEqual({
      ...exampleValue2,
      c: { d: 0, e: false, f: null, g: 0, h: { i: 0 } },
    });
  });
});

describe('createShapeFromData', () => {
  it('createShapeFromData works', () => {
    const props: OProperties = {
      a: 3,
      b: -1,
      c: [1, -1, 2.2, 3],
      d: 'hello',
      e: ['w', 'o', 'r', 'l', 'd'],
      f: {
        g: 3.3,
        h: -1,
        i: 2,
        j: {
          a: null,
        },
      },
      g: null,
      h: false,
      i: true,
      j: [
        { a: 1, b: 2 },
        { a: 3, b: 4 },
      ],
    };
    const shape = createShapeFromData([props]);
    const resultShapeObj: Shape = {
      a: 'u64',
      b: 'i64',
      c: ['f64'],
      d: 'string',
      e: ['string'],
      f: {
        g: 'f64',
        h: 'i64',
        i: 'u64',
        j: {
          a: 'null',
        },
      },
      g: 'null',
      h: 'bool',
      i: 'bool',
      j: [
        {
          a: 'u64',
          b: 'u64',
        },
      ],
    };
    updateShapeFromData(shape, props);
    expect(shape).toEqual(resultShapeObj);
  });
});

describe('test validateTypes failures', () => {
  it('test primitive types', () => {
    expect(() => {
      validateTypes(['i64', 'string']);
    }).toThrowError('All types must be the same');
  });

  it('test array, object, and primitive', () => {
    expect(() => {
      validateTypes(['i64', ['string'], { a: 'i64' }]);
    }).toThrowError('All types must be the same');
    expect(() => {
      validateTypes([['string'], { a: 'i64' }]);
    }).toThrowError('All types must be the same');
    expect(() => {
      validateTypes(['string', { a: 'i64' }]);
    }).toThrowError('All types must be the same');
    expect(() => {
      validateTypes(['null', ['null']]);
    }).toThrowError('All types must be the same');
  });
});
