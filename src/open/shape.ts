import { OColumnName } from './columnCache';

import type { ColumnCacheReader, ColumnCacheWriter, ColumnValue } from './columnCache';
import type { OProperties, OValue, Primitive, Properties, ValueArray } from '../vectorTile.spec';

//? Shapes exist solely to deconstruct and rebuild objects.
//?
//? Shape limitations:
//? - all keys are strings.
//? - all values are either:
//? - - primitive types: strings, numbers (f32, f64, u64, i64), true, false, or null
//? - - sub types: an array of a shape or a nested object which is itself a shape
//? - - if the sub type is an array, ensure all elements are of the same type
//? The interfaces below help describe how shapes are built by the user.

/**
 * Primitive types that can be found in a shape
 */
export type PrimitiveShapes = 'string' | 'f32' | 'f64' | 'u64' | 'i64' | 'bool' | 'null';

/** The Shape Object But the values can only be primitives */
export interface ShapePrimitive {
  [key: string]: PrimitiveShapes;
}

/**
 * Arrays may contain either a primitive or an object whose values are primitives
 */
export type ShapePrimitiveType = PrimitiveShapes | ShapePrimitive;

/**
 * Shape types that can be found in a shapes object.
 * Either a primitive, an array containing any type, or a nested shape.
 * If the type is an array, all elements must be the same type
 */
export type ShapeType = PrimitiveShapes | [ShapePrimitiveType] | Shape;

/** The Shape Object */
export interface Shape {
  [key: string]: ShapeType;
}

/**
 * Create shapes
 *
 * Used by Layer's and Feature's M-Values
 * Must be an object of key values
 * all keys will be the same, values will be different
 * A layer's Shape defines what the properties look like for every Feature in that layer
 * so we only have to store the properties and M-Value shape **once** per layer.
 * @param cache - the cache where all data is stored in a column format
 * @param shape - the shape object to encode
 * @returns - The index of where the shape was stored in the cache
 */
export function encodeShape(cache: ColumnCacheWriter, shape: Shape): number {
  // this will store a "shape" of numbers on how to rebuild the object
  const shapeStore: number[] = [];
  // encode the shape data
  _encodeShape(shape, shapeStore, cache);
  // return the index of the shape index
  return cache.addColumnData(OColumnName.shapes, shapeStore);
}
/**
 * Encodes a shape object into a format suitable for storing in a cache.
 * @param shape - the shape object to encode. Recursively encodes nested objects.
 * @param shapeStore - list of key (string) indices. Also includes if the value is an object or not.
 * @param cache - the cache where all data is stored in a column format.
 */
function _encodeShape(shape: ShapeType, shapeStore: number[], cache: ColumnCacheWriter): void {
  if (Array.isArray(shape)) {
    shapeStore.push(0);
    _encodeShape(shape[0], shapeStore, cache);
  } else if (typeof shape === 'object') {
    const entries = Object.entries(shape);
    shapeStore.push(encodeAttribute(1, entries.length));
    for (const [key, value] of entries) {
      // store key
      shapeStore.push(cache.addColumnData(OColumnName.string, key));
      _encodeShape(value, shapeStore, cache);
    }
  } else {
    shapeStore.push(encodeAttribute(2, shapePrimitiveToColumnName(shape)));
  }
}

/**
 * @param shapeIndex - the index to the key indices and whether the value is an object or not
 * @param cache - the cache where all data is stored in a column format
 * @returns - The shape object
 */
export function decodeShape(shapeIndex: number, cache: ColumnCacheReader): Shape {
  const shapeStore: number[] = cache.getColumn(OColumnName.shapes, shapeIndex);
  // duplicate the array to avoid modifying the original
  return _decodeShape(cache, [...shapeStore]) as Shape;
}

/**
 * @param cache - the cache where all data is stored in a column format
 * @param shapeStore - the shape data encoded as an array
 * @returns - The shape object
 */
function _decodeShape(cache: ColumnCacheReader, shapeStore: number[]): ShapeType {
  const attribute = decodeAttribute(shapeStore.shift() ?? 0);

  if (attribute.type === 0) {
    // Array
    return [_decodeShape(cache, shapeStore) as ShapePrimitiveType];
  } else if (attribute.type === 1) {
    // Object
    const length = attribute.countOrCol;
    const obj: Shape = {};
    for (let i = 0; i < length; i++) {
      const keyIndex = shapeStore.shift() ?? 0;
      const key: string = cache.getColumn(OColumnName.string, keyIndex);
      obj[key] = _decodeShape(cache, shapeStore);
    }
    return obj;
  } else {
    // Primitive value
    return columnNameToShapePrimitive(attribute.countOrCol);
  }
}

/**
 * @param value - the value to encode
 * @param shape - the shape of the value
 * @param cache - the cache where all data is stored in a column format
 * @returns - The index of where the value was stored in the cache
 */
export function encodeValue(value: OProperties, shape: Shape, cache: ColumnCacheWriter): number {
  const valueStore: (number | ColumnValue)[] = [];
  _encodeValue(value, shape, valueStore, cache);
  return cache.addColumnData(OColumnName.shapes, valueStore);
}

/**
 * @param value - the value to encode
 * @param shape - the shape of the value
 * @param valueStore - list of key (string) indices. Also includes if the value is an object or not
 * @param cache - the cache where all data is stored in a column format
 */
function _encodeValue(
  value: OValue,
  shape: ShapeType,
  valueStore: (number | ColumnValue)[],
  cache: ColumnCacheWriter,
): void {
  // we follow the rules of the shape
  if (Array.isArray(shape)) {
    value = value as ValueArray;
    valueStore.push(value.length);
    for (const v of value) {
      _encodeValue(v, shape[0], valueStore, cache);
    }
  } else if (typeof shape === 'object') {
    const keys = Object.keys(shape);
    value = value as OProperties;
    for (const key of keys) {
      // key stored already by shape
      _encodeValue(value?.[key], shape[key], valueStore, cache);
    }
  } else {
    if (shape === 'string') {
      valueStore.push(cache.addColumnData(OColumnName.string, (value as string) ?? ''));
    } else if (shape === 'u64') {
      valueStore.push(cache.addNumber((value as number) ?? 0, OColumnName.unsigned));
    } else if (shape === 'i64') {
      valueStore.push(cache.addNumber((value as number) ?? 0, OColumnName.signed));
    } else if (shape === 'f32') {
      valueStore.push(cache.addNumber((value as number) ?? 0, OColumnName.float));
    } else if (shape === 'f64') {
      valueStore.push(cache.addNumber((value as number) ?? 0, OColumnName.double));
    } else if (shape === 'bool') {
      valueStore.push(cache.addNumber(value ? 1 : 0, OColumnName.unsigned));
    }
  }
}

/**
 * @param valueIndex - the index of the encoded value in the cache
 * @param shape - the shape of the value to decode
 * @param cache - the cache where all data is stored in a column format
 * @returns The decoded value
 */
export function decodeValue(
  valueIndex: number,
  shape: Shape,
  cache: ColumnCacheReader,
): OProperties {
  const valueStore: number[] = cache.getColumn(OColumnName.shapes, valueIndex);
  // duplicate the array to avoid modifying the original
  return _decodeValue([...valueStore], shape, cache) as OProperties;
}

/**
 * @param valueStore - the encoded value data as an array
 * @param shape - the shape of the value to decode
 * @param cache - the cache where all data is stored in a column format
 * @returns The decoded value
 */
function _decodeValue(valueStore: number[], shape: ShapeType, cache: ColumnCacheReader): OValue {
  if (Array.isArray(shape)) {
    const length = valueStore.shift() ?? 0;
    const arr: ValueArray = [];
    for (let i = 0; i < length; i++) {
      arr.push(
        _decodeValue(valueStore, shape[0], cache) as Primitive | { [key: string]: Primitive },
      );
    }
    return arr;
  } else if (typeof shape === 'object') {
    const obj: OProperties = {};
    for (const key in shape) {
      obj[key] = _decodeValue(valueStore, shape[key], cache);
    }
    return obj;
  } else {
    if (shape === 'null') return null;
    const columnValue = valueStore.shift() ?? 0;
    if (shape === 'string') {
      return cache.getColumn(OColumnName.string, columnValue);
    } else if (shape === 'bool') {
      return cache.getColumn(OColumnName.unsigned, columnValue) !== 0;
    } else if (shape === 'u64') {
      return cache.getColumn(OColumnName.unsigned, columnValue);
    } else if (shape === 'i64') {
      return cache.getColumn(OColumnName.signed, columnValue);
    } else if (shape === 'f32') {
      return cache.getColumn(OColumnName.float, columnValue);
    } else {
      // f64
      return cache.getColumn(OColumnName.double, columnValue);
    }
  }
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
function encodeAttribute(type: 0 | 1 | 2, countOrColname: number): number {
  return (countOrColname << 2) + type;
}

/**
 * @param num - the column and index encoded together
 * @returns - the decoded message
 */
function decodeAttribute(num: number): ShapePair {
  return { type: (num & 0b11) as 0 | 1 | 2, countOrCol: num >> 2 };
}

/**
 * @param type - the primitive shape to convert
 * @returns - the column name corresponding to the shape primitive
 */
function shapePrimitiveToColumnName(type: PrimitiveShapes): OColumnName {
  if (type === 'string') return OColumnName.string;
  else if (type === 'u64') return OColumnName.unsigned;
  else if (type === 'i64') return OColumnName.signed;
  else if (type === 'f32') return OColumnName.float;
  else if (type === 'f64') return OColumnName.double;
  else if (type === 'bool') return 5;
  else return 6;
}

/**
 * @param columnName - the column name to convert
 * @returns - the primitive shape corresponding to the column name
 */
function columnNameToShapePrimitive(columnName: OColumnName): PrimitiveShapes {
  if (columnName === OColumnName.string) return 'string';
  else if (columnName === OColumnName.unsigned) return 'u64';
  else if (columnName === OColumnName.signed) return 'i64';
  else if (columnName === OColumnName.float) return 'f32';
  else if (columnName === OColumnName.double) return 'f64';
  else if (columnName === 5) return 'bool';
  else return 'null';
}

//? The Following are utility functions when the user doesn't pre-define the Properties/M-Value
//? Shapes to store:

/**
 * @param data - the data to create the shape from
 * @returns - the shape type we want to create based upon the data
 */
export function createShapeFromData(data: OProperties[] | Properties[]): Shape {
  const shape: Shape = {};
  for (const d of data) {
    for (const k in d) shape[k] = getShapesValueType(d[k]);
  }
  return shape;
}

/**
 * Update/Mutate the shape from the data provided
 * @param shape - the shape
 * @param data - the data to update the shape
 */
export function updateShapeFromData(shape: Shape, data: OProperties | Properties): void {
  for (const k in data) shape[k] = getShapesValueType(data[k]);
}

/**
 * @param value - conform to the rules of OValue
 * @returns - the shape type
 */
function getShapesValueType(value: OValue): ShapeType {
  if (Array.isArray(value)) {
    // If it's a number type and the first number is a u64 but the second is an i64 or f64?
    // otherwise just return the first case in the array
    const types = value.map(getShapesValueType);
    return [validateTypes(types) as ShapePrimitiveType];
  } else if (typeof value === 'object' && value !== null) {
    return createShapeFromData([value]);
  } else {
    return getPrimitiveType(value);
  }
}

/**
 * @param value - the primtive value to get the type from
 * @returns - the primitive type from the value
 */
function getPrimitiveType(value: string | number | boolean | null): PrimitiveShapes {
  const type = typeof value;
  if (type === 'string') {
    return 'string';
  } else if (type === 'number') {
    if (Number.isInteger(value)) {
      return (value as number) < 0 ? 'i64' : 'u64';
    } else {
      return 'f64';
    }
  } else if (type === 'boolean') {
    return 'bool';
  } else {
    return 'null';
  }
}

/**
 * This is primarily to check if the type is a primitive.
 * If the primitive is a number, find the "depth", the most complex is f64, then i64, then u64.
 * Otherwise, if the primitives don't match, throw an error.
 * If the type is NOT a primitive, ensure that all types in the array match
 * @param types - either a primitive type, array, or object
 * @returns - a single type from the list to validate the correct type to be parsed from values later
 */
export function validateTypes(types: ShapeType[]): ShapeType {
  if (typeof types[0] === 'string') {
    // first ensure all primitive types are the same (excluding numbers)
    let baseType = types[0] as PrimitiveShapes;
    const basePrim = isNumber(baseType);
    for (const type of types as PrimitiveShapes[]) {
      if (type !== baseType) {
        if (isNumber(type) && basePrim) {
          baseType = getHighestOrderNumber(baseType, type);
        } else {
          throw new Error('All types must be the same');
        }
      }
    }
    return baseType;
  } else {
    const typeCheck = types.every(
      (t) => typeof t === typeof types[0] && Array.isArray(t) === Array.isArray(types[0]),
    );
    if (!typeCheck) throw new Error('All types must be the same');
    return types[0];
  }
}

/**
 * given a primitive type, check if one of them is a "number" type
 * @param type - any primitive type
 * @returns - true if the type is a number
 */
function isNumber(type: PrimitiveShapes): boolean {
  return type === 'i64' || type === 'u64' || type === 'f64';
}

/**
 * @param typeA - either i64, u64, or f64
 * @param typeB - either i64, u64, or f64
 * @returns - the "highest order number" e.g. f64 > i64 > u64
 */
function getHighestOrderNumber(typeA: PrimitiveShapes, typeB: PrimitiveShapes): PrimitiveShapes {
  if (typeA === 'f64' || typeB === 'f64') {
    return 'f64';
  } else if (typeA === 'i64' || typeB === 'i64') {
    return 'i64';
  } else {
    return 'u64';
  }
}
