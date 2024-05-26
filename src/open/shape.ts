import { OColumnName } from './columnCache';

import type { ColumnCacheReader, ColumnCacheWriter, ColumnValue } from './columnCache';
import type { OProperties, OValue } from '../vectorTile.spec';

/**
 * Create shapes
 *
 * Used by M-Values
 * Must be an object of key values
 * all keys will be the same, values will be different
 * so we only have to store: [index to shape, bytes (ONLY indexes for values)]
 * @param cache - the cache where all data is stored in a column format
 * @param shape - the shape object to encode
 * @returns - Both the index to a list of key (string) indices and the index to a list of value indices
 */
export function encodeShape(
  cache: ColumnCacheWriter,
  shape: OProperties,
): [shapeIndex: number, valueIndexes: number] {
  const shapeStore: number[] = []; // this will store a "shape" of numbers on how to rebuild the object
  const valueStore: ColumnValue[] = []; // this will store the value index (found in values column)

  _encodeShape(cache, shape, shapeStore, valueStore);

  // return the index of the shape and the value index set
  return [
    cache.addColumnData(OColumnName.shapes, shapeStore),
    cache.addColumnData(OColumnName.shapes, valueStore),
  ];
}

/**
 * Encodes a shape object into a format suitable for storing in a cache.
 * @param cache - the cache where all data is stored in a column format.
 * @param shape - the shape object to encode. Recursively encodes nested objects.
 * @param shapeStore - list of key (string) indices. Also includes if the value is an object or not.
 * @param valueStore - list of value indices.
 */
function _encodeShape(
  cache: ColumnCacheWriter,
  shape: OValue,
  shapeStore: number[],
  valueStore: ColumnValue[],
): void {
  if (Array.isArray(shape)) {
    shapeStore.push(shapeEncode(0, shape.length));
    for (const value of shape) _encodeShape(cache, value, shapeStore, valueStore);
  } else if (typeof shape === 'object' && shape !== null) {
    const entries = Object.entries(shape).filter(([, v]) => v !== undefined);
    shapeStore.push(shapeEncode(1, entries.length));
    for (const [key, value] of entries) {
      // store key
      shapeStore.push(cache.addColumnData(OColumnName.string, key));
      _encodeShape(cache, value, shapeStore, valueStore);
    }
  } else {
    // the shape encodes the type
    let colName = 5;
    if (shape === null) valueStore.push(2);
    else if (shape === false) valueStore.push(0);
    else if (shape === true) valueStore.push(1);
    else if (typeof shape === 'number') {
      const cachedNum = cache.addNumber(shape);
      colName = typeof cachedNum === 'number' ? 0 : cachedNum.col;
      valueStore.push(cachedNum);
    } else if (typeof shape === 'string') {
      colName = 0; // is a string
      valueStore.push(cache.addColumnData(OColumnName.string, shape));
    } else throw Error('Cannot encode value type');
    shapeStore.push(shapeEncode(2, colName));
  }
}

/**
 * @param shapeIndex - the index to the key indices and whether the value is an object or not
 * @param valueIndex - the index to the values column
 * @param cache - the cache where all data is stored in a column format
 * @returns - The shape object
 */
export function readShape(
  shapeIndex: number,
  valueIndex: number,
  cache: ColumnCacheReader,
): OProperties {
  // first get the data from pbf
  const shapeIndices: number[] = cache.getColumn(OColumnName.shapes, shapeIndex);
  const valueIndices: number[] = cache.getColumn(OColumnName.shapes, valueIndex);
  // then decode it
  const value: { data: OValue } = { data: {} };
  _readShape([...shapeIndices], [...valueIndices], value, cache);

  return value.data as OProperties;
}

/**
 * @param shapeIndices - the index to the key indices and whether the value is an object or not
 * @param valueIndices - the index to the values column
 * @param res - The resulting shape we mutate
 * @param res.data - to maintain the reference through the recursion
 * @param cache - the cache where all raw data is stored in a column format
 */
function _readShape(
  shapeIndices: number[],
  valueIndices: number[],
  res: { data: OValue },
  cache: ColumnCacheReader,
): void {
  const { type, countOrCol } = shapeDecode(shapeIndices.shift() ?? 0);
  if (type === 2) {
    const valueIndex = valueIndices.shift() ?? 0;
    if (countOrCol === 5) {
      if (valueIndex === 0) res.data = false;
      else if (valueIndex === 1) res.data = true;
      else res.data = null;
    } else {
      res.data = cache.getColumn(countOrCol, valueIndex);
    }
  } else if (type === 0) {
    res.data = [];
    for (let i = 0; i < countOrCol; i++) {
      const tmp: { data: OValue } = { data: {} };
      _readShape(shapeIndices, valueIndices, tmp, cache);
      res.data.push(tmp.data);
    }
  } else if (type === 1) {
    res.data = {};
    for (let i = 0; i < countOrCol; i++) {
      const key = cache.getColumn<string>(OColumnName.string, shapeIndices.shift() ?? 0);
      const value: { data: OValue } = { data: {} };
      _readShape(shapeIndices, valueIndices, value, cache);
      res.data[key] = value.data;
    }
  } else throw Error('Cannot decode value type');
}

/**
 * A shape pair for stronger compression and decoding
 */
export interface ShapePair {
  /** The type (0 - array, 1 - object, 2 - value) */
  type: 0 | 1 | 2;
  /** the length if object or array; or the column to read from */
  countOrCol: number;
}

/**
 * @param type - 0 is array, 1 is object, 2 is value
 * @param countOrColname - the length of the object or array; if value, its the column name
 * - can match columns for [0-4] (string, u64, i64, f32, f64),
 * - or matches a type: 5 represents bool and null, 6 represents array, 7 represents object
 * @returns - the encoded message
 */
function shapeEncode(type: 0 | 1 | 2, countOrColname: number): number {
  return (countOrColname << 2) + type;
}

/**
 * @param num - the column and index encoded together
 * @returns - the decoded message
 */
function shapeDecode(num: number): ShapePair {
  return { type: (num & 0b11) as 0 | 1 | 2, countOrCol: num >> 2 };
}
