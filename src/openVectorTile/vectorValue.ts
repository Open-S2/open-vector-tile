import { OColumnName } from './columnCache';

import type { Pbf as Protobuf } from '../pbf';
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
  const shapeStore: number[] = []; // this will store the key index (found in string column) OR OValues
  const valueStore: number[] = []; // this will store the value index (found in values column) OR OValues

  _encodeShape(cache, shape, shapeStore, valueStore);

  // return the index of the shape and the value index set
  return [
    cache.addColumnData(OColumnName.indices, shapeStore),
    cache.addColumnData(OColumnName.indices, valueStore),
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
  shape: OProperties,
  shapeStore: number[],
  valueStore: number[],
): void {
  const entries = Object.entries(shape).filter(([, v]) => v !== undefined);
  shapeStore.push(entries.length);
  for (const [key, value] of entries) {
    // store key
    shapeStore.push(cache.addColumnData(OColumnName.string, key));
    // value may be an object, so we need to recurse in that case
    if (!Array.isArray(value) && typeof value === 'object' && value !== null) {
      shapeStore.push(0);
      _encodeShape(cache, value, shapeStore, valueStore);
    } else {
      shapeStore.push(1);
      // its important to note that we never store objects, only null, bool, string, number, and arrays of those
      // however, an array may store sub objects, so shapes do not improve upon that case
      valueStore.push(encodeValue(cache, value));
    }
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
  const res: OProperties = {};

  // first get the data from pbf
  const shapeIndices: number[] = cache.getColumn(OColumnName.indices, shapeIndex);
  const valueIndices: number[] = cache.getColumn(OColumnName.indices, valueIndex);
  // then decode it
  _readShape([...shapeIndices], [...valueIndices], res, cache);

  return res;
}

/**
 * @param shapeIndices - the index to the key indices and whether the value is an object or not
 * @param valueIndices - the index to the values column
 * @param res - The resulting shape we mutate
 * @param cache - the cache where all raw data is stored in a column format
 */
function _readShape(
  shapeIndices: number[],
  valueIndices: number[],
  res: OProperties,
  cache: ColumnCacheReader,
): void {
  let length = shapeIndices.shift() ?? 0;
  while (length-- > 0) {
    const key: string = cache.getColumn(OColumnName.string, shapeIndices.shift() ?? 0);
    const valueType = shapeIndices.shift() ?? 0;
    if (valueType === 0) {
      res[key] = {};
      _readShape(shapeIndices, valueIndices, res[key] as OProperties, cache);
    } else {
      res[key] = cache.getColumn(OColumnName.values, valueIndices.shift() ?? 0);
    }
  }
}

/**
 * EXPLANATION OF THE CODE:
 *
 * Values are self contained generic types, arrays, or objects.
 * We encode them seperate into a standalone protobuf message.
 * Then we check if that resulting bytes exists in the cache.
 * If not, we add it and write it.
 *
 * Values are also stored in a manner of looking up string & number column indexes.
 * So a value is mostly a collection of lookup devices.
 */

/**
 * Write a value to the pbf and return the column index
 * @param cache - the cache where all data is stored in a column format
 * @param value - the value to encode
 * @returns - an index to the values column where the data is stored
 */
export function encodeValue(cache: ColumnCacheWriter, value: OValue): number {
  const res: ColumnValue[] = [];
  // STEP 1: encode a value
  writeValue(res, value, cache);
  // Step 2: Send to cache for an index
  return cache.addColumnData(OColumnName.values, res);
}

/**
 * @param res - the index set to be stored
 * @param value - the value to encode
 * @param cache - the cache where all data is stored in a column format
 */
function writeValue(res: ColumnValue[], value: OValue, cache: ColumnCacheWriter): void {
  if (value === null || value === undefined) {
    res.push(0); // null
  } else if (typeof value === 'boolean') {
    if (value) res.push(1);
    else res.push(2);
  } else if (typeof value === 'number') {
    res.push(3, cache.addNumber(value));
  } else if (typeof value === 'string') {
    res.push(4, cache.addColumnData(OColumnName.string, value));
  } else if (Array.isArray(value)) {
    value = value.filter((v) => v !== undefined);
    // write size
    res.push(5, value.length);
    // run "writeValue" on all values
    for (const v of value) writeValue(res, v, cache);
  } else if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    // write size
    res.push(6, entries.length);
    // run "writeValue" on all values
    for (const [key, v] of entries) {
      res.push(cache.addColumnData(OColumnName.string, key));
      writeValue(res, v, cache);
    }
  } else {
    throw new Error('Cannot encode value type', value);
  }
}

/**
 * @param pbf - the pbf protocol we are reading from
 * @param cache - the cache where all data is stored in a column format
 * @returns - the decoded value
 */
export function readValue(pbf: Protobuf, cache: ColumnCacheReader): OValue {
  const res: { data: OValue } = { data: null };
  // clone because we `shift` the array
  const bytes = [...pbf.readPackedVarint()];

  _read(bytes, cache, res);

  return res.data;
}

/**
 * @param data - the bytes we are reading
 * @param cache - the cache where all data is stored in a column format
 * @param value - the data value we are mutating
 * @param value.data - the decoded value we mutate. Put inside of an object so the reference is maintained outside the function
 */
function _read(data: number[], cache: ColumnCacheReader, value: { data: OValue }): void {
  const tag = data.shift();
  switch (tag) {
    // data is already null
    case 0:
    default:
      break;
    case 1:
      value.data = true;
      break;
    case 2:
      value.data = false;
      break;
    // data is a string->unsigned->signed->double
    case 3: {
      value.data = cache.getColumnData(data.shift() ?? 0);
      break;
    }
    // data is a string
    case 4: {
      value.data = cache.getColumn(OColumnName.string, data.shift() ?? 0);
      break;
    }
    // data is an array
    case 5: {
      value.data = [];
      const size = data.shift() ?? 0;
      for (let i = 0; i < size; i++) {
        const nestedData: { data: OValue } = { data: null };
        _read(data, cache, nestedData);
        value.data.push(nestedData.data);
      }
      break;
    }
    // data is an object
    case 6: {
      value.data = {};
      const size = data.shift() ?? 0;
      for (let i = 0; i < size; i++) {
        const nestedData: { data: OValue } = { data: null };
        const key: string = cache.getColumn(OColumnName.string, data.shift() ?? 0);
        _read(data, cache, nestedData);
        value.data[key] = nestedData.data;
      }
      break;
    }
  }
}
