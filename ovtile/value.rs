extern crate alloc;

use alloc::{boxed::Box, collections::btree_map::BTreeMap, string::String, vec::Vec};

use pbf::{ProtoRead, ProtoWrite, Protobuf, Type};

#[derive(Default, Clone, Debug, PartialEq)]
pub struct NestedSearch {
    pub key: String,
    pub nested: Option<Box<NestedSearch>>,
}
impl NestedSearch {
    pub fn from_value(value: Value) -> Self {
        match value {
            Value::String(key) => NestedSearch { key, nested: None },
            Value::Object(object) => {
                // we assume that the object is designed to look like a nested search
                let (key, nested) = object.into_iter().next().unwrap();
                NestedSearch {
                    key,
                    nested: Some(Box::new(NestedSearch::from_value(nested))),
                }
            }
            _ => NestedSearch::default(),
        }
    }
}

pub trait TryFromValue<T> {
    fn try_from_value(value: &Value) -> Option<T>;
}
impl TryFromValue<bool> for bool {
    fn try_from_value(value: &Value) -> Option<bool> {
        if let Value::Bool(b) = value {
            Some(*b)
        } else {
            None
        }
    }
}
impl TryFromValue<i32> for i32 {
    fn try_from_value(value: &Value) -> Option<i32> {
        if let Value::Int(i) = value {
            Some(*i)
        } else {
            None
        }
    }
}
impl TryFromValue<i64> for i64 {
    fn try_from_value(value: &Value) -> Option<i64> {
        if let Value::SInt(i) = value {
            Some(*i)
        } else {
            None
        }
    }
}
impl TryFromValue<u64> for u64 {
    fn try_from_value(value: &Value) -> Option<u64> {
        if let Value::UInt(u) = value {
            Some(*u)
        } else {
            None
        }
    }
}
impl TryFromValue<f32> for f32 {
    fn try_from_value(value: &Value) -> Option<f32> {
        if let Value::Float(f) = value {
            Some(*f)
        } else {
            None
        }
    }
}
impl TryFromValue<f64> for f64 {
    fn try_from_value(value: &Value) -> Option<f64> {
        if let Value::Double(d) = value {
            Some(*d)
        } else {
            None
        }
    }
}

#[derive(Debug, PartialEq)]
pub enum Value {
    Null,
    Bool(bool),
    Int(i32),
    SInt(i64),
    UInt(u64),
    Float(f32),
    Double(f64),
    String(String),
    Array(Vec<Value>),
    Object(BTreeMap<String, Value>),
}
impl Value {
    pub fn has(&self, input: &Value) -> bool {
        self == input
    }

    pub fn is_array(&self) -> bool {
        matches!(self, Value::Array(_))
    }

    pub fn is_object(&self) -> bool {
        matches!(self, Value::Object(_))
    }

    pub fn to_value<T>(&self) -> Option<T>
    where
        T: TryFromValue<T>,
    {
        match self {
            Value::Array(_) | Value::Object(_) | Value::Null => None,
            _ => T::try_from_value(self),
        }
    }

    pub fn to_vec<T>(&self) -> Vec<T>
    where
        T: TryFromValue<T>,
    {
        match self {
            Value::Array(array) => array
                .iter()
                .filter_map(|item| T::try_from_value(item))
                .collect(),
            _ => Vec::new(),
        }
    }

    pub fn has_nested(&self, input: &NestedSearch) -> bool {
        match self {
            Value::Object(object) => {
                if let Some(nested) = &input.nested {
                    if let Some(value) = object.get(&input.key) {
                        value.has_nested(nested)
                    } else {
                        false
                    }
                } else {
                    object.contains_key(&input.key)
                }
            }
            _ => false,
        }
    }

    pub fn get(&self, input: &NestedSearch) -> Option<&Value> {
        match self {
            Value::Object(object) => {
                if let Some(nested) = &input.nested {
                    if let Some(value) = object.get(&input.key) {
                        value.get(nested)
                    } else {
                        None
                    }
                } else {
                    object.get(&input.key)
                }
            }
            _ => None,
        }
    }
}
impl ProtoRead for Value {
    fn read(&mut self, tag: u64, pb: &mut Protobuf) {
        match tag {
            0 => *self = Value::Null,
            1 => *self = Value::String(pb.read_string()),
            2 => *self = Value::Float(pb.read_varint::<f32>()),
            3 => *self = Value::Double(pb.read_varint::<f64>()),
            4 => *self = Value::Int(pb.read_varint::<i32>()),
            5 => *self = Value::UInt(pb.read_varint::<u64>()),
            6 => *self = Value::SInt(pb.read_s_varint::<i64>()),
            7 => *self = Value::Bool(pb.read_varint::<bool>()),
            8 => {
                let mut array = Vec::new();
                let size = pb.read_varint::<u64>();
                for _ in 0..size {
                    let mut value = Value::Null;
                    let field = pb.read_field();
                    value.read(field.tag, pb);
                    array.push(value);
                }
                *self = Value::Array(array);
            }
            9 => {
                let mut object = BTreeMap::new();
                let size = pb.read_varint::<u64>();
                for _ in 0..size {
                    let key = pb.read_string();
                    let mut value = Value::Null;
                    let field = pb.read_field();
                    value.read(field.tag, pb);
                    object.insert(key, value);
                }
                *self = Value::Object(object);
            }
            _ => panic!("unknown tag: {}", tag),
        }
    }
}
impl ProtoWrite for Value {
    fn write(&self, pbf: &mut Protobuf) {
        match self {
            Value::Null => pbf.write_field(0, Type::None),
            Value::String(value) => pbf.write_string_field(1, value),
            Value::Float(value) => pbf.write_varint_field(2, *value),
            Value::Double(value) => pbf.write_varint_field(3, *value),
            Value::Int(value) => pbf.write_varint_field(4, *value),
            Value::UInt(value) => pbf.write_varint_field(5, *value),
            Value::SInt(value) => pbf.write_s_varint_field(6, *value),
            Value::Bool(value) => pbf.write_varint_field(7, *value),
            Value::Array(array) => {
                pbf.write_varint_field(8, array.len() as u64);
                for value in array {
                    value.write(pbf);
                }
            }
            Value::Object(object) => {
                pbf.write_varint_field(9, object.len() as u64);
                for (key, value) in object {
                    pbf.write_string(key);
                    value.write(pbf);
                }
            }
        }
    }
}
