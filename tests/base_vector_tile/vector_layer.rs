#[cfg(test)]
mod tests {
    extern crate alloc;
    use ovtile::{
        base::{BaseVectorFeature, BaseVectorLayer, BaseVectorPointsFeature},
        open::{Shape, Value},
        Point,
    };

    #[test]
    fn test_base_vector_layer_feature() {
        let example_shape_str = r#"{
            "a": "u64",
            "b": "u64",
            "c": "f32"
        }"#;
        let example_shape = serde_json::from_str::<Shape>(example_shape_str).unwrap();
        let example_shape_str_2 = r#"{
            "a": "i64",
            "b": "u64",
            "c": "f32"
        }"#;
        let example_shape_2 = serde_json::from_str::<Shape>(example_shape_str_2).unwrap();
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

        let mut layer = BaseVectorLayer::new("test".to_string(), 4096.into(), vec![], None, None);
        assert!(layer.is_empty());

        let feature = BaseVectorPointsFeature::new(
            None,
            vec![Point::new_with_m(0, 0, example_value.clone()), Point::new(1, 1)],
            example_value.clone(),
            None,
        );
        let feature2 = BaseVectorPointsFeature::new(
            None,
            vec![Point::new_with_m(0, 0, example_value2.clone()), Point::new(1, 1)],
            example_value.clone(),
            None,
        );

        // add_feature
        let feature_wrapped = BaseVectorFeature::BaseVectorPointsFeature(feature);
        let feature_wrapped2 = BaseVectorFeature::BaseVectorPointsFeature(feature2);
        layer.add_feature(feature_wrapped.clone());
        layer.add_feature(feature_wrapped2);
        assert_eq!(layer.len(), 2);
        assert!(!layer.is_empty());

        let feature_get = layer.feature(0);
        assert_eq!(*feature_get, feature_wrapped);

        // check shape and m_shape
        assert_eq!(layer.shape, example_shape);
        assert_eq!(layer.m_shape, Some(example_shape_2));
    }
}
