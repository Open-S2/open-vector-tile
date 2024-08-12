#[cfg(test)]
mod tests {
    extern crate alloc;
    use ovtile::{
        base::{
            decode_offset, encode_offset, BaseVectorFeature, BaseVectorLines3DFeature,
            BaseVectorLinesFeature, BaseVectorPoints3DFeature, BaseVectorPointsFeature,
            BaseVectorPolys3DFeature, BaseVectorPolysFeature, TesselationWrapper, VectorFeature,
        },
        open::{ColumnCacheWriter, FeatureType, Properties, Shape, Value},
        BBox, BBox3D, Point, Point3D, VectorGeometry, VectorLine3DWithOffset, VectorLineWithOffset,
        BBOX,
    };

    use alloc::collections::BTreeMap;
    use alloc::vec;

    #[test]
    fn test_base_vector_points_feature() {
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

        let feature = BaseVectorPointsFeature {
            id: Some(1),
            geometry: vec![Point::new(0, 0)],
            properties: Properties::default(),
            bbox: Some(BBox {
                left: 0.0,
                bottom: 0.0,
                right: 1.0,
                top: 1.0,
            }),
        };
        let feature2 = BaseVectorPointsFeature::new(
            None,
            vec![
                Point::new_with_m(0, 0, example_value.clone()),
                Point::new(1, 1),
            ],
            example_value.clone(),
            None,
        );

        // get_type
        assert_eq!(feature.get_type(), FeatureType::Points);
        assert_eq!(feature2.get_type(), FeatureType::Points);

        // properties
        assert_eq!(feature.properties(), &Properties::default());
        assert_eq!(feature2.properties(), &example_value);

        // has_bbox
        assert!(feature.has_bbox());
        assert!(!feature2.has_bbox());

        // has_offsets
        assert!(!feature.has_offsets());
        assert!(!feature2.has_offsets());

        // has_m_values
        assert!(!feature.has_m_values());
        assert!(feature2.has_m_values());

        // load_geometry
        assert_eq!(
            feature.load_geometry(),
            VectorGeometry::VectorPoints(vec![Point::new(0, 0)])
        );
        assert_eq!(
            feature2.load_geometry(),
            VectorGeometry::VectorPoints(vec![
                Point::new_with_m(0, 0, example_value.clone()),
                Point::new(1, 1)
            ])
        );

        // m_values
        assert!(feature.m_values().is_none());
        assert_eq!(
            feature2.m_values(),
            Some(vec![example_value.clone(), Value(BTreeMap::new())])
        );

        let mut col = ColumnCacheWriter::default();
        feature.encode_to_cache(&mut col, None);
        feature2.encode_to_cache(&mut col, Some(&example_shape));

        // wrap in BaseVectorFeature and test all functions
        let feature_base = BaseVectorFeature::BaseVectorPointsFeature(feature);
        let feature_base_2 = BaseVectorFeature::BaseVectorPointsFeature(feature2);

        // single
        assert!(feature_base.single());
        assert!(!feature_base_2.single());

        // properties
        assert_eq!(feature_base.properties(), &Properties::default());
        assert_eq!(feature_base_2.properties(), &example_value);

        // has_m_values
        assert!(!feature_base.has_m_values());
        assert!(feature_base_2.has_m_values());

        // m_values
        assert_eq!(feature_base.m_values(), None);
        assert_eq!(
            feature_base_2.m_values(),
            Some(vec![example_value.clone(), Value(BTreeMap::new())])
        );

        // get_type
        assert_eq!(feature_base.get_type(), FeatureType::Points);
        assert_eq!(feature_base_2.get_type(), FeatureType::Points);

        // id
        assert_eq!(feature_base.id(), Some(1));
        assert_eq!(feature_base_2.id(), None);

        // indices
        assert_eq!(feature_base.indices(), None);
        assert_eq!(feature_base_2.indices(), None);

        // tesselation
        assert!(feature_base.tesselation().is_none());
        assert!(feature_base_2.tesselation().is_none());

        // bbox
        assert_eq!(
            feature_base.bbox(),
            Some(BBOX::BBox(BBox {
                left: 0.0,
                bottom: 0.0,
                right: 1.0,
                top: 1.0
            }))
        );
        assert_eq!(feature_base_2.bbox(), None);

        // has_offsets
        assert!(!feature_base.has_offsets());
        assert!(!feature_base_2.has_offsets());

        // encode_to_cache
        assert_eq!(feature_base.encode_to_cache(&mut col, None), 0);
        assert_eq!(
            feature_base_2.encode_to_cache(&mut col, Some(&example_shape)),
            1
        );
    }

    #[test]
    fn test_base_vector_points_3d_feature() {
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

        let feature = BaseVectorPoints3DFeature {
            id: Some(1),
            geometry: vec![Point3D::new(0, 0, 0)],
            properties: Properties::default(),
            bbox: Some(BBox3D {
                left: 0.0,
                bottom: 0.0,
                right: 1.0,
                top: 1.0,
                near: 0.0,
                far: 1.0,
            }),
        };
        let feature2 = BaseVectorPoints3DFeature::new(
            None,
            vec![
                Point3D::new_with_m(0, 0, 0, example_value.clone()),
                Point3D::new(1, 1, 1),
            ],
            example_value.clone(),
            None,
        );

        // get_type
        assert_eq!(feature.get_type(), FeatureType::Points3D);
        assert_eq!(feature2.get_type(), FeatureType::Points3D);

        // properties
        assert_eq!(feature.properties(), &Properties::default());
        assert_eq!(feature2.properties(), &example_value);

        // has_bbox
        assert!(feature.has_bbox());
        assert!(!feature2.has_bbox());

        // has_offsets
        assert!(!feature.has_offsets());
        assert!(!feature2.has_offsets());

        // has_m_values
        assert!(!feature.has_m_values());
        assert!(feature2.has_m_values());

        // load_geometry
        assert_eq!(
            feature.load_geometry(),
            VectorGeometry::VectorPoints3D(vec![Point3D::new(0, 0, 0)])
        );
        assert_eq!(
            feature2.load_geometry(),
            VectorGeometry::VectorPoints3D(vec![
                Point3D::new_with_m(0, 0, 0, example_value.clone()),
                Point3D::new(1, 1, 1)
            ])
        );

        // m_values
        assert!(feature.m_values().is_none());
        assert_eq!(
            feature2.m_values(),
            Some(vec![example_value.clone(), Value(BTreeMap::new())])
        );

        let mut col = ColumnCacheWriter::default();
        feature.encode_to_cache(&mut col, None);
        feature2.encode_to_cache(&mut col, Some(&example_shape));

        // wrap in BaseVectorFeature and test all functions
        let feature_base = BaseVectorFeature::BaseVectorPoints3DFeature(feature);
        let feature_base_2 = BaseVectorFeature::BaseVectorPoints3DFeature(feature2);

        // single
        assert!(feature_base.single());
        assert!(!feature_base_2.single());

        // properties
        assert_eq!(feature_base.properties(), &Properties::default());
        assert_eq!(feature_base_2.properties(), &example_value);

        // has_m_values
        assert!(!feature_base.has_m_values());
        assert!(feature_base_2.has_m_values());

        // m_values
        assert_eq!(feature_base.m_values(), None);
        assert_eq!(
            feature_base_2.m_values(),
            Some(vec![example_value.clone(), Value(BTreeMap::new())])
        );

        // get_type
        assert_eq!(feature_base.get_type(), FeatureType::Points3D);
        assert_eq!(feature_base_2.get_type(), FeatureType::Points3D);

        // id
        assert_eq!(feature_base.id(), Some(1));
        assert_eq!(feature_base_2.id(), None);

        // indices
        assert_eq!(feature_base.indices(), None);
        assert_eq!(feature_base_2.indices(), None);

        // tesselation
        assert!(feature_base.tesselation().is_none());
        assert!(feature_base_2.tesselation().is_none());

        // bbox
        assert_eq!(
            feature_base.bbox(),
            Some(BBOX::BBox3D(BBox3D {
                left: 0.0,
                bottom: 0.0,
                right: 1.0,
                top: 1.0,
                near: 0.0,
                far: 1.0
            }))
        );
        assert_eq!(feature_base_2.bbox(), None);

        // has_offsets
        assert!(!feature_base.has_offsets());
        assert!(!feature_base_2.has_offsets());

        // encode_to_cache
        assert_eq!(feature_base.encode_to_cache(&mut col, None), 0);
        assert_eq!(
            feature_base_2.encode_to_cache(&mut col, Some(&example_shape)),
            1
        );
    }

    #[test]
    fn test_base_vector_lines_feature() {
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

        let feature = BaseVectorLinesFeature {
            id: Some(1),
            // geometry: vec![Point::new(0, 0)],
            geometry: vec![VectorLineWithOffset::new(
                0.0,
                vec![Point::new(0, 0), Point::new(1, 1)],
            )],
            properties: Properties::default(),
            bbox: Some(BBox {
                left: 0.0,
                bottom: 0.0,
                right: 1.0,
                top: 1.0,
            }),
        };
        let feature2 = BaseVectorLinesFeature::new(
            None,
            vec![
                VectorLineWithOffset::new(
                    0.0,
                    vec![
                        Point::new_with_m(0, 0, example_value.clone()),
                        Point::new(1, 1),
                    ],
                ),
                VectorLineWithOffset::new(
                    1.0,
                    vec![
                        Point::new(2, 2),
                        Point::new_with_m(3, 3, example_value.clone()),
                    ],
                ),
            ],
            example_value.clone(),
            None,
        );

        // get_type
        assert_eq!(feature.get_type(), FeatureType::Lines);
        assert_eq!(feature2.get_type(), FeatureType::Lines);

        // properties
        assert_eq!(feature.properties(), &Properties::default());
        assert_eq!(feature2.properties(), &example_value);

        // has_bbox
        assert!(feature.has_bbox());
        assert!(!feature2.has_bbox());

        // has_offsets
        assert!(!feature.has_offsets());
        assert!(feature2.has_offsets());

        // has_m_values
        assert!(!feature.has_m_values());
        assert!(feature2.has_m_values());

        // load_geometry
        assert_eq!(
            feature.load_geometry(),
            VectorGeometry::VectorLines(vec![VectorLineWithOffset::new(
                0.0,
                vec![Point::new(0, 0), Point::new(1, 1)]
            ),])
        );
        assert_eq!(
            feature2.load_geometry(),
            VectorGeometry::VectorLines(vec![
                VectorLineWithOffset::new(
                    0.0,
                    vec![
                        Point::new_with_m(0, 0, example_value.clone()),
                        Point::new(1, 1)
                    ]
                ),
                VectorLineWithOffset::new(
                    1.0,
                    vec![
                        Point::new(2, 2),
                        Point::new_with_m(3, 3, example_value.clone())
                    ]
                ),
            ])
        );

        // m_values
        assert!(feature.m_values().is_none());
        assert_eq!(
            feature2.m_values(),
            Some(vec![
                example_value.clone(),
                Value(BTreeMap::new()),
                Value(BTreeMap::new()),
                example_value.clone(),
            ])
        );

        let mut col = ColumnCacheWriter::default();
        feature.encode_to_cache(&mut col, None);
        feature2.encode_to_cache(&mut col, Some(&example_shape));

        // wrap in BaseVectorFeature and test all functions
        let feature_base = BaseVectorFeature::BaseVectorLinesFeature(feature);
        let feature_base_2 = BaseVectorFeature::BaseVectorLinesFeature(feature2);

        // single
        assert!(feature_base.single());
        assert!(!feature_base_2.single());

        // properties
        assert_eq!(feature_base.properties(), &Properties::default());
        assert_eq!(feature_base_2.properties(), &example_value);

        // has_m_values
        assert!(!feature_base.has_m_values());
        assert!(feature_base_2.has_m_values());

        // m_values
        assert_eq!(feature_base.m_values(), None);
        assert_eq!(
            feature_base_2.m_values(),
            Some(vec![
                example_value.clone(),
                Value(BTreeMap::new()),
                Value(BTreeMap::new()),
                example_value.clone(),
            ])
        );

        // get_type
        assert_eq!(feature_base.get_type(), FeatureType::Lines);
        assert_eq!(feature_base_2.get_type(), FeatureType::Lines);

        // id
        assert_eq!(feature_base.id(), Some(1));
        assert_eq!(feature_base_2.id(), None);

        // indices
        assert_eq!(feature_base.indices(), None);
        assert_eq!(feature_base_2.indices(), None);

        // tesselation
        assert!(feature_base.tesselation().is_none());
        assert!(feature_base_2.tesselation().is_none());

        // bbox
        assert_eq!(
            feature_base.bbox(),
            Some(BBOX::BBox(BBox {
                left: 0.0,
                bottom: 0.0,
                right: 1.0,
                top: 1.0
            }))
        );
        assert_eq!(feature_base_2.bbox(), None);

        // has_offsets
        assert!(!feature_base.has_offsets());
        assert!(feature_base_2.has_offsets());

        // encode_to_cache
        assert_eq!(feature_base.encode_to_cache(&mut col, None), 0);
        assert_eq!(
            feature_base_2.encode_to_cache(&mut col, Some(&example_shape)),
            2
        );
    }

    #[test]
    fn test_base_vector_lines_3d_feature() {
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

        let feature = BaseVectorLines3DFeature {
            id: Some(1),
            geometry: vec![VectorLine3DWithOffset::new(
                0.0,
                vec![Point3D::new(0, 0, 0), Point3D::new(1, 1, 1)],
            )],
            properties: Properties::default(),
            bbox: Some(BBox3D {
                left: 0.0,
                bottom: 0.0,
                right: 1.0,
                top: 1.0,
                near: 0.0,
                far: 1.0,
            }),
        };
        let feature2 = BaseVectorLines3DFeature::new(
            None,
            vec![
                VectorLine3DWithOffset::new(
                    0.0,
                    vec![
                        Point3D::new_with_m(0, 0, 0, example_value.clone()),
                        Point3D::new(1, 1, 1),
                    ],
                ),
                VectorLine3DWithOffset::new(
                    1.0,
                    vec![
                        Point3D::new(2, 2, 2),
                        Point3D::new_with_m(3, 3, 3, example_value.clone()),
                    ],
                ),
            ],
            example_value.clone(),
            None,
        );

        // get_type
        assert_eq!(feature.get_type(), FeatureType::Lines3D);
        assert_eq!(feature2.get_type(), FeatureType::Lines3D);

        // properties
        assert_eq!(feature.properties(), &Properties::default());
        assert_eq!(feature2.properties(), &example_value);

        // has_bbox
        assert!(feature.has_bbox());
        assert!(!feature2.has_bbox());

        // has_offsets
        assert!(!feature.has_offsets());
        assert!(feature2.has_offsets());

        // has_m_values
        assert!(!feature.has_m_values());
        assert!(feature2.has_m_values());

        // load_geometry
        assert_eq!(
            feature.load_geometry(),
            VectorGeometry::VectorLines3D(vec![VectorLine3DWithOffset::new(
                0.0,
                vec![Point3D::new(0, 0, 0), Point3D::new(1, 1, 1)]
            ),])
        );
        assert_eq!(
            feature2.load_geometry(),
            VectorGeometry::VectorLines3D(vec![
                VectorLine3DWithOffset::new(
                    0.0,
                    vec![
                        Point3D::new_with_m(0, 0, 0, example_value.clone()),
                        Point3D::new(1, 1, 1)
                    ]
                ),
                VectorLine3DWithOffset::new(
                    1.0,
                    vec![
                        Point3D::new(2, 2, 2),
                        Point3D::new_with_m(3, 3, 3, example_value.clone())
                    ]
                ),
            ])
        );

        // m_values
        assert!(feature.m_values().is_none());
        assert_eq!(
            feature2.m_values(),
            Some(vec![
                example_value.clone(),
                Value(BTreeMap::new()),
                Value(BTreeMap::new()),
                example_value.clone(),
            ])
        );

        let mut col = ColumnCacheWriter::default();
        feature.encode_to_cache(&mut col, None);
        feature2.encode_to_cache(&mut col, Some(&example_shape));

        // wrap in BaseVectorFeature and test all functions
        let feature_base = BaseVectorFeature::BaseVectorLines3DFeature(feature);
        let feature_base_2 = BaseVectorFeature::BaseVectorLines3DFeature(feature2);

        // single
        assert!(feature_base.single());
        assert!(!feature_base_2.single());

        // properties
        assert_eq!(feature_base.properties(), &Properties::default());
        assert_eq!(feature_base_2.properties(), &example_value);

        // has_m_values
        assert!(!feature_base.has_m_values());
        assert!(feature_base_2.has_m_values());

        // m_values
        assert_eq!(feature_base.m_values(), None);
        assert_eq!(
            feature_base_2.m_values(),
            Some(vec![
                example_value.clone(),
                Value(BTreeMap::new()),
                Value(BTreeMap::new()),
                example_value.clone(),
            ])
        );

        // get_type
        assert_eq!(feature_base.get_type(), FeatureType::Lines3D);
        assert_eq!(feature_base_2.get_type(), FeatureType::Lines3D);

        // id
        assert_eq!(feature_base.id(), Some(1));
        assert_eq!(feature_base_2.id(), None);

        // indices
        assert_eq!(feature_base.indices(), None);
        assert_eq!(feature_base_2.indices(), None);

        // tesselation
        assert!(feature_base.tesselation().is_none());
        assert!(feature_base_2.tesselation().is_none());

        // bbox
        assert_eq!(
            feature_base.bbox(),
            Some(BBOX::BBox3D(BBox3D {
                left: 0.0,
                bottom: 0.0,
                right: 1.0,
                top: 1.0,
                near: 0.0,
                far: 1.0
            }))
        );
        assert_eq!(feature_base_2.bbox(), None);

        // has_offsets
        assert!(!feature_base.has_offsets());
        assert!(feature_base_2.has_offsets());

        // encode_to_cache
        assert_eq!(feature_base.encode_to_cache(&mut col, None), 0);
        assert_eq!(
            feature_base_2.encode_to_cache(&mut col, Some(&example_shape)),
            2
        );
    }

    #[test]
    fn test_base_vector_polys_feature() {
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

        let feature = BaseVectorPolysFeature {
            id: Some(1),
            geometry: vec![vec![
                VectorLineWithOffset::new(0.0, vec![Point::new(0, 0), Point::new(1, 1)]),
                VectorLineWithOffset::new(0.0, vec![Point::new(2, 2), Point::new(3, 3)]),
            ]],
            properties: Properties::default(),
            bbox: Some(BBox {
                left: 0.0,
                bottom: 0.0,
                right: 1.0,
                top: 1.0,
            }),
            tesselation: vec![
                Point::new(0, 0),
                Point::new(1, 1),
                Point::new(2, 2),
                Point::new(3, 3),
                Point::new(0, 0),
            ],
            indices: vec![0, 1, 2, 3, 4],
        };
        let feature2 = BaseVectorPolysFeature::new(
            None,
            vec![
                vec![
                    VectorLineWithOffset::new(
                        0.0,
                        vec![
                            Point::new_with_m(0, 0, example_value.clone()),
                            Point::new(1, 1),
                        ],
                    ),
                    VectorLineWithOffset::new(
                        1.0,
                        vec![
                            Point::new(2, 2),
                            Point::new_with_m(3, 3, example_value.clone()),
                        ],
                    ),
                ],
                vec![
                    VectorLineWithOffset::new(2.0, vec![Point::new(4, 4), Point::new(5, 5)]),
                    VectorLineWithOffset::new(3.0, vec![Point::new(6, 6), Point::new(7, 7)]),
                ],
            ],
            example_value.clone(),
            None,
            vec![],
            vec![],
        );

        // get_type
        assert_eq!(feature.get_type(), FeatureType::Polygons);
        assert_eq!(feature2.get_type(), FeatureType::Polygons);

        // properties
        assert_eq!(feature.properties(), &Properties::default());
        assert_eq!(feature2.properties(), &example_value);

        // has_bbox
        assert!(feature.has_bbox());
        assert!(!feature2.has_bbox());

        // has_offsets
        assert!(!feature.has_offsets());
        assert!(feature2.has_offsets());

        // has_m_values
        assert!(!feature.has_m_values());
        assert!(feature2.has_m_values());

        // load_geometry
        assert_eq!(
            feature.load_geometry(),
            VectorGeometry::VectorPolys(vec![vec![
                VectorLineWithOffset::new(0.0, vec![Point::new(0, 0), Point::new(1, 1)]),
                VectorLineWithOffset::new(0.0, vec![Point::new(2, 2), Point::new(3, 3)]),
            ],])
        );
        assert_eq!(
            feature2.load_geometry(),
            VectorGeometry::VectorPolys(vec![
                vec![
                    VectorLineWithOffset::new(
                        0.0,
                        vec![
                            Point::new_with_m(0, 0, example_value.clone()),
                            Point::new(1, 1)
                        ]
                    ),
                    VectorLineWithOffset::new(
                        1.0,
                        vec![
                            Point::new(2, 2),
                            Point::new_with_m(3, 3, example_value.clone())
                        ]
                    ),
                ],
                vec![
                    VectorLineWithOffset::new(2.0, vec![Point::new(4, 4), Point::new(5, 5)]),
                    VectorLineWithOffset::new(3.0, vec![Point::new(6, 6), Point::new(7, 7)]),
                ],
            ])
        );

        // m_values
        assert!(feature.m_values().is_none());
        assert_eq!(
            feature2.m_values(),
            Some(vec![
                example_value.clone(),
                Value(BTreeMap::new()),
                Value(BTreeMap::new()),
                example_value.clone(),
            ])
        );

        let mut col = ColumnCacheWriter::default();
        feature.encode_to_cache(&mut col, None);
        feature2.encode_to_cache(&mut col, Some(&example_shape));

        // wrap in BaseVectorFeature and test all functions
        let feature_base = BaseVectorFeature::BaseVectorPolysFeature(feature);
        let feature_base_2 = BaseVectorFeature::BaseVectorPolysFeature(feature2);

        // single
        assert!(feature_base.single());
        assert!(!feature_base_2.single());

        // properties
        assert_eq!(feature_base.properties(), &Properties::default());
        assert_eq!(feature_base_2.properties(), &example_value);

        // has_m_values
        assert!(!feature_base.has_m_values());
        assert!(feature_base_2.has_m_values());

        // m_values
        assert_eq!(feature_base.m_values(), None);
        assert_eq!(
            feature_base_2.m_values(),
            Some(vec![
                example_value.clone(),
                Value(BTreeMap::new()),
                Value(BTreeMap::new()),
                example_value.clone(),
            ])
        );

        // get_type
        assert_eq!(feature_base.get_type(), FeatureType::Polygons);
        assert_eq!(feature_base_2.get_type(), FeatureType::Polygons);

        // id
        assert_eq!(feature_base.id(), Some(1));
        assert_eq!(feature_base_2.id(), None);

        // indices
        assert_eq!(feature_base.indices(), Some(vec![0, 1, 2, 3, 4]));
        assert_eq!(feature_base_2.indices(), Some(vec![]));

        // tesselation
        let tess = feature_base.tesselation().unwrap();
        assert_eq!(
            tess,
            TesselationWrapper::Tesselation(vec![
                Point::new(0, 0),
                Point::new(1, 1),
                Point::new(2, 2),
                Point::new(3, 3),
                Point::new(0, 0)
            ])
        );
        assert_eq!(tess.len(), 5);
        assert!(!tess.is_empty());
        let tess2 = feature_base_2.tesselation().unwrap();
        assert_eq!(tess2, TesselationWrapper::Tesselation(vec![]));
        assert_eq!(tess2.len(), 0);
        assert!(tess2.is_empty());

        // bbox
        assert_eq!(
            feature_base.bbox(),
            Some(BBOX::BBox(BBox {
                left: 0.0,
                bottom: 0.0,
                right: 1.0,
                top: 1.0
            }))
        );
        assert_eq!(feature_base_2.bbox(), None);

        // has_offsets
        assert!(!feature_base.has_offsets());
        assert!(feature_base_2.has_offsets());

        // encode_to_cache
        assert_eq!(feature_base.encode_to_cache(&mut col, None), 0);
        assert_eq!(
            feature_base_2.encode_to_cache(&mut col, Some(&example_shape)),
            2
        );
    }

    #[test]
    fn test_base_vector_polys_3d_feature() {
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

        let feature = BaseVectorPolys3DFeature {
            id: Some(1),
            geometry: vec![vec![
                VectorLine3DWithOffset::new(
                    0.0,
                    vec![Point3D::new(0, 0, 0), Point3D::new(1, 1, 1)],
                ),
                VectorLine3DWithOffset::new(
                    0.0,
                    vec![Point3D::new(2, 2, 2), Point3D::new(3, 3, 3)],
                ),
            ]],
            properties: Properties::default(),
            bbox: Some(BBox3D {
                left: 0.0,
                bottom: 0.0,
                right: 1.0,
                top: 1.0,
                near: 0.0,
                far: 1.0,
            }),
            tesselation: vec![
                Point3D::new(0, 0, 0),
                Point3D::new(1, 1, 1),
                Point3D::new(2, 2, 2),
                Point3D::new(3, 3, 3),
                Point3D::new(0, 0, 0),
            ],
            indices: vec![0, 1, 2, 3, 4],
        };
        let feature2 = BaseVectorPolys3DFeature::new(
            None,
            vec![
                vec![
                    VectorLine3DWithOffset::new(
                        0.0,
                        vec![
                            Point3D::new_with_m(0, 0, 0, example_value.clone()),
                            Point3D::new(1, 1, 1),
                        ],
                    ),
                    VectorLine3DWithOffset::new(
                        1.0,
                        vec![
                            Point3D::new(2, 2, 2),
                            Point3D::new_with_m(3, 3, 3, example_value.clone()),
                        ],
                    ),
                ],
                vec![
                    VectorLine3DWithOffset::new(
                        2.0,
                        vec![Point3D::new(4, 4, 4), Point3D::new(5, 5, 5)],
                    ),
                    VectorLine3DWithOffset::new(
                        3.0,
                        vec![Point3D::new(6, 6, 6), Point3D::new(7, 7, 7)],
                    ),
                ],
            ],
            example_value.clone(),
            None,
            vec![],
            vec![],
        );

        // get_type
        assert_eq!(feature.get_type(), FeatureType::Polygons3D);
        assert_eq!(feature2.get_type(), FeatureType::Polygons3D);

        // properties
        assert_eq!(feature.properties(), &Properties::default());
        assert_eq!(feature2.properties(), &example_value);

        // has_bbox
        assert!(feature.has_bbox());
        assert!(!feature2.has_bbox());

        // has_offsets
        assert!(!feature.has_offsets());
        assert!(feature2.has_offsets());

        // has_m_values
        assert!(!feature.has_m_values());
        assert!(feature2.has_m_values());

        // load_geometry
        assert_eq!(
            feature.load_geometry(),
            VectorGeometry::VectorPolys3D(vec![vec![
                VectorLine3DWithOffset::new(
                    0.0,
                    vec![Point3D::new(0, 0, 0), Point3D::new(1, 1, 1)]
                ),
                VectorLine3DWithOffset::new(
                    0.0,
                    vec![Point3D::new(2, 2, 2), Point3D::new(3, 3, 3)]
                ),
            ],])
        );
        assert_eq!(
            feature2.load_geometry(),
            VectorGeometry::VectorPolys3D(vec![
                vec![
                    VectorLine3DWithOffset::new(
                        0.0,
                        vec![
                            Point3D::new_with_m(0, 0, 0, example_value.clone()),
                            Point3D::new(1, 1, 1)
                        ]
                    ),
                    VectorLine3DWithOffset::new(
                        1.0,
                        vec![
                            Point3D::new(2, 2, 2),
                            Point3D::new_with_m(3, 3, 3, example_value.clone())
                        ]
                    ),
                ],
                vec![
                    VectorLine3DWithOffset::new(
                        2.0,
                        vec![Point3D::new(4, 4, 4), Point3D::new(5, 5, 5)]
                    ),
                    VectorLine3DWithOffset::new(
                        3.0,
                        vec![Point3D::new(6, 6, 6), Point3D::new(7, 7, 7)]
                    ),
                ],
            ])
        );

        // m_values
        assert!(feature.m_values().is_none());
        assert_eq!(
            feature2.m_values(),
            Some(vec![
                example_value.clone(),
                Value(BTreeMap::new()),
                Value(BTreeMap::new()),
                example_value.clone(),
            ])
        );

        let mut col = ColumnCacheWriter::default();
        feature.encode_to_cache(&mut col, None);
        feature2.encode_to_cache(&mut col, Some(&example_shape));

        // wrap in BaseVectorFeature and test all functions
        let feature_base = BaseVectorFeature::BaseVectorPolys3DFeature(feature);
        let feature_base_2 = BaseVectorFeature::BaseVectorPolys3DFeature(feature2);

        // single
        assert!(feature_base.single());
        assert!(!feature_base_2.single());

        // properties
        assert_eq!(feature_base.properties(), &Properties::default());
        assert_eq!(feature_base_2.properties(), &example_value);

        // has_m_values
        assert!(!feature_base.has_m_values());
        assert!(feature_base_2.has_m_values());

        // m_values
        assert_eq!(feature_base.m_values(), None);
        assert_eq!(
            feature_base_2.m_values(),
            Some(vec![
                example_value.clone(),
                Value(BTreeMap::new()),
                Value(BTreeMap::new()),
                example_value.clone(),
            ])
        );

        // get_type
        assert_eq!(feature_base.get_type(), FeatureType::Polygons3D);
        assert_eq!(feature_base_2.get_type(), FeatureType::Polygons3D);

        // id
        assert_eq!(feature_base.id(), Some(1));
        assert_eq!(feature_base_2.id(), None);

        // indices
        assert_eq!(feature_base.indices(), Some(vec![0, 1, 2, 3, 4]));
        assert_eq!(feature_base_2.indices(), Some(vec![]));

        // tesselation
        let tess = feature_base.tesselation().unwrap();
        assert_eq!(
            tess,
            TesselationWrapper::Tesselation3D(vec![
                Point3D::new(0, 0, 0),
                Point3D::new(1, 1, 1),
                Point3D::new(2, 2, 2),
                Point3D::new(3, 3, 3),
                Point3D::new(0, 0, 0)
            ])
        );
        assert_eq!(tess.len(), 5);
        assert!(!tess.is_empty());
        let tess2 = feature_base_2.tesselation().unwrap();
        assert_eq!(tess2, TesselationWrapper::Tesselation3D(vec![]));
        assert_eq!(tess2.len(), 0);
        assert!(tess2.is_empty());

        // bbox
        assert_eq!(
            feature_base.bbox(),
            Some(BBOX::BBox3D(BBox3D {
                left: 0.0,
                bottom: 0.0,
                right: 1.0,
                top: 1.0,
                near: 0.0,
                far: 1.0
            }))
        );
        assert_eq!(feature_base_2.bbox(), None);

        // has_offsets
        assert!(!feature_base.has_offsets());
        assert!(feature_base_2.has_offsets());

        // encode_to_cache
        assert_eq!(feature_base.encode_to_cache(&mut col, None), 0);
        assert_eq!(
            feature_base_2.encode_to_cache(&mut col, Some(&example_shape)),
            2
        );
    }

    #[test]
    fn encode_decode_offset() {
        let encoded = encode_offset(0.0);
        let decoded = decode_offset(encoded);

        assert_eq!(encoded, 0);
        assert_eq!(decoded, 0.0);

        let encoded = encode_offset(1.0);
        let decoded = decode_offset(encoded);

        assert_eq!(encoded, 1000);
        assert_eq!(decoded, 1.0);

        let encoded = encode_offset(1.2345);
        let decoded = decode_offset(encoded);

        assert_eq!(encoded, 1235);
        assert_eq!(decoded, 1.235);
    }
}
