use crate::open::{ColumnCacheWriter, ColumnCacheReader, ColumnValue};
use crate::mapbox::{Properties as MapboxProperties, Value as MapboxValue};

use serde::{Serialize, Deserialize};

use alloc::vec;
use alloc::vec::Vec;
use alloc::string::String;
use alloc::collections::BTreeMap;

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

/// Primitive types that can be found in a shape
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PrimitiveShape {
    /// String type utf8 encoded
    String,
    /// unsigned 64 bit integer
    U64,
    /// signed 64 bit integer
    I64,
    /// floating point number
    F32,
    /// double precision floating point number
    F64,
    /// boolean
    Bool,
    /// null
    Null,
}
impl PrimitiveShape {
    fn encode(&self, shape_store: &mut Vec<ColumnValue>, _cache: &mut ColumnCacheWriter) {
        shape_store.push(ShapePair::encode(2.into(), self.into()).into());
    }

    pub fn is_number(&self) -> bool {
        matches!(self, PrimitiveShape::F64 | PrimitiveShape::F32 | PrimitiveShape::I64 | PrimitiveShape::U64)
    }

    pub fn matching_shape(&self, other: &PrimitiveShape) -> bool {
        self == other || self.is_number() == other.is_number()
    }

    pub fn get_highest_order_number(type_a: &PrimitiveShape, type_b: &PrimitiveShape) -> PrimitiveShape {
        if *type_a == PrimitiveShape::F64 || *type_b == PrimitiveShape::F64 {
            PrimitiveShape::F64
        } else if *type_a == PrimitiveShape::F32 || *type_b == PrimitiveShape::F32 {
            PrimitiveShape::F32
        } else if *type_a == PrimitiveShape::I64 || *type_b == PrimitiveShape::I64 {
            PrimitiveShape::I64
        } else {
            PrimitiveShape::U64
        }
    }

    fn merge(&mut self, other: &Self) {
        if self.is_number() && other.is_number() {
            *self = Self::get_highest_order_number(self, other);
        } else if !self.matching_shape(other) {
            panic!("shape mismatch: {:?} vs {:?}", self, other);
        }
        // othewrise, do nothing
    }
}
impl From<&PrimitiveShape> for usize {
    fn from(shape: &PrimitiveShape) -> Self {
        match shape {
            PrimitiveShape::String => 0,
            PrimitiveShape::U64 => 1,
            PrimitiveShape::I64 => 2,
            PrimitiveShape::F32 => 3,
            PrimitiveShape::F64 => 4,
            PrimitiveShape::Bool => 5,
            PrimitiveShape::Null => 6,
        }
    }
}
impl From<PrimitiveValue> for PrimitiveShape {
    fn from(val: PrimitiveValue) -> Self {
        match val {
            PrimitiveValue::String(_) => PrimitiveShape::String,
            PrimitiveValue::U64(_) => PrimitiveShape::U64,
            PrimitiveValue::I64(_) => PrimitiveShape::I64,
            PrimitiveValue::F32(_) => PrimitiveShape::F32,
            PrimitiveValue::F64(_) => PrimitiveShape::F64,
            PrimitiveValue::Bool(_) => PrimitiveShape::Bool,
            PrimitiveValue::Null => PrimitiveShape::Null,
        }
    }
}
impl From<usize> for PrimitiveShape {
    fn from(num: usize) -> Self {
        match num {
            0 => PrimitiveShape::String,
            1 => PrimitiveShape::U64,
            2 => PrimitiveShape::I64,
            3 => PrimitiveShape::F32,
            4 => PrimitiveShape::F64,
            5 => PrimitiveShape::Bool,
            6 => PrimitiveShape::Null,
            _ => panic!("unknown value: {}", num),
        }
    }
}

/// Arrays may contain either a primitive or an object whose values are primitives
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum ShapePrimitiveType {
    /// Primitive type
    Primitive(PrimitiveShape),
    /// Nested shape that can only contain primitives
    NestedPrimitive(BTreeMap<String, PrimitiveShape>),
}
impl From<ValuePrimitiveType> for ShapePrimitiveType {
    fn from(val: ValuePrimitiveType) -> Self {
        match val {
            ValuePrimitiveType::Primitive(prim) => ShapePrimitiveType::Primitive(prim.into()),
            ValuePrimitiveType::NestedPrimitive(nested) => {
                let mut nested_map = BTreeMap::new();
                for (key, value) in nested {
                    nested_map.insert(key, value.into());
                }
                ShapePrimitiveType::NestedPrimitive(nested_map)
            },
        }
    }
}
impl ShapePrimitiveType {
    fn encode(&self, shape_store: &mut Vec<ColumnValue>, cache: &mut ColumnCacheWriter) {
        match self {
            Self::Primitive(prim) => prim.encode(shape_store, cache),
            Self::NestedPrimitive(nested) => {
                shape_store.push(ShapePair::encode(1.into(), nested.len()).into());
                for (key, value) in nested {
                    shape_store.push(cache.add_string(key.clone()).into());
                    value.encode(shape_store, cache);
                }
            },
        }
    }

    fn decode(store: &mut Vec<usize>, cache: &mut ColumnCacheReader) -> Self {
        let shape_pair = ShapePair::decode(store.pop().unwrap());
        match shape_pair.p_type {
            ShapeDefinition::Primitive =>
                Self::Primitive(PrimitiveShape::from(shape_pair.count_or_col)),
            ShapeDefinition::Object => {
                let mut nested = BTreeMap::new();
                for _ in 0..shape_pair.count_or_col {
                    nested.insert(
                        cache.get_string(store.pop().unwrap()),
                        PrimitiveShape::from(store.pop().unwrap())
                    );
                }
                Self::NestedPrimitive(nested)
            },
            _ => panic!("Unknown shape definition: {:?}", shape_pair),
        }
    }

    fn merge(&mut self, other: &Self) {
        match (self, other) {
            (ShapePrimitiveType::Primitive(self_prim), ShapePrimitiveType::Primitive(other_prim)) => {
                self_prim.merge(other_prim);
            }
            (ShapePrimitiveType::NestedPrimitive(self_nested), ShapePrimitiveType::NestedPrimitive(other_nested)) => {
                for (key, value) in other_nested {
                    if self_nested.contains_key(key) {
                        self_nested.get_mut(key).unwrap().merge(value);
                    } else {
                        self_nested.insert(key.clone(), value.clone());
                    }
                }
            }
            _ => panic!("shape mismatch"),
        }
    }
}

/// Shape types that can be found in a shapes object.
/// Either a primitive, an array containing any type, or a nested shape.
/// If the type is an array, all elements must be the same type
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum ShapeType {
    /// Primitive type
    Primitive(PrimitiveShape),
    /// Nested shape that can only contain primitives
    Array(Vec<ShapePrimitiveType>),
    /// Nested shape
    Nested(Shape),
}
impl From<ValueType> for ShapeType {
    fn from(val: ValueType) -> Self {
        match val {
            ValueType::Primitive(prim) => ShapeType::Primitive(prim.into()),
            ValueType::Nested(nested) => {
                let mut nested_map: BTreeMap<String, ShapeType> = BTreeMap::new();
                for (key, value) in nested.0 {
                    nested_map.insert(key, value.into());
                }
                ShapeType::Nested(Shape(nested_map))
            },
            ValueType::Array(array) => {
                let validated = validate_types(&array);
                ShapeType::Array(vec![validated])
            },
        }
    }
}
impl ShapeType {
    fn encode(&self, shape_store: &mut Vec<ColumnValue>, cache: &mut ColumnCacheWriter) {
        match self {
            Self::Primitive(prim) => prim.encode(shape_store, cache),
            Self::Array(array) => {
                shape_store.push(0.into());
                array.first().unwrap().encode(shape_store, cache);
            },
            Self::Nested(nested) => {
                nested.encode(shape_store, cache);
            },
        }
    }

    fn decode(store: &mut Vec<usize>, cache: &mut ColumnCacheReader) -> Self {
        let shape_pair = ShapePair::decode(store.pop().unwrap());
        match shape_pair.p_type {
            ShapeDefinition::Primitive =>
                Self::Primitive(PrimitiveShape::from(shape_pair.count_or_col)),
            ShapeDefinition::Array =>
                Self::Array(vec![ShapePrimitiveType::decode(store, cache)]),
            ShapeDefinition::Object => Self::Nested(Shape::decode(store, cache)),
        }
    }

    fn merge(&mut self, other: &Self) {
        match (self, other) {
            (Self::Primitive(a), Self::Primitive(b)) => a.merge(b),
            (Self::Array(a), Self::Array(b)) => {
                a.first_mut().unwrap().merge(b.first().unwrap());
            },
            (Self::Nested(a), Self::Nested(b)) => a.merge(b),
            _ => panic!("Can't merge"),
        };
    }
}

/// The Shape Object
#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Shape(BTreeMap<String, ShapeType>);
impl From<Value> for Shape {
    fn from(val: Value) -> Self {
        let mut shape = BTreeMap::new();
        for (key, value) in val.0 {
            shape.insert(key, value.into());
        }
        Shape(shape)
    }
}
impl From<&[Value]> for Shape {
    fn from(val: &[Value]) -> Self {
        let mut shape = Shape(BTreeMap::new());
        for v in val { shape.merge(&v.clone().into()); }
        shape
    }
}
impl Shape {
    fn encode(&self, shape_store: &mut Vec<ColumnValue>, cache: &mut ColumnCacheWriter) {
        shape_store.push(ShapePair::encode(1.into(), self.0.len()).into());
        for (key, value) in &self.0 {
            shape_store.push(cache.add_string(key.clone()).into());
            value.encode(shape_store, cache);
        }
    }

    fn decode(store: &mut Vec<usize>, cache: &mut ColumnCacheReader) -> Self {
        let mut map = BTreeMap::<String, ShapeType>::new();
        let shape_pair = ShapePair::decode(store.pop().unwrap());
        if shape_pair.p_type != 1.into() { panic!("expected object shape") }
        for _ in 0..shape_pair.count_or_col {
            let key = cache.get_string(store.pop().unwrap());
            let shape = ShapeType::decode(store, cache);
            map.insert(key, shape);
        }
        Shape(map)
    }

    pub fn merge(&mut self, other: &Self)  {
        for (key, value) in &other.0 {
            self.0.entry(key.clone())
                .and_modify(|val| val.merge(value))
                .or_insert_with(|| value.clone());
        }
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

pub fn decode_shape(shape_index: usize, cache: &mut ColumnCacheReader) -> Shape {
    let mut shape_store = cache.get_shapes(shape_index);
    // duplicate the array to avoid modifying the original
    Shape::decode(&mut shape_store, cache)
  }

/// A shape pair for stronger compression and decoding
#[derive(Debug, Clone, PartialEq)]
struct ShapePair {
    /// The type (0 - array, 1 - object, 2 - value)
    pub p_type: ShapeDefinition,
    /// the length if object or array; or the column to read from
    pub count_or_col: usize,
}
impl ShapePair {
    /// encode a shape pair
    fn encode(p_type: ShapeDefinition, count_or_col: usize) -> usize {
        (count_or_col << 2) + p_type as usize
    }

    /// decode a shape pair
    fn decode(num: usize) -> ShapePair {
        ShapePair {
            p_type: (num & 0b11).into(),
            count_or_col: num >> 2,
        }
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


//? VALUE

/// Primitive types supported by Properties
#[derive(Serialize, Default, Deserialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum PrimitiveValue {
    /// String type utf8 encoded
    String(String),
    /// unsigned 64 bit integer
    U64(u64),
    /// signed 64 bit integer
    I64(i64),
    /// floating point number
    F32(f32),
    /// double precision floating point number
    F64(f64),
    /// boolean
    Bool(bool),
    /// null
    #[default] Null,
}
impl PrimitiveValue {
    fn encode(&self, shape: &PrimitiveShape, store: &mut Vec<ColumnValue>, cache: &mut ColumnCacheWriter) {
        match (self, shape) {
            // string
            (PrimitiveValue::String(s), PrimitiveShape::String)
                => store.push(cache.add_string(s.clone()).into()),
            // u64
            (PrimitiveValue::U64(u), PrimitiveShape::U64)
                => store.push(cache.add_u64(*u).into()),
            // i64
            (PrimitiveValue::U64(u), PrimitiveShape::I64)
                => store.push(cache.add_i64(*u as i64).into()),
            (PrimitiveValue::I64(i), PrimitiveShape::I64)
                => store.push(cache.add_i64(*i).into()),
            // f32
            (PrimitiveValue::U64(u), PrimitiveShape::F32)
                => store.push(cache.add_f32(*u as f32).into()),
            (PrimitiveValue::I64(i), PrimitiveShape::F32)
                => store.push(cache.add_f32(*i as f32).into()),
            (PrimitiveValue::F32(f), PrimitiveShape::F32)
                => store.push(cache.add_f32(*f).into()),
            // f64
            (PrimitiveValue::U64(u), PrimitiveShape::F64)
                => store.push(cache.add_f64(*u as f64).into()),
            (PrimitiveValue::I64(i), PrimitiveShape::F64)
                => store.push(cache.add_f64(*i as f64).into()),
            (PrimitiveValue::F32(f), PrimitiveShape::F64)
                => store.push(cache.add_f64(*f as f64).into()),
            (PrimitiveValue::F64(f), PrimitiveShape::F64)
                => store.push(cache.add_f64(*f).into()),
            // bool
            (PrimitiveValue::Bool(b), PrimitiveShape::Bool)
                => store.push(cache.add_u64(if *b { 1 } else { 0 }).into()),
            // null
            (PrimitiveValue::Null, PrimitiveShape::Null) => {},
            _ => panic!("shape mismatch"),
        }
    }

    fn decode(
        shape: &PrimitiveShape,
        store: &mut Vec<usize>,
        cache: &mut ColumnCacheReader
    ) -> Self {
        let col_val = store.remove(0);
        match shape {
            PrimitiveShape::String => PrimitiveValue::String(cache.get_string(col_val)),
            PrimitiveShape::U64 => PrimitiveValue::U64(cache.get_unsigned(col_val)),
            PrimitiveShape::I64 => PrimitiveValue::I64(cache.get_signed(col_val)),
            PrimitiveShape::F32 => PrimitiveValue::F32(cache.get_float(col_val)),
            PrimitiveShape::F64 => PrimitiveValue::F64(cache.get_double(col_val)),
            PrimitiveShape::Bool => PrimitiveValue::Bool(cache.get_unsigned(col_val) == 1),
            PrimitiveShape::Null => PrimitiveValue::Null,
        }
    }
}
impl From<&MapboxValue> for PrimitiveValue {
    fn from(mval: &MapboxValue) -> Self {
        match mval {
            MapboxValue::String(string) => PrimitiveValue::String(string.clone()),
            MapboxValue::UInt(usigned) => PrimitiveValue::U64(*usigned),
            MapboxValue::Int(signed) => PrimitiveValue::I64(*signed as i64),
            MapboxValue::SInt(signed) => PrimitiveValue::I64(*signed),
            MapboxValue::Float(float) => PrimitiveValue::F32(*float),
            MapboxValue::Double(double) => PrimitiveValue::F64(*double),
            MapboxValue::Bool(boolean) => PrimitiveValue::Bool(*boolean),
            MapboxValue::Null => PrimitiveValue::Null,
        }
    }
}

/// Arrays may contain either a primitive or an object whose values are primitives
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum ValuePrimitiveType {
    /// Primitive type
    Primitive(PrimitiveValue),
    /// Nested shape that can only contain primitives
    NestedPrimitive(BTreeMap<String, PrimitiveValue>),
}
impl ValuePrimitiveType {
    fn encode(
        &self,
        shape: &ShapePrimitiveType,
        store: &mut Vec<ColumnValue>,
        cache: &mut ColumnCacheWriter
    ) {
        match (shape, self) {
            (
                ShapePrimitiveType::Primitive(shape_prim),
                ValuePrimitiveType::Primitive(value_prim),
            ) => {
                value_prim.encode(shape_prim, store, cache);
            },
            (
                ShapePrimitiveType::NestedPrimitive(shape_nest),
                ValuePrimitiveType::NestedPrimitive(value_nest),
            ) => {
                for (key, prim_shape) in shape_nest {
                    let val = value_nest.get(key).unwrap();
                    val.encode(prim_shape, store, cache);
                }
            },
            _ => { panic!("shape and value do not match") },
        }
    }

    fn decode(
        shape: &ShapePrimitiveType,
        store: &mut Vec<usize>,
        cache: &mut ColumnCacheReader
    ) -> Self {
        match shape {
            ShapePrimitiveType::Primitive(shape_prim) => {
                ValuePrimitiveType::Primitive(PrimitiveValue::decode(shape_prim, store, cache))
            },
            ShapePrimitiveType::NestedPrimitive(shape_nest) => {
                ValuePrimitiveType::NestedPrimitive(
                    shape_nest
                        .iter()
                        .map(|(key, shape)| (key.clone(), PrimitiveValue::decode(shape, store, cache)))
                        .collect()
                )
            },
        }
    }

    fn same_nested(&self, nested: &BTreeMap<String, PrimitiveValue>) -> bool {
        match self {
            ValuePrimitiveType::Primitive(_) => false,
            ValuePrimitiveType::NestedPrimitive(val) => val == nested,
        }
    }
}

/// Supports primitive types `string`, `number`, `boolean`, `null`
/// May be an array of those types, or an object of those types
/// Object keys are always strings, values can be any basic type, an array, or a nested object.
/// Array values must all be the same type.
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum ValueType {
    /// A primitive value
    Primitive(PrimitiveValue),
    /// An array of values
    Array(Vec<ValuePrimitiveType>),
    /// A nested object
    Nested(Value),
}
impl ValueType {
    fn encode(
        &self,
        shape: &ShapeType,
        store: &mut Vec<ColumnValue>,
        cache: &mut ColumnCacheWriter
    ) {
        match (self, shape) {
            (ValueType::Primitive(val), ShapeType::Primitive(shape)) => {
                val.encode(shape, store, cache);
            },
            (ValueType::Array(vals), ShapeType::Array(shape)) => {
                for val in vals {
                    val.encode(&shape[0], store, cache);
                }
            },
            (ValueType::Nested(val), ShapeType::Nested(shape)) => {
                val.encode(shape, store, cache);
            },
            _ => { panic!("shape and value do not match") },
        }
    }

    fn decode(
        shape: &ShapeType,
        store: &mut Vec<usize>,
        cache: &mut ColumnCacheReader
    ) -> Self {
        match shape {
            ShapeType::Primitive(shape_prim) => {
                ValueType::Primitive(PrimitiveValue::decode(shape_prim, store, cache))
            },
            ShapeType::Array(shape_arr) => {
                let mut val = Vec::<ValuePrimitiveType>::new();
                let len = store.remove(0);
                for _ in 0..len {
                    val.push(ValuePrimitiveType::decode(&shape_arr[0], store, cache));
                }
                ValueType::Array(val)
            },
            ShapeType::Nested(shape) => {
                ValueType::Nested(Value::decode(shape, store, cache))
            },
        }
    }
}
impl From<&MapboxValue> for ValueType {
    fn from(mval: &MapboxValue) -> Self {
        ValueType::Primitive(mval.into())
    }
}

/// Value design
#[derive(Default, Serialize, Deserialize, Debug, Clone, PartialEq)]
pub struct Value(BTreeMap<String, ValueType>);
impl Value {
    fn encode(
        &self,
        shape: &Shape,
        store: &mut Vec<ColumnValue>,
        cache: &mut ColumnCacheWriter
    ) {
        for (key, shape_type) in &shape.0 {
            let val = self.0.get(key).unwrap();
            val.encode(shape_type, store, cache);
        }
    }

    fn decode(
        shape: &Shape,
        store: &mut Vec<usize>,
        cache: &mut ColumnCacheReader
    ) -> Self {
        let mut value = BTreeMap::new();
        for (key, shape_type) in &shape.0 {
            let val = ValueType::decode(shape_type, store, cache);
            value.insert(key.clone(), val);
        }
        Value(value)
    }
}
impl From<&MapboxProperties> for Value {
    fn from(mval: &MapboxProperties) -> Self {
        let mut value = BTreeMap::new();
        for (key, val) in mval {
            value.insert(key.clone(), val.into());
        }
        Value(value)
    }
}
/// Value of a features properties object
pub type Properties = Value;
/// Value of a feature's M-Values object
pub type MValue = Value;

pub fn encode_value(value: &Value, shape: &Shape, cache: &mut ColumnCacheWriter) -> usize {
    let mut value_store: Vec<ColumnValue> = vec![];
    value.encode(shape, &mut value_store, cache);
    cache.add_shapes(value_store)
}

pub fn decode_value(value_index: usize, shape: &Shape, cache: &mut ColumnCacheReader) -> Value {
    let value_store = cache.get_shapes(value_index);
    Value::decode(shape, &mut value_store.clone(), cache)
}

/// LineString Properties Value
pub type LineStringMValues = Vec<MValue>;
/// MultiLineString MValues Value
pub type MultiLineStringMValues = Vec<LineStringMValues>;
/// Polygon MValues Value
pub type PolygonMValues = Vec<LineStringMValues>;
/// MultiPolygon MValues Value
pub type MultiPolygonMValues = Vec<PolygonMValues>;

/// All possible M-Value shapes
#[derive(Serialize, Deserialize, Debug, Clone, PartialEq)]
#[serde(untagged)]
pub enum MValues {
    /// Single M-Value
    MValue(MValue),
    /// LineString M-Value
    LineStringMValues(LineStringMValues),
    /// MultiLineString M-Value
    MultiLineStringMValues(MultiLineStringMValues),
    /// Polygon M-Value
    PolygonMValues(PolygonMValues),
    /// MultiPolygon M-Value
    MultiPolygonMValues(MultiPolygonMValues),
}

//? The Following are utility functions when the user doesn't pre-define the Properties/M-Value
//? Shapes to store:
  
/// This is primarily to check if the type is a primitive.
/// If the primitive is a number, find the "depth", the most complex is f64, then i64, then u64.
/// Otherwise, if the primitives don't match, throw an error.
/// If the type is NOT a primitive, ensure that all types in the array match
/// returns - a single type from the list to validate the correct type to be parsed from values later
pub fn validate_types(types: &[ValuePrimitiveType]) -> ShapePrimitiveType {
    match types.first() {
        Some(ValuePrimitiveType::Primitive(primitive)) => {
            let mut base: PrimitiveShape = primitive.clone().into();
            let is_number = base.is_number();
            for t in types {
                match t {
                    ValuePrimitiveType::Primitive(t_prim) => {
                        let prim_shape = t_prim.clone().into();
                        if !base.matching_shape(&prim_shape) {
                            panic!("All types must be the same");
                        } else if is_number {
                            base = PrimitiveShape::get_highest_order_number(&base, &prim_shape);
                        }
                        // otherwise do nothing
                    }
                    _ => {
                        panic!("All types must be the same");
                    }
                }
            }

            ShapePrimitiveType::Primitive(base)
        },
        Some(ValuePrimitiveType::NestedPrimitive(nested)) => {
            // iterate and check if each following types match
            for t in types[1..].iter() {
                if t.same_nested(nested) {
                    panic!("All types must be the same");
                }
            }

            ValuePrimitiveType::NestedPrimitive(nested.clone()).into()
        }
        None => ShapePrimitiveType::Primitive(PrimitiveShape::Null),
    }
}
