#[cfg(test)]
mod tests {
    extern crate alloc;

    use open_vector_tile::open::{
        ColumnCacheReader, ColumnCacheWriter, ColumnValue, ShapeDefinition, ShapePair,
        ShapeToStore, ValueToStore,
    };
    use pbf::Protobuf;
    use s2json::{
        impls::shape::validate_types, PrimitiveShape, PrimitiveShapeType, PrimitiveValue, Shape,
        ShapePrimitive, ShapeType, Value, ValuePrimitive, ValuePrimitiveType, ValueType,
    };
    use std::panic::{self, AssertUnwindSafe};

    #[test]
    fn encode_decode_shape() {
        let json_shape = r#"{
            "a": "i64",
            "b": ["string"],
            "c": {
                "d": "f64",
                "e": "bool",
                "f": "null",
                "g": {
                    "h": "i64",
                    "i": "string"
                }
            },
            "d": [{
                "j": "f64",
                "k": "bool"
            }]
        }"#;

        let shape = serde_json::from_str::<Shape>(json_shape).unwrap();
        assert_eq!(
            shape,
            Shape::from([
                ("a".to_string(), ShapeType::Primitive(PrimitiveShape::I64)),
                (
                    "b".to_string(),
                    ShapeType::Array(vec![PrimitiveShapeType::Primitive(PrimitiveShape::String)])
                ),
                (
                    "c".to_string(),
                    ShapeType::Nested(Shape::from([
                        ("d".to_string(), ShapeType::Primitive(PrimitiveShape::F64)),
                        ("e".to_string(), ShapeType::Primitive(PrimitiveShape::Bool)),
                        ("f".to_string(), ShapeType::Primitive(PrimitiveShape::Null)),
                        (
                            "g".to_string(),
                            ShapeType::Nested(Shape::from([
                                ("h".to_string(), ShapeType::Primitive(PrimitiveShape::I64)),
                                ("i".to_string(), ShapeType::Primitive(PrimitiveShape::String)),
                            ]))
                        )
                    ]))
                ),
                (
                    "d".to_string(),
                    ShapeType::Array(vec![PrimitiveShapeType::NestedPrimitive(
                        ShapePrimitive::from([
                            ("j".to_string(), PrimitiveShape::F64),
                            ("k".to_string(), PrimitiveShape::Bool),
                        ])
                    )])
                )
            ])
        );

        // encode:
        let mut shape_store: Vec<ColumnValue> = vec![];
        let mut cache = ColumnCacheWriter::default();
        shape.encode(&mut shape_store, &mut cache);

        assert_eq!(
            shape_store,
            vec![
                ColumnValue::Number(17),
                ColumnValue::Number(0),
                ColumnValue::Number(10),
                ColumnValue::Number(1),
                ColumnValue::Number(0),
                ColumnValue::Number(2),
                ColumnValue::Number(2),
                ColumnValue::Number(17),
                ColumnValue::Number(3),
                ColumnValue::Number(18),
                ColumnValue::Number(4),
                ColumnValue::Number(22),
                ColumnValue::Number(5),
                ColumnValue::Number(26),
                ColumnValue::Number(6),
                ColumnValue::Number(9),
                ColumnValue::Number(7),
                ColumnValue::Number(10),
                ColumnValue::Number(8),
                ColumnValue::Number(2),
                ColumnValue::Number(3),
                ColumnValue::Number(0),
                ColumnValue::Number(9),
                ColumnValue::Number(9),
                ColumnValue::Number(18),
                ColumnValue::Number(10),
                ColumnValue::Number(22)
            ]
        );

        // lastly store the shape in the cache
        let shape_index = cache.add_shapes(shape_store);
        assert_eq!(shape_index, 0);

        // get cache data
        let mut pbf = Protobuf::new();
        pbf.write_message(0, &cache);
        let data = pbf.take();

        // decode:
        let mut pbf_read: Protobuf = data.into();
        let _field = pbf_read.read_field();
        let mut reader = ColumnCacheReader::new();
        pbf_read.read_message(&mut reader);

        let mut shape_read = reader.get_shapes(shape_index);
        assert_eq!(
            shape_read,
            vec![
                17, 0, 10, 1, 0, 2, 2, 17, 3, 18, 4, 22, 5, 26, 6, 9, 7, 10, 8, 2, 3, 0, 9, 9, 18,
                10, 22
            ]
        );

        // decode shape
        let shape_decoded = Shape::decode(&mut shape_read, &mut reader);
        assert_eq!(shape_decoded, shape);
    }

    #[test]
    fn shape_pair() {
        let encode = ShapePair::encode(ShapeDefinition::Object, 3);
        assert_eq!(encode, 13);

        let decode = ShapePair::decode(encode);
        assert_eq!(decode, ShapePair { p_type: ShapeDefinition::Object, count_or_col: 3 });

        let decode_from: ShapePair = 13.into();
        assert_eq!(decode_from, ShapePair { p_type: ShapeDefinition::Object, count_or_col: 3 });
    }

    #[test]
    fn shape_definition() {
        let zero = ShapeDefinition::from(0);
        assert_eq!(zero, ShapeDefinition::Array);
        let one = ShapeDefinition::from(1);
        assert_eq!(one, ShapeDefinition::Object);
        let two = ShapeDefinition::from(2);
        assert_eq!(two, ShapeDefinition::Primitive);
    }

    #[test]
    fn primitive_shape() {
        let int64 = PrimitiveShape::I64;
        let is_number = int64.is_number();
        assert!(is_number);
        assert!(int64.matching_shape(&PrimitiveShape::F32));
        assert!(!int64.matching_shape(&PrimitiveShape::String));
        // get_highest_order_number
        assert_eq!(
            PrimitiveShape::get_highest_order_number(&PrimitiveShape::F32, &PrimitiveShape::F64),
            PrimitiveShape::F64
        );
        assert_eq!(
            PrimitiveShape::get_highest_order_number(&PrimitiveShape::F64, &PrimitiveShape::F32),
            PrimitiveShape::F64
        );
        assert_eq!(
            PrimitiveShape::get_highest_order_number(&PrimitiveShape::F32, &PrimitiveShape::F32),
            PrimitiveShape::F32
        );
        assert_eq!(
            PrimitiveShape::get_highest_order_number(&PrimitiveShape::I64, &PrimitiveShape::F32),
            PrimitiveShape::F32
        );
        assert_eq!(
            PrimitiveShape::get_highest_order_number(&PrimitiveShape::U64, &PrimitiveShape::Null),
            PrimitiveShape::U64
        );
        assert_eq!(
            PrimitiveShape::get_highest_order_number(&PrimitiveShape::I64, &PrimitiveShape::I64),
            PrimitiveShape::I64
        );
        assert_eq!(
            PrimitiveShape::get_highest_order_number(&PrimitiveShape::F64, &PrimitiveShape::U64),
            PrimitiveShape::F64
        );

        // error if number doesn't exist
        let result = panic::catch_unwind(AssertUnwindSafe(|| PrimitiveShape::from(100)));
        assert!(result.is_err());
    }

    #[test]
    fn encode_decode_value() {
        let mut col = ColumnCacheWriter::default();
        let example_shape_str = r#"{
            "a": "i64",
            "b": "u64",
            "c": "f64"
        }"#;
        let example_shape = serde_json::from_str::<Shape>(example_shape_str).unwrap();
        let example_value_str = r#"{
            "a": 3,
            "b": 1,
            "c": 2.2
        }"#;
        let example_value = serde_json::from_str::<Value>(example_value_str).unwrap();
        let mut encode_value_store: Vec<ColumnValue> = vec![];
        example_value.encode(&example_shape, &mut encode_value_store, &mut col);
        // store value to column
        let encoded_value_index = col.add_shapes(encode_value_store);

        // store the column in a pbf
        let mut pbf = Protobuf::new();
        pbf.write_message(0, &col);
        let raw_data = pbf.take();

        // Now we decode the column
        let mut pbf_read: Protobuf = raw_data.into();
        let _field = pbf_read.read_field();
        let mut reader = ColumnCacheReader::new();
        pbf_read.read_message(&mut reader);
        let mut value_data = reader.get_shapes(encoded_value_index);

        let decoded_value = Value::decode(&example_shape, &mut value_data, &mut reader);
        assert_eq!(
            decoded_value,
            Value::from([
                ("a".to_string(), ValueType::Primitive(PrimitiveValue::I64(3))),
                ("b".to_string(), ValueType::Primitive(PrimitiveValue::U64(1))),
                ("c".to_string(), ValueType::Primitive(PrimitiveValue::F64(2.200000047683716))),
            ])
        );
    }

    #[test]
    fn validate_types_none() {
        assert_eq!(validate_types(&[]), PrimitiveShapeType::Primitive(PrimitiveShape::Null));

        assert_eq!(
            validate_types(&[
                ValuePrimitiveType::Primitive(PrimitiveValue::I64(3)),
                ValuePrimitiveType::Primitive(PrimitiveValue::I64(22)),
            ]),
            PrimitiveShapeType::Primitive(PrimitiveShape::I64)
        );

        assert_eq!(
            validate_types(&[
                ValuePrimitiveType::Primitive(PrimitiveValue::I64(3)),
                ValuePrimitiveType::Primitive(PrimitiveValue::U64(22)),
            ]),
            PrimitiveShapeType::Primitive(PrimitiveShape::I64)
        );

        assert_eq!(
            validate_types(&[
                ValuePrimitiveType::Primitive(PrimitiveValue::I64(3)),
                ValuePrimitiveType::Primitive(PrimitiveValue::F64(-22.2)),
            ]),
            PrimitiveShapeType::Primitive(PrimitiveShape::F64)
        );

        assert_eq!(
            validate_types(&[
                ValuePrimitiveType::NestedPrimitive(ValuePrimitive::from([
                    ("a".to_string(), PrimitiveValue::I64(3)),
                    ("b".to_string(), PrimitiveValue::String("hello".to_string())),
                ])),
                ValuePrimitiveType::NestedPrimitive(ValuePrimitive::from([
                    ("a".to_string(), PrimitiveValue::I64(22)),
                    ("b".to_string(), PrimitiveValue::String("world".to_string())),
                ])),
            ]),
            PrimitiveShapeType::NestedPrimitive(ShapePrimitive::from([
                ("a".to_string(), PrimitiveShape::I64),
                ("b".to_string(), PrimitiveShape::String),
            ]))
        );

        let error_case_one = panic::catch_unwind(AssertUnwindSafe(|| {
            validate_types(&[
                ValuePrimitiveType::NestedPrimitive(ValuePrimitive::from([
                    ("a".to_string(), PrimitiveValue::I64(3)),
                    ("b".to_string(), PrimitiveValue::String("hello".to_string())),
                ])),
                ValuePrimitiveType::NestedPrimitive(ValuePrimitive::from([
                    ("a".to_string(), PrimitiveValue::U64(5)),
                    ("b".to_string(), PrimitiveValue::F32(2.2)),
                ])),
            ])
        }));
        assert!(error_case_one.is_err());

        let error_case_two = panic::catch_unwind(AssertUnwindSafe(|| {
            validate_types(&[
                ValuePrimitiveType::NestedPrimitive(ValuePrimitive::from([
                    ("a".to_string(), PrimitiveValue::I64(3)),
                    ("b".to_string(), PrimitiveValue::String("hello".to_string())),
                ])),
                ValuePrimitiveType::Primitive(PrimitiveValue::I64(3)),
            ])
        }));
        assert!(error_case_two.is_err());

        let error_case_three = panic::catch_unwind(AssertUnwindSafe(|| {
            validate_types(&[
                ValuePrimitiveType::Primitive(PrimitiveValue::I64(3)),
                ValuePrimitiveType::Primitive(PrimitiveValue::String("test".to_string())),
            ])
        }));
        assert!(error_case_three.is_err());
    }

    #[test]
    fn encode_decode_nested_value() {
        let mut col = ColumnCacheWriter::default();
        let example_shape_str = r#"{
            "a": "i64",
            "b": ["string"],
            "c": {
                "d": "f64",
                "e": "bool",
                "f": "null",
                "g": "f32",
                "h": {
                    "i": "u64"
                }
            }
        }"#;
        let example_shape = serde_json::from_str::<Shape>(example_shape_str).unwrap();
        let example_value_str = r#"{
            "a": 3,
            "b": ["hello", "world"],
            "c": {
                "d": 2.2,
                "e": true,
                "f": null,
                "g": 4.5,
                "h": {
                    "i": 2
                }
            }
        }"#;
        let example_value = serde_json::from_str::<Value>(example_value_str).unwrap();
        let mut encode_value_store: Vec<ColumnValue> = vec![];
        example_value.encode(&example_shape, &mut encode_value_store, &mut col);
        let example_value_str_2 = r#"{
            "a": -1,
            "b": ["word", "up", "hello"]
        }"#;
        let example_value_2 = serde_json::from_str::<Value>(example_value_str_2).unwrap();
        let mut encode_value_store_2: Vec<ColumnValue> = vec![];
        example_value_2.encode(&example_shape, &mut encode_value_store_2, &mut col);
        // store value to column
        let encoded_value_index = col.add_shapes(encode_value_store);
        let encoded_value_index_2 = col.add_shapes(encode_value_store_2);

        // store the column in a pbf
        let mut pbf = Protobuf::new();
        pbf.write_message(0, &col);
        let raw_data = pbf.take();

        // Now we decode the column
        let mut pbf_read: Protobuf = raw_data.into();
        let _field = pbf_read.read_field();
        let mut reader = ColumnCacheReader::new();
        pbf_read.read_message(&mut reader);
        let mut value_data = reader.get_shapes(encoded_value_index);
        let mut value_data_2 = reader.get_shapes(encoded_value_index_2);

        let decoded_value = Value::decode(&example_shape, &mut value_data, &mut reader);
        assert_eq!(
            decoded_value,
            Value::from([
                ("a".to_string(), ValueType::Primitive(PrimitiveValue::I64(3))),
                (
                    "b".to_string(),
                    ValueType::Array(vec![
                        ValuePrimitiveType::Primitive(PrimitiveValue::String("hello".to_string())),
                        ValuePrimitiveType::Primitive(PrimitiveValue::String("world".to_string())),
                    ])
                ),
                (
                    "c".to_string(),
                    ValueType::Nested(Value::from([
                        (
                            "d".to_string(),
                            ValueType::Primitive(PrimitiveValue::F64(2.200000047683716))
                        ),
                        ("e".to_string(), ValueType::Primitive(PrimitiveValue::Bool(true))),
                        ("f".to_string(), ValueType::Primitive(PrimitiveValue::Null)),
                        ("g".to_string(), ValueType::Primitive(PrimitiveValue::F32(4.5))),
                        (
                            "h".to_string(),
                            ValueType::Nested(Value::from([(
                                "i".to_string(),
                                ValueType::Primitive(PrimitiveValue::U64(2))
                            )]))
                        ),
                    ]))
                )
            ])
        );

        let decoded_value_2 = Value::decode(&example_shape, &mut value_data_2, &mut reader);
        assert_eq!(
            decoded_value_2,
            Value::from([
                ("a".to_string(), ValueType::Primitive(PrimitiveValue::I64(-1))),
                (
                    "b".to_string(),
                    ValueType::Array(vec![
                        ValuePrimitiveType::Primitive(PrimitiveValue::String("word".to_string())),
                        ValuePrimitiveType::Primitive(PrimitiveValue::String("up".to_string())),
                        ValuePrimitiveType::Primitive(PrimitiveValue::String("hello".to_string())),
                    ])
                ),
                (
                    "c".to_string(),
                    ValueType::Nested(Value::from([
                        ("d".to_string(), ValueType::Primitive(PrimitiveValue::F64(0.0))),
                        ("e".to_string(), ValueType::Primitive(PrimitiveValue::Bool(false))),
                        ("f".to_string(), ValueType::Primitive(PrimitiveValue::Null)),
                        ("g".to_string(), ValueType::Primitive(PrimitiveValue::F32(0.0))),
                        (
                            "h".to_string(),
                            ValueType::Nested(Value::from([(
                                "i".to_string(),
                                ValueType::Primitive(PrimitiveValue::U64(0))
                            )]))
                        ),
                    ]))
                )
            ])
        );
    }

    // ValuePrimitiveType -> PrimitiveShapeType
    #[test]
    fn test_value_primitive_type_to_shape_primitive_type() {
        let vpt: ValuePrimitiveType = ValuePrimitiveType::Primitive(PrimitiveValue::I64(1));
        let spt = PrimitiveShapeType::Primitive(PrimitiveShape::I64);
        let res = PrimitiveShapeType::from(&vpt);
        assert_eq!(res, spt);

        // NestedPrimitive
        let vpt: ValuePrimitiveType = ValuePrimitiveType::NestedPrimitive(ValuePrimitive::from([
            ("a".to_string(), PrimitiveValue::I64(1)),
            ("b".to_string(), PrimitiveValue::String("hello".to_string())),
        ]));
        let spt = PrimitiveShapeType::NestedPrimitive(ShapePrimitive::from([
            ("a".to_string(), PrimitiveShape::I64),
            ("b".to_string(), PrimitiveShape::String),
        ]));
        let res = PrimitiveShapeType::from(&vpt);
        assert_eq!(res, spt);
    }

    #[test]
    fn mapbox_value_to_primitive_value() {
        // string
        assert_eq!(
            PrimitiveValue::from(&PrimitiveValue::String("hello".to_string())),
            PrimitiveValue::String("hello".to_string())
        );
        // U64
        assert_eq!(PrimitiveValue::from(&PrimitiveValue::U64(1)), PrimitiveValue::U64(1));
        // I64
        assert_eq!(PrimitiveValue::from(&PrimitiveValue::I64(1)), PrimitiveValue::I64(1));
        // F32
        assert_eq!(PrimitiveValue::from(&PrimitiveValue::F32(1.1)), PrimitiveValue::F32(1.1));
        // F64
        assert_eq!(PrimitiveValue::from(&PrimitiveValue::F64(1.1)), PrimitiveValue::F64(1.1));
        // bool
        assert_eq!(PrimitiveValue::from(&PrimitiveValue::Bool(true)), PrimitiveValue::Bool(true));
        // null
        assert_eq!(PrimitiveValue::from(&PrimitiveValue::Null), PrimitiveValue::Null);
    }
}
