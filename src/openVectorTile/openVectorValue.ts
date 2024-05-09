import { OColumnName } from "./columnCache";

import type Protobuf from "../pbf";
import type { OValue } from "../vectorTile.spec";
import type { ColumnCacheWriter, ColumnCacheReader, ColumnValue } from "./columnCache";

/**
 * Create shapes
 *
 * Used by M-Values
 * Must be an object of key values
 * all keys will be the same, values will be different
 * so we only have to store: [index to shape, bytes (ONLY indexes for values)]
 */
export function encodeShape(
  cache: ColumnCacheWriter,
  shape: Record<string, OValue>,
): [shapeIndex: number, valueIndexes: number[]] {
  const shapeStore: number[] = []; // this will store the key index (found in string column) OR OValues
  const valueStore: number[] = []; // this will store the value index (found in values column) OR OValues

  _encodeShape(cache, shape, shapeStore, valueStore);

  // return the index of the shape and the value index set
  return [cache.addColumnData(OColumnName.indices, shapeStore), valueStore];
}

/** Encodes a shape object into a format suitable for storing in a cache. */
function _encodeShape(
  cache: ColumnCacheWriter,
  shape: Record<string, OValue>,
  shapeStore: number[],
  valueStore: number[],
): void {
  const entries = Object.entries(shape).filter(([, v]) => v !== undefined);
  for (const [key, value] of entries) {
    // store key
    shapeStore.push(cache.addColumnData(OColumnName.string, key));
    // value may be an object, so we need to recurse in that case
    if (!Array.isArray(value) && typeof value === "object" && value !== null) {
      shapeStore.push(0);
      _encodeShape(cache, value, shapeStore, valueStore);
    } else {
      shapeStore.push(1);
      valueStore.push(encodeValue(cache, value));
    }
  }
}

export function readShape(colIndex: number, cache: ColumnCacheReader): Record<string, OValue> {
  const res: Record<string, OValue> = {};

  // first get the data from pbf
  const data: number[] = cache.getColumnData(colIndex);
  // then decode it
  _readShape(data, res, cache);

  return res;
}

function _readShape(
  shapeData: number[],
  res: Record<string, OValue>,
  cache: ColumnCacheReader,
): void {
  const key: string = cache.getColumn(OColumnName.string, shapeData.shift() ?? 0);
  const valueType = shapeData.shift() ?? 0;
  if (valueType === 0) {
    res[key] = {};
    _readShape(shapeData, res[key] as Record<string, OValue>, cache);
  } else {
    res[key] = cache.getColumn(OColumnName.values, shapeData.shift() ?? 0);
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

/** Write a value to the pbf and return the column index */
export function encodeValue(cache: ColumnCacheWriter, value: OValue): number {
  const res: ColumnValue[] = [];
  // STEP 1: encode a value
  writeValue(res, value, cache);
  // Step 2: Send to cache for an index
  return cache.addColumnData(OColumnName.values, res);
}

function writeValue(res: ColumnValue[], value: OValue, cache: ColumnCacheWriter): void {
  if (value === undefined) return;

  if (value === null) {
    res.push(0); // null
  } else if (typeof value === "boolean") {
    if (value) res.push(1);
    else res.push(2);
  } else if (typeof value === "number") {
    res.push(3, cache.addNumber(value));
  } else if (typeof value === "string") {
    res.push(4, cache.addColumnData(OColumnName.string, value));
  } else if (Array.isArray(value)) {
    value = value.filter((v) => v !== undefined);
    if (value.length === 0) {
      res.push(0); // null
      return;
    }
    // write size
    res.push(4, value.length);
    // run "writeValue" on all values
    for (const v of value) writeValue(res, v, cache);
  } else if (typeof value === "object") {
    const entries = Object.entries(value).filter(([, v]) => v !== undefined);
    if (entries.length === 0) {
      res.push(0); // null
      return;
    }
    // write size
    res.push(5, entries.length);
    // run "writeValue" on all values
    for (const [key, v] of entries) {
      // writeValue({ value: key, cache }, pbf); // write the string
      // writeValue({ value: v, cache }, pbf); // write the value
      writeValue(res, key, cache);
      writeValue(res, v, cache);
    }
  } else {
    throw new Error("Cannot encode value type", value);
  }
}

export function readValue(pbf: Protobuf, cache: ColumnCacheReader): OValue {
  const res: { data: OValue } = { data: null };
  const bytes = [...pbf.readPackedVarint()];

  _read(bytes, cache, res);

  return res.data;
}

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
    // data is an array
    case 4: {
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
    case 5: {
      value.data = {};
      const size = data.shift() ?? 0;
      for (let i = 0; i < size; i++) {
        const nestedData: { data: OValue } = { data: null };
        const key: string = cache.getColumnData(data.shift() ?? 0);
        _read(data, cache, nestedData);
        value.data[key] = nestedData.data;
      }
      break;
    }
  }
}
