use crate::open::{ColumnCacheReader, ColumnCacheWriter, ColumnValue};
use alloc::{vec, vec::Vec};
use s2json::{
    PrimitiveShape, PrimitiveShapeType, PrimitiveValue, Shape, ShapePrimitive, ShapeType, Value,
    ValuePrimitive, ValuePrimitiveType, ValueType,
};
use serde::{Deserialize, Serialize};

//? Shape

// Shapes exist solely to deconstruct and rebuild objects.
//
// Shape limitations:
// - all keys are strings.
// - all values are either:
// - - primitive types: strings, numbers (f32, f64, u64, i64), true, false, or null
// - - sub types: an array of a shape or a nested object which is itself a shape
// - - if the sub type is an array, ensure all elements are of the same type
// The interfaces below help describe how shapes are built by the user.

trait PrimitiveShapeToStore {
    fn encode(&self, shape_store: &mut Vec<ColumnValue>, cache: &mut ColumnCacheWriter);
    fn decode(shape_store: &mut Vec<usize>) -> Self;
}
impl PrimitiveShapeToStore for PrimitiveShape {
    fn encode(&self, shape_store: &mut Vec<ColumnValue>, _cache: &mut ColumnCacheWriter) {
        shape_store.push(ShapePair::encode(ShapeDefinition::Primitive, self.into()).into());
    }

    fn decode(shape_store: &mut Vec<usize>) -> Self {
        let shape_pair = ShapePair::decode(shape_store.remove(0));
        shape_pair.count_or_col.into()
    }
}

trait ShapePrimitiveTypeToStore {
    fn encode(&self, shape_store: &mut Vec<ColumnValue>, cache: &mut ColumnCacheWriter);
    fn decode(store: &mut Vec<usize>, cache: &mut ColumnCacheReader) -> Self;
}
impl ShapePrimitiveTypeToStore for PrimitiveShapeType {
    fn encode(&self, shape_store: &mut Vec<ColumnValue>, cache: &mut ColumnCacheWriter) {
        match self {
            Self::Primitive(prim) => prim.encode(shape_store, cache),
            Self::NestedPrimitive(nested) => {
                shape_store.push(ShapePair::encode(ShapeDefinition::Object, nested.len()).into());
                for (key, value) in nested.iter() {
                    shape_store.push(cache.add_string(key.clone()).into());
                    value.encode(shape_store, cache);
                }
            }
        }
    }

    fn decode(store: &mut Vec<usize>, cache: &mut ColumnCacheReader) -> Self {
        let shape_pair = ShapePair::decode(store.remove(0));
        match shape_pair.p_type {
            ShapeDefinition::Primitive => {
                Self::Primitive(PrimitiveShape::from(shape_pair.count_or_col))
            }
            ShapeDefinition::Object => {
                let mut nested = ShapePrimitive::new();
                for _ in 0..shape_pair.count_or_col {
                    nested.insert(cache.get_string(store.remove(0)), PrimitiveShape::decode(store));
                }
                Self::NestedPrimitive(nested)
            }
            #[tarpaulin::skip]
            _ => panic!("Unknown shape definition: {:?}", shape_pair),
        }
    }
}

trait ShapeTypeToStore {
    fn encode(&self, shape_store: &mut Vec<ColumnValue>, cache: &mut ColumnCacheWriter);
    fn decode(store: &mut Vec<usize>, cache: &mut ColumnCacheReader) -> Self;
}
impl ShapeTypeToStore for ShapeType {
    fn encode(&self, shape_store: &mut Vec<ColumnValue>, cache: &mut ColumnCacheWriter) {
        match self {
            Self::Primitive(prim) => prim.encode(shape_store, cache),
            Self::Array(array) => {
                shape_store.push(0.into());
                array.first().unwrap().encode(shape_store, cache);
            }
            Self::Nested(nested) => {
                nested.encode(shape_store, cache);
            }
        }
    }

    fn decode(store: &mut Vec<usize>, cache: &mut ColumnCacheReader) -> Self {
        let code = store.remove(0);
        let shape_pair = ShapePair::decode(code);
        match shape_pair.p_type {
            ShapeDefinition::Primitive => {
                Self::Primitive(PrimitiveShape::from(shape_pair.count_or_col))
            }
            ShapeDefinition::Array => Self::Array(vec![PrimitiveShapeType::decode(store, cache)]),
            ShapeDefinition::Object => {
                // reinsert code because shape will check it again
                store.insert(0, code);
                Self::Nested(Shape::decode(store, cache))
            }
        }
    }
}

/// Encode/Decode a Shape to the column cache
pub trait ShapeToStore {
    /// Encode the shape
    fn encode(&self, shape_store: &mut Vec<ColumnValue>, cache: &mut ColumnCacheWriter);
    /// Decode the shape
    fn decode(store: &mut Vec<usize>, cache: &mut ColumnCacheReader) -> Self;
}
impl ShapeToStore for Shape {
    fn encode(&self, shape_store: &mut Vec<ColumnValue>, cache: &mut ColumnCacheWriter) {
        shape_store.push(ShapePair::encode(ShapeDefinition::Object, self.len()).into());
        for (key, value) in self.iter() {
            shape_store.push(cache.add_string(key.clone()).into());
            value.encode(shape_store, cache);
        }
    }
    fn decode(store: &mut Vec<usize>, cache: &mut ColumnCacheReader) -> Self {
        let mut map = Shape::new();
        let shape_pair = ShapePair::decode(store.remove(0));
        if shape_pair.p_type != ShapeDefinition::Object {
            panic!("expected object shape")
        }
        for _ in 0..shape_pair.count_or_col {
            let key = cache.get_string(store.remove(0));
            let shape = ShapeType::decode(store, cache);
            map.insert(key, shape);
        }
        map
    }
}

/// Create shapes
///
/// Used by Layer's and Feature's M-Values
/// Must be an object of key values
/// all keys will be the same, values will be different
/// A layer's Shape defines what the properties look like for every Feature in that layer
/// so we only have to store the properties and M-Value shape **once** per layer.
pub fn encode_shape(shape: &Shape, cache: &mut ColumnCacheWriter) -> usize {
    // this will store a "shape" of numbers on how to rebuild the object
    let mut shape_store = Vec::<ColumnValue>::new();
    // encode the shape data
    shape.encode(&mut shape_store, cache);
    // return the index of the shape index
    cache.add_shapes(shape_store)
}

/// Decode shapes from the column cache using an index to find the shape encoding
pub fn decode_shape(shape_index: usize, cache: &mut ColumnCacheReader) -> Shape {
    let mut shape_store = cache.get_shapes(shape_index);
    // duplicate the array to avoid modifying the original
    Shape::decode(&mut shape_store, cache)
}

/// A shape pair for stronger compression and decoding
#[derive(Debug, Clone, PartialEq)]
pub struct ShapePair {
    /// The type (0 - array, 1 - object, 2 - value)
    pub p_type: ShapeDefinition,
    /// the length if object or array; or the column to read from
    pub count_or_col: usize,
}
impl ShapePair {
    /// encode a shape pair
    pub fn encode(p_type: ShapeDefinition, count_or_col: usize) -> usize {
        (count_or_col << 2) + p_type as usize
    }

    /// decode a shape pair
    pub fn decode(num: usize) -> ShapePair {
        ShapePair { p_type: (num & 0b11).into(), count_or_col: num >> 2 }
    }
}
impl From<usize> for ShapePair {
    fn from(value: usize) -> Self {
        ShapePair::decode(value)
    }
}

/// The type of shape we are decoding
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
pub enum ShapeDefinition {
    /// an array
    Array = 0,
    /// an object
    Object = 1,
    /// a primitive
    Primitive = 2,
}
impl From<usize> for ShapeDefinition {
    fn from(value: usize) -> Self {
        match value {
            0 => ShapeDefinition::Array,
            1 => ShapeDefinition::Object,
            _ => ShapeDefinition::Primitive, // 2
        }
    }
}

trait PrimitiveValueToStore {
    fn encode(
        &self,
        shape: &PrimitiveShape,
        store: &mut Vec<ColumnValue>,
        cache: &mut ColumnCacheWriter,
    );
    fn decode(
        shape: &PrimitiveShape,
        store: &mut Vec<usize>,
        cache: &mut ColumnCacheReader,
    ) -> Self;
}
impl PrimitiveValueToStore for PrimitiveValue {
    fn encode(
        &self,
        shape: &PrimitiveShape,
        store: &mut Vec<ColumnValue>,
        cache: &mut ColumnCacheWriter,
    ) {
        match (self, shape) {
            // string
            (PrimitiveValue::String(s), PrimitiveShape::String) => {
                store.push(cache.add_string(s.clone()).into())
            }
            // u64
            (PrimitiveValue::U64(u), PrimitiveShape::U64) => store.push(cache.add_u64(*u).into()),
            // i64
            (PrimitiveValue::U64(u), PrimitiveShape::I64) => {
                store.push(cache.add_i64(*u as i64).into())
            }
            (PrimitiveValue::I64(i), PrimitiveShape::I64) => store.push(cache.add_i64(*i).into()),
            // f32
            (PrimitiveValue::U64(u), PrimitiveShape::F32) => {
                store.push(cache.add_f32(*u as f32).into())
            }
            (PrimitiveValue::I64(i), PrimitiveShape::F32) => {
                store.push(cache.add_f32(*i as f32).into())
            }
            (PrimitiveValue::F32(f), PrimitiveShape::F32) => store.push(cache.add_f32(*f).into()),
            // f64
            (PrimitiveValue::U64(u), PrimitiveShape::F64) => {
                store.push(cache.add_f64(*u as f64).into())
            }
            (PrimitiveValue::I64(i), PrimitiveShape::F64) => {
                store.push(cache.add_f64(*i as f64).into())
            }
            (PrimitiveValue::F32(f), PrimitiveShape::F64) => {
                store.push(cache.add_f64(*f as f64).into())
            }
            (PrimitiveValue::F64(f), PrimitiveShape::F64) => store.push(cache.add_f64(*f).into()),
            // bool
            (PrimitiveValue::Bool(b), PrimitiveShape::Bool) => {
                store.push(cache.add_u64(if *b { 1 } else { 0 }).into())
            }
            // null
            (PrimitiveValue::Null, PrimitiveShape::Null) => {}
            #[tarpaulin::skip]
            _ => panic!("shape mismatch"),
        }
    }

    fn decode(
        shape: &PrimitiveShape,
        store: &mut Vec<usize>,
        cache: &mut ColumnCacheReader,
    ) -> Self {
        let col_val = store.remove(0);
        match shape {
            PrimitiveShape::String => PrimitiveValue::String(cache.get_string(col_val)),
            PrimitiveShape::U64 => PrimitiveValue::U64(cache.get_unsigned(col_val)),
            PrimitiveShape::I64 => PrimitiveValue::I64(cache.get_signed(col_val)),
            PrimitiveShape::F32 => PrimitiveValue::F32(cache.get_float(col_val)),
            PrimitiveShape::F64 => PrimitiveValue::F64(cache.get_double(col_val)),
            PrimitiveShape::Bool => PrimitiveValue::Bool(cache.get_unsigned(col_val) == 1),
            PrimitiveShape::Null => {
                // put the column back because null does not need to be decoded
                store.insert(0, col_val);
                PrimitiveValue::Null
            }
        }
    }
}

trait PrimitiveShapeTypeToStore {
    fn encode(
        &self,
        shape: &PrimitiveShapeType,
        store: &mut Vec<ColumnValue>,
        cache: &mut ColumnCacheWriter,
    );
    fn decode(
        shape: &PrimitiveShapeType,
        store: &mut Vec<usize>,
        cache: &mut ColumnCacheReader,
    ) -> Self;
}
impl PrimitiveShapeTypeToStore for ValuePrimitiveType {
    fn encode(
        &self,
        shape: &PrimitiveShapeType,
        store: &mut Vec<ColumnValue>,
        cache: &mut ColumnCacheWriter,
    ) {
        match (shape, self) {
            (
                PrimitiveShapeType::Primitive(shape_prim),
                ValuePrimitiveType::Primitive(value_prim),
            ) => {
                value_prim.encode(shape_prim, store, cache);
            }
            (
                PrimitiveShapeType::NestedPrimitive(shape_nest),
                ValuePrimitiveType::NestedPrimitive(value_nest),
            ) => {
                for (key, prim_shape) in shape_nest.iter() {
                    let val = value_nest.get(key).unwrap();
                    val.encode(prim_shape, store, cache);
                }
            }
            #[tarpaulin::skip]
            _ => panic!("shape and value do not match"),
        }
    }
    fn decode(
        shape: &PrimitiveShapeType,
        store: &mut Vec<usize>,
        cache: &mut ColumnCacheReader,
    ) -> Self {
        match shape {
            PrimitiveShapeType::Primitive(shape_prim) => {
                ValuePrimitiveType::Primitive(PrimitiveValue::decode(shape_prim, store, cache))
            }
            PrimitiveShapeType::NestedPrimitive(shape_nest) => {
                let mut map = ValuePrimitive::new();
                for (key, shape) in shape_nest.iter() {
                    map.insert(key.clone(), PrimitiveValue::decode(shape, store, cache));
                }
                ValuePrimitiveType::NestedPrimitive(map)
            }
        }
    }
}

/// Encode/Decode a ValueType to the column cache with a Shape describing how to store
pub trait ValueTypeToStore {
    /// Encode the value type into the store
    fn encode(
        &self,
        shape: &ShapeType,
        store: &mut Vec<ColumnValue>,
        cache: &mut ColumnCacheWriter,
    );
    /// Decode the value type from the store
    fn decode(shape: &ShapeType, store: &mut Vec<usize>, cache: &mut ColumnCacheReader) -> Self;
}
impl ValueTypeToStore for ValueType {
    fn encode(
        &self,
        shape: &ShapeType,
        store: &mut Vec<ColumnValue>,
        cache: &mut ColumnCacheWriter,
    ) {
        match (self, shape) {
            (ValueType::Primitive(val), ShapeType::Primitive(shape)) => {
                val.encode(shape, store, cache);
            }
            (ValueType::Array(vals), ShapeType::Array(shape)) => {
                // encode length
                store.push(ColumnValue::Number(vals.len()));
                for val in vals {
                    val.encode(&shape[0], store, cache);
                }
            }
            (ValueType::Nested(val), ShapeType::Nested(shape)) => {
                val.encode(shape, store, cache);
            }
            #[tarpaulin::skip]
            _ => panic!("shape and value do not match"),
        }
    }

    fn decode(shape: &ShapeType, store: &mut Vec<usize>, cache: &mut ColumnCacheReader) -> Self {
        match shape {
            ShapeType::Primitive(shape_prim) => {
                ValueType::Primitive(PrimitiveValue::decode(shape_prim, store, cache))
            }
            ShapeType::Array(shape_arr) => {
                let mut val = Vec::<ValuePrimitiveType>::new();
                let len = store.remove(0);
                for _ in 0..len {
                    val.push(ValuePrimitiveType::decode(&shape_arr[0], store, cache));
                }
                ValueType::Array(val)
            }
            ShapeType::Nested(shape) => ValueType::Nested(Value::decode(shape, store, cache)),
        }
    }
}

/// Encode/Decode a Value to the column cache with a Shape describing how to store
pub trait ValueToStore {
    /// Encode the value into the store
    fn encode(&self, shape: &Shape, store: &mut Vec<ColumnValue>, cache: &mut ColumnCacheWriter);
    /// Decode the value from the store
    fn decode(shape: &Shape, store: &mut Vec<usize>, cache: &mut ColumnCacheReader) -> Self;
}
impl ValueToStore for Value {
    fn encode(&self, shape: &Shape, store: &mut Vec<ColumnValue>, cache: &mut ColumnCacheWriter) {
        for (key, shape_type) in shape.iter() {
            let val = self.get(key).unwrap_or(&ValueType::default_from_shape(shape_type)).clone();
            val.encode(shape_type, store, cache);
        }
    }
    fn decode(shape: &Shape, store: &mut Vec<usize>, cache: &mut ColumnCacheReader) -> Self {
        let mut value = Self::new();
        for (key, shape_type) in shape.iter() {
            let val = ValueType::decode(shape_type, store, cache);
            value.insert(key.clone(), val);
        }
        value
    }
}

/// Encode a value to the column cache
pub fn encode_value(value: &Value, shape: &Shape, cache: &mut ColumnCacheWriter) -> usize {
    let mut value_store: Vec<ColumnValue> = vec![];
    value.encode(shape, &mut value_store, cache);
    cache.add_shapes(value_store)
}

/// Decode a value from the column cache
pub fn decode_value(value_index: usize, shape: &Shape, cache: &mut ColumnCacheReader) -> Value {
    let value_store = cache.get_shapes(value_index);
    Value::decode(shape, &mut value_store.clone(), cache)
}
