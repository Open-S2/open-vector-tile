#[cfg(test)]
mod tests {
    extern crate alloc;
    use alloc::{collections::BTreeMap, rc::Rc, string::String};
    use core::cell::RefCell;
    use ovtile::{
        base::{BaseVectorFeature, BaseVectorPointsFeature},
        mapbox::{write_feature, MapboxVectorFeature, Value as MapboxValue},
        open::Value,
        CustomOrdWrapper, Point,
    };
    use pbf::Protobuf;

    #[test]
    fn test_mapbox_vector_feature_write_read() {
        let example_value_str = r#"{
            "a": 3,
            "b": 1,
            "c": 2.2
        }"#;
        let example_value = serde_json::from_str::<Value>(example_value_str).unwrap();
        let example_value_str_2 = r#"{
            "a": -2,
            "b": 1,
            "c": 2.2
        }"#;
        let example_value2 = serde_json::from_str::<Value>(example_value_str_2).unwrap();

        let feature = BaseVectorPointsFeature::new(
            Some(2),
            vec![Point::new_with_m(0, 0, example_value2.clone())],
            example_value.clone(),
            None,
        );
        let base_feature = BaseVectorFeature::BaseVectorPointsFeature(feature);

        let mut keys: BTreeMap<String, usize> = BTreeMap::new();
        let mut values: BTreeMap<MapboxValue, usize> = BTreeMap::new();
        let mut pbf_write = Protobuf::new();
        pbf_write
            .write_bytes_field(3, &write_feature(&base_feature, &mut keys, &mut values, false));
        let data = pbf_write.take();
        let pbf = Rc::new(RefCell::new(data.into()));

        let mut mapbox_feature = MapboxVectorFeature::new(
            pbf.clone(),
            true,
            4096,
            1,
            Rc::new(RefCell::new(keys.into_keys().collect())),
            Rc::new(RefCell::new(values.into_keys().collect())),
        );
        let mut pbf_mut = pbf.borrow_mut();
        pbf_mut.read_field();
        pbf_mut.read_message(&mut mapbox_feature);

        assert!(mapbox_feature.is_s2);
    }

    #[test]
    fn test_value() {
        let mut pb = Protobuf::new();
        let string_value = MapboxValue::String("test".to_string());
        pb.write_message(1, &string_value);
        let uint_value = MapboxValue::UInt(1);
        pb.write_message(2, &uint_value);
        let sint_value = MapboxValue::SInt(-1);
        pb.write_message(3, &sint_value);
        let float_value = MapboxValue::Float(CustomOrdWrapper(-1.1));
        pb.write_message(4, &float_value);
        let double_value = MapboxValue::Double(CustomOrdWrapper(1.1));
        pb.write_message(5, &double_value);
        let bool_value = MapboxValue::Bool(true);
        pb.write_message(6, &bool_value);
        let null_value = MapboxValue::Null;
        pb.write_message(7, &null_value);

        let bytes = pb.take();

        let mut pb_read = Protobuf::from(bytes);

        pb_read.read_field();
        let mut read_string = MapboxValue::Null;
        pb_read.read_message(&mut read_string);
        assert_eq!(read_string, string_value);

        pb_read.read_field();
        let mut read_uint = MapboxValue::Null;
        pb_read.read_message(&mut read_uint);
        assert_eq!(read_uint, uint_value);

        pb_read.read_field();
        let mut read_sint = MapboxValue::Null;
        pb_read.read_message(&mut read_sint);
        assert_eq!(read_sint, sint_value);

        pb_read.read_field();
        let mut read_float = MapboxValue::Null;
        pb_read.read_message(&mut read_float);
        assert_eq!(read_float, float_value);

        pb_read.read_field();
        let mut read_double = MapboxValue::Null;
        pb_read.read_message(&mut read_double);
        assert_eq!(read_double, double_value);

        pb_read.read_field();
        let mut read_bool = MapboxValue::Null;
        pb_read.read_message(&mut read_bool);
        assert_eq!(read_bool, bool_value);

        pb_read.read_field();
        let mut read_null = MapboxValue::Null;
        pb_read.read_message(&mut read_null);
        assert_eq!(read_null, null_value);
    }
}
