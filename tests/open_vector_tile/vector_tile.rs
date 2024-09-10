#[cfg(test)]
mod tests {
    extern crate alloc;
    use std::collections::BTreeMap;

    use ovtile::{
        base::{
            BaseVectorFeature, BaseVectorLayer, BaseVectorLines3DFeature, BaseVectorLinesFeature,
            BaseVectorPoints3DFeature, BaseVectorPointsFeature, BaseVectorPolys3DFeature,
            BaseVectorPolysFeature, BaseVectorTile,
        },
        open::{FeatureType, PrimitiveValue, Value, ValuePrimitiveType, ValueType},
        write_tile, BBox, BBox3D, Point, Point3D, VectorGeometry, VectorLayerMethods,
        VectorLine3DWithOffset, VectorLineWithOffset, VectorTile, BBOX,
    };

    use std::panic::{self, AssertUnwindSafe};

    #[test]
    fn test_open_vector_tile() {
        let mut tile = BaseVectorTile::default();

        let example_value_str = r#"{
            "a": -20,
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

        let empty_value = Value(BTreeMap::from([
            (
                "a".to_string(),
                ValueType::Primitive(PrimitiveValue::I64(0)),
            ),
            (
                "b".to_string(),
                ValueType::Primitive(PrimitiveValue::U64(0)),
            ),
            (
                "c".to_string(),
                ValueType::Primitive(PrimitiveValue::F32(0.0)),
            ),
        ]));

        // POINTS //-//-//-//-//-//-//-//-//-//-//

        let mut points_layer =
            BaseVectorLayer::new("points".to_string(), 4096.into(), vec![], None, None);

        let feature = BaseVectorPointsFeature::new(
            None,
            vec![Point::new_with_m(0, 0, example_value2.clone())],
            example_value.clone(),
            None,
        );
        let feature2 = BaseVectorPointsFeature::new(
            Some(1),
            vec![
                Point::new_with_m(0, 0, example_value.clone()),
                Point::new(1, 1),
            ],
            example_value2.clone(),
            Some(BBox::new(-1.1, 0.0, 1.0, 1.0)),
        );

        // add_features
        points_layer.add_feature(BaseVectorFeature::BaseVectorPointsFeature(feature));
        points_layer.add_feature(BaseVectorFeature::BaseVectorPointsFeature(feature2));

        tile.add_layer(points_layer);

        // LINES //-//-//-//-//-//-//-//-//-//-//

        let mut lines_layer =
            BaseVectorLayer::new("lines".to_string(), 2_048.into(), vec![], None, None);

        let feature3 = BaseVectorLinesFeature::new(
            None,
            vec![VectorLineWithOffset::new(
                0.0,
                vec![Point::new_with_m(0, 0, example_value2.clone())],
            )],
            example_value.clone(),
            None,
        );
        let feature4 = BaseVectorLinesFeature::new(
            Some(1),
            vec![
                VectorLineWithOffset::new(
                    2.0,
                    vec![Point::new_with_m(0, 0, example_value2.clone())],
                ),
                VectorLineWithOffset::new(5.0, vec![Point::new(2, 2), Point::new(3, 3)]),
            ],
            example_value2.clone(),
            None,
        );

        lines_layer.add_feature(BaseVectorFeature::BaseVectorLinesFeature(feature3));
        lines_layer.add_feature(BaseVectorFeature::BaseVectorLinesFeature(feature4));

        tile.add_layer(lines_layer);

        // POLYS //-//-//-//-//-//-//-//-//-//-//

        let mut polys_layer =
            BaseVectorLayer::new("polys".to_string(), 8_192.into(), vec![], None, None);

        let feature5 = BaseVectorPolysFeature::new(
            None,
            vec![vec![VectorLineWithOffset::new(
                0.0,
                vec![
                    Point::new_with_m(0, 0, example_value2.clone()),
                    Point::new(1, 1),
                    Point::new(2, 2),
                    Point::new(3, 3),
                    Point::new(0, 0),
                ],
            )]],
            example_value.clone(),
            None,
            vec![],
            vec![],
        );

        let feature6 = BaseVectorPolysFeature::new(
            Some(1),
            vec![
                vec![VectorLineWithOffset::new(
                    22.2,
                    vec![
                        Point::new_with_m(0, 0, example_value2.clone()),
                        Point::new(1, 1),
                        Point::new(2, 2),
                        Point::new(3, 3),
                        Point::new(0, 0),
                    ],
                )],
                vec![
                    VectorLineWithOffset::new(
                        5.123,
                        vec![
                            Point::new_with_m(0, 0, example_value2.clone()),
                            Point::new(1, 1),
                            Point::new(2, 2),
                            Point::new(3, 3),
                            Point::new(0, 0),
                        ],
                    ),
                    VectorLineWithOffset::new(
                        2_222.222222,
                        vec![
                            Point::new(2, 2),
                            Point::new(3, 3),
                            Point::new(4, 4),
                            Point::new(5, 5),
                            Point::new(2, 2),
                        ],
                    ),
                ],
            ],
            example_value2.clone(),
            None,
            vec![0, 1, 2, 1, 5],
            vec![Point::new(10, 4), Point::new(11, 5), Point::new(12, 6)],
        );

        polys_layer.add_feature(BaseVectorFeature::BaseVectorPolysFeature(feature5));
        polys_layer.add_feature(BaseVectorFeature::BaseVectorPolysFeature(feature6));

        tile.add_layer(polys_layer);

        // convert BaseVectorLayer into OpenVectorTile
        let open_tile_bytes = write_tile(&mut tile);

        let mut open_tile = VectorTile::new(open_tile_bytes, None);

        assert_eq!(open_tile.layers.len(), 3);

        // POINTS

        let o_points_layer = open_tile.layer("points").unwrap();

        assert_eq!(o_points_layer.version(), 1);
        assert_eq!(o_points_layer.name(), "points");
        assert_eq!(o_points_layer.extent(), 4_096);

        assert_eq!(o_points_layer.len(), 2);

        {
            let o_feature = o_points_layer.feature(0).unwrap();
            // id
            assert_eq!(o_feature.id(), None);
            // properties
            assert_eq!(o_feature.properties(), example_value);
            // version
            assert_eq!(o_feature.version(), 1);
            // extent
            assert_eq!(o_feature.extent(), 4_096);
            // get_type
            assert_eq!(o_feature.get_type(), FeatureType::Points);
            // bbox
            assert_eq!(o_feature.bbox(), None);
            // has_m_values
            assert!(o_feature.has_m_values());
            // load_points
            let points = o_feature.load_points();
            assert_eq!(points.len(), 1);
            assert_eq!(points, vec![Point::new(0, 0)]);
            // load_geometry
            let geometry = o_feature.load_geometry();
            assert_eq!(
                geometry,
                VectorGeometry::VectorPoints(vec![Point::new(0, 0)])
            );
            // load indices
            assert_eq!(o_feature.read_indices(), Vec::<u32>::new());
        }

        {
            let o_feature = o_points_layer.feature(1).unwrap();
            // id
            assert_eq!(o_feature.id(), Some(1));
            // properties
            assert_eq!(o_feature.properties(), example_value2);
            // version
            assert_eq!(o_feature.version(), 1);
            // extent
            assert_eq!(o_feature.extent(), 4_096);
            // get_type
            assert_eq!(o_feature.get_type(), FeatureType::Points);
            // bbox
            assert_eq!(
                o_feature.bbox(),
                Some(BBOX::BBox(BBox {
                    left: -1.0999954402444132,
                    bottom: -5.364418356634815e-6,
                    right: 1.0000026822091854,
                    top: 0.9999973177908288
                }))
            );
            // has_m_values
            assert!(o_feature.has_m_values());
            // load_points
            let points = o_feature.load_points();
            assert_eq!(points.len(), 2);
            assert_eq!(
                points,
                vec![
                    Point::new_with_m(0, 0, example_value.clone()),
                    Point::new_with_m(1, 1, empty_value.clone())
                ]
            );
            // load_geometry
            let geometry = o_feature.load_geometry();
            assert_eq!(
                geometry,
                VectorGeometry::VectorPoints(vec![
                    Point::new_with_m(0, 0, example_value.clone()),
                    Point::new_with_m(1, 1, empty_value.clone())
                ])
            );
            // load indices
            assert_eq!(o_feature.read_indices(), Vec::<u32>::new());

            // load points 3D
            let load_points_test =
                panic::catch_unwind(AssertUnwindSafe(|| o_feature.load_points_3d()));
            assert!(load_points_test.is_err());

            // load lines 3D
            let load_points_test =
                panic::catch_unwind(AssertUnwindSafe(|| o_feature.load_lines_3d()));
            assert!(load_points_test.is_err());

            // load_geometry_flat
            let load_geometry_flat_test =
                panic::catch_unwind(AssertUnwindSafe(|| o_feature.load_geometry_flat()));
            assert!(load_geometry_flat_test.is_err());
        }

        // LINES

        let m_lines_layer = open_tile.layer("lines").unwrap();

        assert_eq!(m_lines_layer.version(), 1);
        assert_eq!(m_lines_layer.name(), "lines");
        assert_eq!(m_lines_layer.extent(), 2_048);

        assert_eq!(m_lines_layer.len(), 2);
        assert!(!m_lines_layer.is_empty());

        {
            let o_feature = m_lines_layer.feature(0).unwrap();
            // id
            assert_eq!(o_feature.id(), None);
            // properties
            assert_eq!(o_feature.properties(), example_value);
            // version
            assert_eq!(o_feature.version(), 1);
            // extent
            assert_eq!(o_feature.extent(), 2_048);
            // get_type
            assert_eq!(o_feature.get_type(), FeatureType::Lines);
            // bbox
            assert_eq!(o_feature.bbox(), None);
            // has_m_values
            assert!(o_feature.has_m_values());
            // load_points
            let points = o_feature.load_points();
            assert_eq!(points.len(), 1);
            assert_eq!(
                points,
                vec![Point::new_with_m(0, 0, example_value2.clone())]
            );
            // load_geometry
            let geometry = o_feature.load_geometry();
            assert_eq!(
                geometry,
                VectorGeometry::VectorLines(vec![VectorLineWithOffset::new(
                    0.0,
                    vec![Point::new_with_m(0, 0, example_value2.clone())],
                )]),
            );
            // load lines
            let lines = o_feature.load_lines();
            assert_eq!(lines.len(), 1);
            assert_eq!(
                lines,
                vec![VectorLineWithOffset::new(
                    0.0,
                    vec![Point::new_with_m(0, 0, example_value2.clone())]
                )],
            );
            // load indices
            assert_eq!(o_feature.read_indices(), Vec::<u32>::new());
        }
        {
            let o_feature = m_lines_layer.feature(1).unwrap();
            // id
            assert_eq!(o_feature.id(), Some(1));
            // properties
            assert_eq!(o_feature.properties(), example_value2);
            // version
            assert_eq!(o_feature.version(), 1);
            // extent
            assert_eq!(o_feature.extent(), 2_048);
            // get_type
            assert_eq!(o_feature.get_type(), FeatureType::Lines);
            // bbox
            assert_eq!(o_feature.bbox(), None);
            // has_m_values
            assert!(o_feature.has_m_values());
            // load_points
            let points = o_feature.load_points();
            assert_eq!(points.len(), 3);
            assert_eq!(
                points,
                vec![
                    Point::new_with_m(0, 0, example_value2.clone()),
                    Point::new_with_m(2, 2, empty_value.clone()),
                    Point::new_with_m(3, 3, empty_value.clone())
                ]
            );
            // load_geometry
            let geometry = o_feature.load_geometry();
            assert_eq!(
                geometry,
                VectorGeometry::VectorLines(vec![
                    VectorLineWithOffset::new(
                        2.0,
                        vec![Point::new_with_m(0, 0, example_value2.clone())]
                    ),
                    VectorLineWithOffset::new(
                        5.0,
                        vec![
                            Point::new_with_m(2, 2, empty_value.clone()),
                            Point::new_with_m(3, 3, empty_value.clone())
                        ]
                    ),
                ]),
            );
            // load lines
            let lines = o_feature.load_lines();
            assert_eq!(lines.len(), 2);
            assert_eq!(
                lines,
                vec![
                    VectorLineWithOffset::new(
                        2.0,
                        vec![Point::new_with_m(0, 0, example_value2.clone())],
                    ),
                    VectorLineWithOffset::new(
                        5.0,
                        vec![
                            Point::new_with_m(2, 2, empty_value.clone()),
                            Point::new_with_m(3, 3, empty_value.clone())
                        ]
                    ),
                ],
            );
            // load indices
            assert_eq!(o_feature.read_indices(), Vec::<u32>::new());
        }

        // POLYGONS

        let m_polygons_layer = open_tile.layer("polys").unwrap();

        assert_eq!(m_polygons_layer.version(), 1);
        assert_eq!(m_polygons_layer.name(), "polys");
        assert_eq!(m_polygons_layer.extent(), 8_192);

        assert_eq!(m_polygons_layer.len(), 2);

        {
            let o_feature = m_polygons_layer.feature(0).unwrap();
            // id
            assert_eq!(o_feature.id(), None);
            // properties
            assert_eq!(o_feature.properties(), example_value);
            // version
            assert_eq!(o_feature.version(), 1);
            // extent
            assert_eq!(o_feature.extent(), 8_192);
            // get_type
            assert_eq!(o_feature.get_type(), FeatureType::Polygons);
            // bbox
            assert_eq!(o_feature.bbox(), None);
            // has_m_values
            assert!(o_feature.has_m_values());
            // load_points
            let points = o_feature.load_points();
            assert_eq!(points.len(), 4);
            assert_eq!(
                points,
                vec![
                    Point::new_with_m(0, 0, example_value2.clone()),
                    Point::new_with_m(1, 1, empty_value.clone()),
                    Point::new_with_m(2, 2, empty_value.clone()),
                    Point::new_with_m(3, 3, empty_value.clone()),
                ]
            );
            // load_geometry
            let geometry = o_feature.load_geometry();
            assert_eq!(
                geometry,
                VectorGeometry::VectorPolys(vec![vec![VectorLineWithOffset::new(
                    0.0,
                    vec![
                        Point::new_with_m(0, 0, example_value2.clone()),
                        Point::new_with_m(1, 1, empty_value.clone()),
                        Point::new_with_m(2, 2, empty_value.clone()),
                        Point::new_with_m(3, 3, empty_value.clone()),
                        Point::new_with_m(0, 0, empty_value.clone()),
                    ],
                )]]),
            );
            // load lines
            let lines = o_feature.load_lines();
            assert_eq!(lines.len(), 1);
            assert_eq!(
                lines,
                vec![VectorLineWithOffset::new(
                    0.0,
                    vec![
                        Point::new_with_m(0, 0, example_value2.clone()),
                        Point::new_with_m(1, 1, empty_value.clone()),
                        Point::new_with_m(2, 2, empty_value.clone()),
                        Point::new_with_m(3, 3, empty_value.clone()),
                        Point::new_with_m(0, 0, empty_value.clone()),
                    ]
                )],
            );
            // load indices
            assert_eq!(o_feature.read_indices(), Vec::<u32>::new());
            // load tessellations
            let mut tess = vec![];
            o_feature.add_tesselation(&mut tess, 1.0 / 8_192.0);
            assert_eq!(tess, Vec::<f64>::new());

            // load_geometry_flat
            let (geometry_flat, indices) = o_feature.load_geometry_flat();
            assert_eq!(indices, Vec::<u32>::new());
            assert_eq!(
                geometry_flat,
                vec![
                    0.0,
                    0.0,
                    0.0001220703125,
                    0.0001220703125,
                    0.000244140625,
                    0.000244140625,
                    0.0003662109375,
                    0.0003662109375,
                    0.0,
                    0.0
                ]
            );
        }
        {
            let o_feature = m_polygons_layer.feature(1).unwrap();
            // id
            assert_eq!(o_feature.id(), Some(1));
            // properties
            assert_eq!(o_feature.properties(), example_value2);
            // version
            assert_eq!(o_feature.version(), 1);
            // extent
            assert_eq!(o_feature.extent(), 8_192);
            // get_type
            assert_eq!(o_feature.get_type(), FeatureType::Polygons);
            // bbox
            assert_eq!(o_feature.bbox(), None);
            // has_m_values
            assert!(o_feature.has_m_values());
            // load_points
            let points = o_feature.load_points();
            assert_eq!(points.len(), 12);
            assert_eq!(
                points,
                vec![
                    Point::new_with_m(0, 0, example_value2.clone()),
                    Point::new_with_m(1, 1, empty_value.clone()),
                    Point::new_with_m(2, 2, empty_value.clone()),
                    Point::new_with_m(3, 3, empty_value.clone()),
                    Point::new_with_m(0, 0, example_value2.clone()),
                    Point::new_with_m(1, 1, empty_value.clone()),
                    Point::new_with_m(2, 2, empty_value.clone()),
                    Point::new_with_m(3, 3, empty_value.clone()),
                    Point::new_with_m(2, 2, empty_value.clone()),
                    Point::new_with_m(3, 3, empty_value.clone()),
                    Point::new_with_m(4, 4, empty_value.clone()),
                    Point::new_with_m(5, 5, empty_value.clone()),
                ]
            );
            // load_geometry
            let geometry = o_feature.load_geometry();
            assert_eq!(
                geometry,
                VectorGeometry::VectorPolys(vec![
                    vec![VectorLineWithOffset::new(
                        22.2,
                        vec![
                            Point::new_with_m(0, 0, example_value2.clone()),
                            Point::new_with_m(1, 1, empty_value.clone()),
                            Point::new_with_m(2, 2, empty_value.clone()),
                            Point::new_with_m(3, 3, empty_value.clone()),
                            Point::new_with_m(0, 0, empty_value.clone()),
                        ],
                    )],
                    vec![
                        VectorLineWithOffset::new(
                            5.123,
                            vec![
                                Point::new_with_m(0, 0, example_value2.clone()),
                                Point::new_with_m(1, 1, empty_value.clone()),
                                Point::new_with_m(2, 2, empty_value.clone()),
                                Point::new_with_m(3, 3, empty_value.clone()),
                                Point::new_with_m(0, 0, empty_value.clone()),
                            ],
                        ),
                        VectorLineWithOffset::new(
                            2_222.222,
                            vec![
                                Point::new_with_m(2, 2, empty_value.clone()),
                                Point::new_with_m(3, 3, empty_value.clone()),
                                Point::new_with_m(4, 4, empty_value.clone()),
                                Point::new_with_m(5, 5, empty_value.clone()),
                                Point::new_with_m(2, 2, empty_value.clone()),
                            ],
                        ),
                    ],
                ]),
            );
            // load lines
            let lines = o_feature.load_lines();
            assert_eq!(lines.len(), 3);
            assert_eq!(
                lines,
                vec![
                    VectorLineWithOffset::new(
                        22.2,
                        vec![
                            Point::new_with_m(0, 0, example_value2.clone()),
                            Point::new_with_m(1, 1, empty_value.clone()),
                            Point::new_with_m(2, 2, empty_value.clone()),
                            Point::new_with_m(3, 3, empty_value.clone()),
                            Point::new_with_m(0, 0, empty_value.clone()),
                        ]
                    ),
                    VectorLineWithOffset::new(
                        5.123,
                        vec![
                            Point::new_with_m(0, 0, example_value2.clone()),
                            Point::new_with_m(1, 1, empty_value.clone()),
                            Point::new_with_m(2, 2, empty_value.clone()),
                            Point::new_with_m(3, 3, empty_value.clone()),
                            Point::new_with_m(0, 0, empty_value.clone()),
                        ]
                    ),
                    VectorLineWithOffset::new(
                        2_222.222,
                        vec![
                            Point::new_with_m(2, 2, empty_value.clone()),
                            Point::new_with_m(3, 3, empty_value.clone()),
                            Point::new_with_m(4, 4, empty_value.clone()),
                            Point::new_with_m(5, 5, empty_value.clone()),
                            Point::new_with_m(2, 2, empty_value.clone()),
                        ]
                    ),
                ],
            );
            // load indices
            assert_eq!(o_feature.read_indices(), vec![0, 1, 2, 1, 5]);
            // load tessellations
            let mut tess = vec![];
            o_feature.add_tesselation(&mut tess, 1.0);
            assert_eq!(tess, vec![10.0, 4.0, 11.0, 5.0, 12.0, 6.0]);

            // load_geometry_flat
            let (geometry_flat, indices) = o_feature.load_geometry_flat();
            assert_eq!(indices, vec![0, 1, 2, 1, 5]);
            assert_eq!(
                geometry_flat,
                vec![
                    0.0,
                    0.0,
                    0.0001220703125,
                    0.0001220703125,
                    0.000244140625,
                    0.000244140625,
                    0.0003662109375,
                    0.0003662109375,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0001220703125,
                    0.0001220703125,
                    0.000244140625,
                    0.000244140625,
                    0.0003662109375,
                    0.0003662109375,
                    0.0,
                    0.0,
                    0.000244140625,
                    0.000244140625,
                    0.0003662109375,
                    0.0003662109375,
                    0.00048828125,
                    0.00048828125,
                    0.0006103515625,
                    0.0006103515625,
                    0.000244140625,
                    0.000244140625,
                    0.001220703125,
                    0.00048828125,
                    0.0013427734375,
                    0.0006103515625,
                    0.00146484375,
                    0.000732421875
                ]
            );
        }
    }

    #[test]
    fn test_open_vector_tile_3d() {
        let mut tile = BaseVectorTile::default();

        let example_value_str = r#"{
            "a": -20,
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

        let empty_value = Value(BTreeMap::from([
            (
                "a".to_string(),
                ValueType::Primitive(PrimitiveValue::I64(0)),
            ),
            (
                "b".to_string(),
                ValueType::Primitive(PrimitiveValue::U64(0)),
            ),
            (
                "c".to_string(),
                ValueType::Primitive(PrimitiveValue::F32(0.0)),
            ),
        ]));

        // POINTS //-//-//-//-//-//-//-//-//-//-//

        let mut points_layer =
            BaseVectorLayer::new("points".to_string(), 4_096.into(), vec![], None, None);

        let feature = BaseVectorPoints3DFeature::new(
            None,
            vec![Point3D::new_with_m(0, 0, 0, example_value2.clone())],
            example_value.clone(),
            None,
        );
        let feature2 = BaseVectorPoints3DFeature::new(
            Some(1),
            vec![
                Point3D::new_with_m(0, 0, 0, example_value.clone()),
                Point3D::new(1, 1, 1),
            ],
            example_value2.clone(),
            Some(BBox3D::new(-1.1, 0.0, 1.0, 1.0, -20.0, 20.0)),
        );

        // add_features
        points_layer.add_feature(BaseVectorFeature::BaseVectorPoints3DFeature(feature));
        points_layer.add_feature(BaseVectorFeature::BaseVectorPoints3DFeature(feature2));

        tile.add_layer(points_layer);

        // LINES //-//-//-//-//-//-//-//-//-//-//

        let mut lines_layer =
            BaseVectorLayer::new("lines".to_string(), 2_048.into(), vec![], None, None);

        let feature3 = BaseVectorLines3DFeature::new(
            None,
            vec![VectorLine3DWithOffset::new(
                0.0,
                vec![Point3D::new_with_m(0, 0, 0, example_value2.clone())],
            )],
            example_value.clone(),
            None,
        );
        let feature4 = BaseVectorLines3DFeature::new(
            Some(1),
            vec![
                VectorLine3DWithOffset::new(
                    2.0,
                    vec![Point3D::new_with_m(0, 0, 0, example_value2.clone())],
                ),
                VectorLine3DWithOffset::new(
                    5.0,
                    vec![Point3D::new(2, 2, 2), Point3D::new(3, 3, 3)],
                ),
            ],
            example_value2.clone(),
            None,
        );

        lines_layer.add_feature(BaseVectorFeature::BaseVectorLines3DFeature(feature3));
        lines_layer.add_feature(BaseVectorFeature::BaseVectorLines3DFeature(feature4));

        tile.add_layer(lines_layer);

        // POLYS //-//-//-//-//-//-//-//-//-//-//

        let mut polys_layer =
            BaseVectorLayer::new("polys".to_string(), 8_192.into(), vec![], None, None);

        let feature5 = BaseVectorPolys3DFeature::new(
            None,
            vec![vec![VectorLine3DWithOffset::new(
                0.0,
                vec![
                    Point3D::new_with_m(0, 0, 0, example_value2.clone()),
                    Point3D::new(1, 1, 1),
                    Point3D::new(2, 2, 2),
                    Point3D::new(3, 3, 3),
                    Point3D::new(0, 0, 0),
                ],
            )]],
            example_value.clone(),
            None,
            vec![],
            vec![],
        );

        let feature6 = BaseVectorPolys3DFeature::new(
            Some(1),
            vec![
                vec![VectorLine3DWithOffset::new(
                    22.2,
                    vec![
                        Point3D::new_with_m(0, 0, 0, example_value2.clone()),
                        Point3D::new(1, 1, 1),
                        Point3D::new(2, 2, 2),
                        Point3D::new(3, 3, 3),
                        Point3D::new(0, 0, 0),
                    ],
                )],
                vec![
                    VectorLine3DWithOffset::new(
                        5.123,
                        vec![
                            Point3D::new_with_m(0, 0, 0, example_value2.clone()),
                            Point3D::new(1, 1, 1),
                            Point3D::new(2, 2, 2),
                            Point3D::new(3, 3, 3),
                            Point3D::new(0, 0, 0),
                        ],
                    ),
                    VectorLine3DWithOffset::new(
                        2_222.222222,
                        vec![
                            Point3D::new(2, 2, 2),
                            Point3D::new(3, 3, 3),
                            Point3D::new(4, 4, 4),
                            Point3D::new(5, 5, 5),
                            Point3D::new(2, 2, 2),
                        ],
                    ),
                ],
            ],
            example_value2.clone(),
            None,
            vec![0, 1, 2, 1, 5],
            vec![
                Point3D::new(10, 4, 1),
                Point3D::new(11, 5, 2),
                Point3D::new(12, 6, 3),
            ],
        );

        polys_layer.add_feature(BaseVectorFeature::BaseVectorPolys3DFeature(feature5));
        polys_layer.add_feature(BaseVectorFeature::BaseVectorPolys3DFeature(feature6));

        tile.add_layer(polys_layer);

        // convert BaseVectorLayer into OpenVectorTile
        let open_tile_bytes = write_tile(&mut tile);

        let mut open_tile = VectorTile::new(open_tile_bytes, None);

        assert_eq!(open_tile.layers.len(), 3);

        // POINTS

        let o_points_layer = open_tile.layer("points").unwrap();

        assert_eq!(o_points_layer.version(), 1);
        assert_eq!(o_points_layer.name(), "points");
        assert_eq!(o_points_layer.extent(), 4_096);

        assert_eq!(o_points_layer.len(), 2);

        {
            let o_feature = o_points_layer.feature(0).unwrap();
            // id
            assert_eq!(o_feature.id(), None);
            // properties
            assert_eq!(o_feature.properties(), example_value);
            // version
            assert_eq!(o_feature.version(), 1);
            // extent
            assert_eq!(o_feature.extent(), 4_096);
            // get_type
            assert_eq!(o_feature.get_type(), FeatureType::Points3D);
            // bbox
            assert_eq!(o_feature.bbox(), None);
            // has_m_values
            assert!(o_feature.has_m_values());
            // load_points
            let points = o_feature.load_points_3d();
            assert_eq!(points.len(), 1);
            assert_eq!(points, vec![Point3D::new(0, 0, 0)]);
            // load_geometry
            let geometry = o_feature.load_geometry();
            assert_eq!(
                geometry,
                VectorGeometry::VectorPoints3D(vec![Point3D::new(0, 0, 0)])
            );
            // load indices
            assert_eq!(o_feature.read_indices(), Vec::<u32>::new());

            // load points
            let load_points_test =
                panic::catch_unwind(AssertUnwindSafe(|| o_feature.load_points()));
            assert!(load_points_test.is_err());

            // load points
            let load_points_test = panic::catch_unwind(AssertUnwindSafe(|| o_feature.load_lines()));
            assert!(load_points_test.is_err());
        }

        {
            let o_feature = o_points_layer.feature(1).unwrap();
            // id
            assert_eq!(o_feature.id(), Some(1));
            // properties
            assert_eq!(o_feature.properties(), example_value2);
            // version
            assert_eq!(o_feature.version(), 1);
            // extent
            assert_eq!(o_feature.extent(), 4_096);
            // get_type
            assert_eq!(o_feature.get_type(), FeatureType::Points3D);
            // bbox
            assert_eq!(
                o_feature.bbox(),
                Some(BBOX::BBox3D(BBox3D {
                    left: -1.0999954402444132,
                    bottom: -5.364418356634815e-6,
                    right: 1.0000026822091854,
                    top: 0.9999973177908288,
                    far: 20.0,
                    near: -20.0
                }))
            );
            // has_m_values
            assert!(o_feature.has_m_values());
            // load_points
            let points = o_feature.load_points_3d();
            assert_eq!(points.len(), 2);
            assert_eq!(
                points,
                vec![
                    Point3D::new_with_m(0, 0, 0, example_value.clone()),
                    Point3D::new_with_m(1, 1, 1, empty_value.clone())
                ]
            );
            // load_geometry
            let geometry = o_feature.load_geometry();
            assert_eq!(
                geometry,
                VectorGeometry::VectorPoints3D(vec![
                    Point3D::new_with_m(0, 0, 0, example_value.clone()),
                    Point3D::new_with_m(1, 1, 1, empty_value.clone())
                ])
            );
            // load indices
            assert_eq!(o_feature.read_indices(), Vec::<u32>::new());
        }

        // LINES

        let m_lines_layer = open_tile.layer("lines").unwrap();

        assert_eq!(m_lines_layer.version(), 1);
        assert_eq!(m_lines_layer.name(), "lines");
        assert_eq!(m_lines_layer.extent(), 2_048);

        assert_eq!(m_lines_layer.len(), 2);

        {
            let o_feature = m_lines_layer.feature(0).unwrap();
            // id
            assert_eq!(o_feature.id(), None);
            // properties
            assert_eq!(o_feature.properties(), example_value);
            // version
            assert_eq!(o_feature.version(), 1);
            // extent
            assert_eq!(o_feature.extent(), 2_048);
            // get_type
            assert_eq!(o_feature.get_type(), FeatureType::Lines3D);
            // bbox
            assert_eq!(o_feature.bbox(), None);
            // has_m_values
            assert!(o_feature.has_m_values());
            // load_points
            let points = o_feature.load_points_3d();
            assert_eq!(points.len(), 1);
            assert_eq!(
                points,
                vec![Point3D::new_with_m(0, 0, 0, example_value2.clone())]
            );
            // load_geometry
            let geometry = o_feature.load_geometry();
            assert_eq!(
                geometry,
                VectorGeometry::VectorLines3D(vec![VectorLine3DWithOffset::new(
                    0.0,
                    vec![Point3D::new_with_m(0, 0, 0, example_value2.clone())],
                )]),
            );
            // load lines
            let lines = o_feature.load_lines_3d();
            assert_eq!(lines.len(), 1);
            assert_eq!(
                lines,
                vec![VectorLine3DWithOffset::new(
                    0.0,
                    vec![Point3D::new_with_m(0, 0, 0, example_value2.clone())]
                )],
            );
            // load indices
            assert_eq!(o_feature.read_indices(), Vec::<u32>::new());
        }
        {
            let o_feature = m_lines_layer.feature(1).unwrap();
            // id
            assert_eq!(o_feature.id(), Some(1));
            // properties
            assert_eq!(o_feature.properties(), example_value2);
            // version
            assert_eq!(o_feature.version(), 1);
            // extent
            assert_eq!(o_feature.extent(), 2_048);
            // get_type
            assert_eq!(o_feature.get_type(), FeatureType::Lines3D);
            // bbox
            assert_eq!(o_feature.bbox(), None);
            // has_m_values
            assert!(o_feature.has_m_values());
            // load_points
            let points = o_feature.load_points_3d();
            assert_eq!(points.len(), 3);
            assert_eq!(
                points,
                vec![
                    Point3D::new_with_m(0, 0, 0, example_value2.clone()),
                    Point3D::new_with_m(2, 2, 2, empty_value.clone()),
                    Point3D::new_with_m(3, 3, 3, empty_value.clone())
                ]
            );
            // load_geometry
            let geometry = o_feature.load_geometry();
            assert_eq!(
                geometry,
                VectorGeometry::VectorLines3D(vec![
                    VectorLine3DWithOffset::new(
                        2.0,
                        vec![Point3D::new_with_m(0, 0, 0, example_value2.clone())]
                    ),
                    VectorLine3DWithOffset::new(
                        5.0,
                        vec![
                            Point3D::new_with_m(2, 2, 2, empty_value.clone()),
                            Point3D::new_with_m(3, 3, 3, empty_value.clone())
                        ]
                    ),
                ]),
            );
            // load lines
            let lines = o_feature.load_lines_3d();
            assert_eq!(lines.len(), 2);
            assert_eq!(
                lines,
                vec![
                    VectorLine3DWithOffset::new(
                        2.0,
                        vec![Point3D::new_with_m(0, 0, 0, example_value2.clone())],
                    ),
                    VectorLine3DWithOffset::new(
                        5.0,
                        vec![
                            Point3D::new_with_m(2, 2, 2, empty_value.clone()),
                            Point3D::new_with_m(3, 3, 3, empty_value.clone())
                        ]
                    ),
                ],
            );
            // load indices
            assert_eq!(o_feature.read_indices(), Vec::<u32>::new());
        }

        // POLYGONS

        let m_polygons_layer = open_tile.layer("polys").unwrap();

        assert_eq!(m_polygons_layer.version(), 1);
        assert_eq!(m_polygons_layer.name(), "polys");
        assert_eq!(m_polygons_layer.extent(), 8_192);

        assert_eq!(m_polygons_layer.len(), 2);

        {
            let o_feature = m_polygons_layer.feature(0).unwrap();
            // id
            assert_eq!(o_feature.id(), None);
            // properties
            assert_eq!(o_feature.properties(), example_value);
            // version
            assert_eq!(o_feature.version(), 1);
            // extent
            assert_eq!(o_feature.extent(), 8_192);
            // get_type
            assert_eq!(o_feature.get_type(), FeatureType::Polygons3D);
            // bbox
            assert_eq!(o_feature.bbox(), None);
            // has_m_values
            assert!(o_feature.has_m_values());
            // load_points
            let points = o_feature.load_points_3d();
            assert_eq!(points.len(), 4);
            assert_eq!(
                points,
                vec![
                    Point3D::new_with_m(0, 0, 0, example_value2.clone()),
                    Point3D::new_with_m(1, 1, 1, empty_value.clone()),
                    Point3D::new_with_m(2, 2, 2, empty_value.clone()),
                    Point3D::new_with_m(3, 3, 3, empty_value.clone()),
                ]
            );
            // load_geometry
            let geometry = o_feature.load_geometry();
            assert_eq!(
                geometry,
                VectorGeometry::VectorPolys3D(vec![vec![VectorLine3DWithOffset::new(
                    0.0,
                    vec![
                        Point3D::new_with_m(0, 0, 0, example_value2.clone()),
                        Point3D::new_with_m(1, 1, 1, empty_value.clone()),
                        Point3D::new_with_m(2, 2, 2, empty_value.clone()),
                        Point3D::new_with_m(3, 3, 3, empty_value.clone()),
                        Point3D::new_with_m(0, 0, 0, empty_value.clone()),
                    ],
                )]]),
            );
            // load lines
            let lines = o_feature.load_lines_3d();
            assert_eq!(lines.len(), 1);
            assert_eq!(
                lines,
                vec![VectorLine3DWithOffset::new(
                    0.0,
                    vec![
                        Point3D::new_with_m(0, 0, 0, example_value2.clone()),
                        Point3D::new_with_m(1, 1, 1, empty_value.clone()),
                        Point3D::new_with_m(2, 2, 2, empty_value.clone()),
                        Point3D::new_with_m(3, 3, 3, empty_value.clone()),
                        Point3D::new_with_m(0, 0, 0, empty_value.clone()),
                    ]
                )],
            );
            // load indices
            assert_eq!(o_feature.read_indices(), Vec::<u32>::new());
            // load tessellations
            let mut tess = vec![];
            o_feature.add_tesselation(&mut tess, 1.0 / 8_192.0);
            assert_eq!(tess, Vec::<f64>::new());

            // load_geometry_flat
            let (geometry_flat, indices) = o_feature.load_geometry_flat();
            assert_eq!(indices, Vec::<u32>::new());
            assert_eq!(
                geometry_flat,
                vec![
                    0.0,
                    0.0,
                    0.0001220703125,
                    0.0001220703125,
                    0.000244140625,
                    0.000244140625,
                    0.0003662109375,
                    0.0003662109375,
                    0.0,
                    0.0
                ]
            );
        }
        {
            let o_feature = m_polygons_layer.feature(1).unwrap();
            // id
            assert_eq!(o_feature.id(), Some(1));
            // properties
            assert_eq!(o_feature.properties(), example_value2);
            // version
            assert_eq!(o_feature.version(), 1);
            // extent
            assert_eq!(o_feature.extent(), 8_192);
            // get_type
            assert_eq!(o_feature.get_type(), FeatureType::Polygons3D);
            // bbox
            assert_eq!(o_feature.bbox(), None);
            // has_m_values
            assert!(o_feature.has_m_values());
            // load_points
            let points = o_feature.load_points_3d();
            assert_eq!(points.len(), 12);
            assert_eq!(
                points,
                vec![
                    Point3D::new_with_m(0, 0, 0, example_value2.clone()),
                    Point3D::new_with_m(1, 1, 1, empty_value.clone()),
                    Point3D::new_with_m(2, 2, 2, empty_value.clone()),
                    Point3D::new_with_m(3, 3, 3, empty_value.clone()),
                    Point3D::new_with_m(0, 0, 0, example_value2.clone()),
                    Point3D::new_with_m(1, 1, 1, empty_value.clone()),
                    Point3D::new_with_m(2, 2, 2, empty_value.clone()),
                    Point3D::new_with_m(3, 3, 3, empty_value.clone()),
                    Point3D::new_with_m(2, 2, 2, empty_value.clone()),
                    Point3D::new_with_m(3, 3, 3, empty_value.clone()),
                    Point3D::new_with_m(4, 4, 4, empty_value.clone()),
                    Point3D::new_with_m(5, 5, 5, empty_value.clone()),
                ]
            );
            // load_geometry
            let geometry = o_feature.load_geometry();
            assert_eq!(
                geometry,
                VectorGeometry::VectorPolys3D(vec![
                    vec![VectorLine3DWithOffset::new(
                        22.2,
                        vec![
                            Point3D::new_with_m(0, 0, 0, example_value2.clone()),
                            Point3D::new_with_m(1, 1, 1, empty_value.clone()),
                            Point3D::new_with_m(2, 2, 2, empty_value.clone()),
                            Point3D::new_with_m(3, 3, 3, empty_value.clone()),
                            Point3D::new_with_m(0, 0, 0, empty_value.clone()),
                        ],
                    )],
                    vec![
                        VectorLine3DWithOffset::new(
                            5.123,
                            vec![
                                Point3D::new_with_m(0, 0, 0, example_value2.clone()),
                                Point3D::new_with_m(1, 1, 1, empty_value.clone()),
                                Point3D::new_with_m(2, 2, 2, empty_value.clone()),
                                Point3D::new_with_m(3, 3, 3, empty_value.clone()),
                                Point3D::new_with_m(0, 0, 0, empty_value.clone()),
                            ],
                        ),
                        VectorLine3DWithOffset::new(
                            2_222.222,
                            vec![
                                Point3D::new_with_m(2, 2, 2, empty_value.clone()),
                                Point3D::new_with_m(3, 3, 3, empty_value.clone()),
                                Point3D::new_with_m(4, 4, 4, empty_value.clone()),
                                Point3D::new_with_m(5, 5, 5, empty_value.clone()),
                                Point3D::new_with_m(2, 2, 2, empty_value.clone()),
                            ],
                        ),
                    ],
                ]),
            );
            // load lines
            let lines = o_feature.load_lines_3d();
            assert_eq!(lines.len(), 3);
            assert_eq!(
                lines,
                vec![
                    VectorLine3DWithOffset::new(
                        22.2,
                        vec![
                            Point3D::new_with_m(0, 0, 0, example_value2.clone()),
                            Point3D::new_with_m(1, 1, 1, empty_value.clone()),
                            Point3D::new_with_m(2, 2, 2, empty_value.clone()),
                            Point3D::new_with_m(3, 3, 3, empty_value.clone()),
                            Point3D::new_with_m(0, 0, 0, empty_value.clone()),
                        ]
                    ),
                    VectorLine3DWithOffset::new(
                        5.123,
                        vec![
                            Point3D::new_with_m(0, 0, 0, example_value2.clone()),
                            Point3D::new_with_m(1, 1, 1, empty_value.clone()),
                            Point3D::new_with_m(2, 2, 2, empty_value.clone()),
                            Point3D::new_with_m(3, 3, 3, empty_value.clone()),
                            Point3D::new_with_m(0, 0, 0, empty_value.clone()),
                        ]
                    ),
                    VectorLine3DWithOffset::new(
                        2_222.222,
                        vec![
                            Point3D::new_with_m(2, 2, 2, empty_value.clone()),
                            Point3D::new_with_m(3, 3, 3, empty_value.clone()),
                            Point3D::new_with_m(4, 4, 4, empty_value.clone()),
                            Point3D::new_with_m(5, 5, 5, empty_value.clone()),
                            Point3D::new_with_m(2, 2, 2, empty_value.clone()),
                        ]
                    ),
                ],
            );
            // load indices
            assert_eq!(o_feature.read_indices(), vec![0, 1, 2, 1, 5]);
            // load tessellations
            let mut tess = vec![];
            o_feature.add_tesselation_3d(&mut tess, 1.0);
            assert_eq!(tess, vec![10.0, 4.0, 1.0, 11.0, 5.0, 2.0, 12.0, 6.0, 3.0]);

            // load_geometry_flat
            let (geometry_flat, indices) = o_feature.load_geometry_flat();
            assert_eq!(indices, vec![0, 1, 2, 1, 5]);
            assert_eq!(
                geometry_flat,
                vec![
                    0.0,
                    0.0,
                    0.0001220703125,
                    0.0001220703125,
                    0.000244140625,
                    0.000244140625,
                    0.0003662109375,
                    0.0003662109375,
                    0.0,
                    0.0,
                    0.0,
                    0.0,
                    0.0001220703125,
                    0.0001220703125,
                    0.000244140625,
                    0.000244140625,
                    0.0003662109375,
                    0.0003662109375,
                    0.0,
                    0.0,
                    0.000244140625,
                    0.000244140625,
                    0.0003662109375,
                    0.0003662109375,
                    0.00048828125,
                    0.00048828125,
                    0.0006103515625,
                    0.0006103515625,
                    0.000244140625,
                    0.000244140625,
                    0.001220703125,
                    0.00048828125,
                    0.0001220703125,
                    0.0013427734375,
                    0.0006103515625,
                    0.000244140625,
                    0.00146484375,
                    0.000732421875,
                    0.0003662109375
                ]
            );
        }
    }

    #[test]
    fn test_vector_tile_to_base_vector_tile() {
        let mut tile = BaseVectorTile::default();

        let example_value = Value(BTreeMap::from([
            (
                "a".to_string(),
                ValueType::Primitive(PrimitiveValue::I64(-5)),
            ),
            (
                "b".to_string(),
                ValueType::Primitive(PrimitiveValue::U64(1_000)),
            ),
            (
                "c".to_string(),
                ValueType::Primitive(PrimitiveValue::F32(-2.2)),
            ),
            (
                "d".to_string(),
                ValueType::Primitive(PrimitiveValue::F64(9_999.999_9)),
            ),
            (
                "e".to_string(),
                ValueType::Primitive(PrimitiveValue::Bool(true)),
            ),
            ("f".to_string(), ValueType::Primitive(PrimitiveValue::Null)),
            (
                "g".to_string(),
                ValueType::Primitive(PrimitiveValue::String("hello".to_string())),
            ),
            (
                "h".to_string(),
                ValueType::Array(vec![
                    ValuePrimitiveType::Primitive(PrimitiveValue::String("hello".to_string())),
                    ValuePrimitiveType::Primitive(PrimitiveValue::String("world".to_string())),
                ]),
            ),
            (
                "i".to_string(),
                ValueType::Nested(Value(BTreeMap::from([
                    (
                        "j".to_string(),
                        ValueType::Primitive(PrimitiveValue::F64(2.200000047683716)),
                    ),
                    (
                        "k".to_string(),
                        ValueType::Primitive(PrimitiveValue::Bool(true)),
                    ),
                    ("l".to_string(), ValueType::Primitive(PrimitiveValue::Null)),
                    (
                        "m".to_string(),
                        ValueType::Primitive(PrimitiveValue::F32(4.5)),
                    ),
                ]))),
            ),
        ]));

        let feature = BaseVectorPointsFeature::new(
            Some(1),
            vec![Point::new_with_m(0, 0, example_value.clone())],
            example_value.clone(),
            None,
        );
        let feature2 = BaseVectorPoints3DFeature::new(
            Some(2),
            vec![Point3D::new_with_m(0, 0, 0, example_value.clone())],
            example_value.clone(),
            None,
        );

        let mut points_layer =
            BaseVectorLayer::new("points".to_string(), 4096.into(), vec![], None, None);

        points_layer.add_feature(BaseVectorFeature::BaseVectorPointsFeature(feature.clone()));
        points_layer.add_feature(BaseVectorFeature::BaseVectorPoints3DFeature(
            feature2.clone(),
        ));

        tile.add_layer(points_layer);

        let open_tile_bytes = write_tile(&mut tile);
        let mut _open_tile = VectorTile::new(open_tile_bytes, None);

        // let base_tile = BaseVectorTile::from(&mut open_tile);

        // assert_eq!(base_tile.layers.len(), 1);
        // let points_layer = base_tile.layers.get("points").unwrap();
        // assert_eq!(points_layer.features.len(), 2);
        // assert_eq!(
        //     points_layer.features[0],
        //     BaseVectorFeature::BaseVectorPointsFeature(feature.clone())
        // );
        // assert_eq!(
        //     points_layer.features[1],
        //     BaseVectorFeature::BaseVectorPoints3DFeature(feature2.clone())
        // );
    }
}
