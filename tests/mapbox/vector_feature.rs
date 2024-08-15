#[cfg(test)]
mod tests {
    extern crate alloc;
    use ovtile::{
        base::{BaseVectorFeature, BaseVectorPointsFeature},
        mapbox::{write_feature, MapboxVectorFeature, Value as MapboxValue},
        open::Value,
        Point,
    };

    use pbf::Protobuf;

    use alloc::collections::BTreeMap;
    use alloc::rc::Rc;
    use alloc::string::String;

    use core::cell::RefCell;

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
        pbf_write.write_bytes_field(3, &write_feature(&base_feature, &mut keys, &mut values));
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
}
