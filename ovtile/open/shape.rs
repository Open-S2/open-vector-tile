extern crate alloc;

use alloc::{vec::Vec};

// import { OColumnName } from './columnCache';

// import type { ColumnCacheReader, ColumnCacheWriter, ColumnValue } from './columnCache';
// import type { OProperties, OValue } from '../vectorTile.spec';

/// Create shapes
///
/// Used by M-Values
/// Must be an object of key values
/// all keys will be the same, values will be different
/// so we only have to store: [index to shape, bytes (ONLY indexes for values)]
/// @param cache - the cache where all data is stored in a column format
/// @param shape - the shape object to encode
/// @returns - Both the index to a list of key (string) indices and the index to a list of value indices
pub fn encode_shape(
  cache: ColumnCacheWriter,
  shape: OProperties,
) -> (u32, u32) {
  let mut shape_store: Vec<u32> = Vec::new(); // this will store a "shape" of numbers on how to rebuild the object
  let mut value_store: Vec<ColumnValue> = Vec::new(); // this will store the value index (found in values column)

  encode_shape_internal(cache, shape, shape_store, value_store);

  // return the index of the shape and the value index set
  (
    cache.addColumnData(OColumnName.shapes, shape_store),
    cache.addColumnData(OColumnName.shapes, value_store),
  )
}

/// Encodes a shape object into a format suitable for storing in a cache.
fn encode_shape_internal(
  cache: ColumnCacheWriter,
  shape: OValue,
  shapeStore: number[],
  valueStore: ColumnValue[],
) -> void {
  if (Array.isArray(shape)) {
    shapeStore.push(encode_shape_pair(0, shape.length));
    for (const value of shape) encode_shape_internal(cache, value, shapeStore, valueStore);
  } else if (typeof shape === 'object' && shape !== null) {
    const entries = Object.entries(shape).filter(([, v]) => v !== undefined);
    shapeStore.push(encode_shape_pair(1, entries.length));
    for (const [key, value] of entries) {
      // store key
      shapeStore.push(cache.addColumnData(OColumnName.string, key));
      encode_shape_internal(cache, value, shapeStore, valueStore);
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
    } else unreachable!();
    shapeStore.push(encode_shape_pair(2, colName));
  }
}

/// given the shape index and the value index, read in the shape using the cache reader
pub fn read_shape(
  shapeIndex: number,
  valueIndex: number,
  cache: ColumnCacheReader,
) -> OProperties {
  // first get the data from pbf
  const shapeIndices: number[] = cache.getColumn(OColumnName.shapes, shapeIndex);
  const valueIndices: number[] = cache.getColumn(OColumnName.shapes, valueIndex);
  // then decode it
  const value: { data: OValue } = { data: {} };
  read_shape_internal([...shapeIndices], [...valueIndices], value, cache);

  return value.data as OProperties;
}

/// given the shape index and the value index, read in the shape using the cache reader
fn read_shape_internal(
  shapeIndices: Vec<u32>,
  valueIndices: Vec<u32>,
  res: { data: OValue },
  cache: ColumnCacheReader,
): void {
  let { p_type, count_or_col } = decode_shape_pair(shapeIndices.shift() ?? 0);
  if (p_type === 2) {
    const valueIndex = valueIndices.shift() ?? 0;
    if (count_or_col === 5) {
      if (valueIndex === 0) res.data = false;
      else if (valueIndex === 1) res.data = true;
      else res.data = null;
    } else {
      res.data = cache.getColumn(count_or_col, valueIndex);
    }
  } else if (p_type === 0) {
    res.data = [];
    for (let i = 0; i < count_or_col; i++) {
      const tmp: { data: OValue } = { data: {} };
      read_shape_internal(shapeIndices, valueIndices, tmp, cache);
      res.data.push(tmp.data);
    }
  } else if (p_type === 1) {
    res.data = {};
    for (let i = 0; i < count_or_col; i++) {
      const key = cache.getColumn<string>(OColumnName.string, shapeIndices.shift() ?? 0);
      const value: { data: OValue } = { data: {} };
      read_shape_internal(shapeIndices, valueIndices, value, cache);
      res.data[key] = value.data;
    }
  } else { unreachable!(); }
}

/// The type of shape we are decoding
pub enum ShapeType {
    /// an array
    Array = 0,
    /// an object
    Object = 1,
    /// a value
    Value = 2,
}
impl TryFrom<u64> for ShapeType {
    type Error = ();

    fn try_from(value: u64) -> Result<Self, Self::Error> {
            match value {
                0 => Ok(ShapeType::Array),
                1 => Ok(ShapeType::Object),
                2 => Ok(ShapeType::Value),
                _ => Err(()),
            }
    }
}

/// A shape pair for stronger compression and decoding
struct ShapePair {
    /// The type (0 - array, 1 - object, 2 - value)
    p_type: ShapeType,
    /// the length if object or array; or the column to read from
    count_or_col: u32,
}

/// encode a shape pair
fn encode_shape_pair(p_type: ShapeType, count_or_col: u32) -> u64 {
    (count_or_col << 2) as u64 + p_type as u64
}

/// decode a shape pair
fn decode_shape_pair(num: u64) -> Result<ShapePair, ()> {
  Ok(ShapePair {
    p_type: ShapeType::try_from(num & 0b11)?,
    count_or_col: (num >> 2) as u32,
  })
}
