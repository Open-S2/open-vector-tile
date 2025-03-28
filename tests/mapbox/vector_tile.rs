#[cfg(test)]
mod tests {
    extern crate alloc;
    use ovtile::{
        base::{
            BaseVectorFeature, BaseVectorLayer, BaseVectorLinesFeature, BaseVectorPointsFeature,
            BaseVectorPolysFeature, BaseVectorTile, VectorFeature,
        },
        mapbox::vector_tile::{write_tile, MapboxVectorTile},
        open::{Extent, FeatureType},
        Point, VectorGeometry, VectorLayerMethods, VectorLineWithOffset, VectorTile,
    };
    use s2json::Value;
    use std::{
        fs,
        panic::{self, AssertUnwindSafe},
    };

    #[test]
    fn test_mapbox_vector_tile() {
        let mut tile = BaseVectorTile::default();

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
            vec![Point::new_with_m(0, 0, example_value.clone()), Point::new(1, 1)],
            example_value2.clone(),
            None,
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
                    0.0,
                    vec![Point::new_with_m(0, 0, example_value2.clone())],
                ),
                VectorLineWithOffset::new(0.0, vec![Point::new(2, 2), Point::new(3, 3)]),
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
                    0.0,
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
                        0.0,
                        vec![
                            Point::new_with_m(0, 0, example_value2.clone()),
                            Point::new(1, 1),
                            Point::new(2, 2),
                            Point::new(3, 3),
                            Point::new(0, 0),
                        ],
                    ),
                    VectorLineWithOffset::new(
                        0.0,
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

        // convert BaseVectorLayer into MapboxVectorTile
        let mapbox_tile_bytes = write_tile(&mut tile, false);

        let mut mapbox_tile = MapboxVectorTile::new(mapbox_tile_bytes, None);

        assert_eq!(mapbox_tile.layers.len(), 3);

        // POINTS

        let m_points_layer = mapbox_tile.layer("points").unwrap();

        assert_eq!(m_points_layer.version(), 5);
        assert_eq!(m_points_layer.name(), "points");
        assert_eq!(m_points_layer.extent(), 4_096);

        assert_eq!(m_points_layer.len(), 2);

        {
            let m_feature = m_points_layer.feature(0).unwrap();
            // id
            assert_eq!(m_feature.id(), None);
            // properties
            assert_eq!(m_feature.properties(), example_value);
            // version
            assert_eq!(m_feature.version(), 5);
            // extent
            assert_eq!(m_feature.extent(), 4_096);
            // get_type
            assert_eq!(m_feature.get_type(), FeatureType::Points);
            // bbox
            assert_eq!(m_feature.bbox(), None);
            // has_m_values
            assert!(!m_feature.has_m_values());
            // is points
            assert!(m_feature.is_points());
            // is lines
            assert!(!m_feature.is_lines());
            // is polys
            assert!(!m_feature.is_polygons());
            // is points3d
            assert!(!m_feature.is_points_3d());
            // is lines3d
            assert!(!m_feature.is_lines_3d());
            // is polys3d
            assert!(!m_feature.is_polygons_3d());
            // load_points
            let points = m_feature.load_points();
            assert_eq!(points.len(), 1);
            assert_eq!(points, vec![Point::new(0, 0)]);
            // load_geometry
            let geometry = m_feature.load_geometry();
            assert_eq!(geometry, VectorGeometry::VectorPoints(vec![Point::new(0, 0)]));
            // load indices
            assert_eq!(m_feature.read_indices(), Vec::<u32>::new());

            // Test that a function panics
            let load_points_3d_test =
                panic::catch_unwind(AssertUnwindSafe(|| m_feature.load_points_3d()));
            assert!(load_points_3d_test.is_err());

            // load_lines
            let load_lines_test = panic::catch_unwind(AssertUnwindSafe(|| m_feature.load_lines()));
            assert!(load_lines_test.is_err());

            // load_lines_3d
            let load_lines_3d_test =
                panic::catch_unwind(AssertUnwindSafe(|| m_feature.load_lines_3d()));
            assert!(load_lines_3d_test.is_err());

            // load_geometry_flat
            let load_geometry_flat_test =
                panic::catch_unwind(AssertUnwindSafe(|| m_feature.load_geometry_flat()));
            assert!(load_geometry_flat_test.is_err());

            // add_tesselation_3d
            let add_tesselation_3d_test = panic::catch_unwind(AssertUnwindSafe(|| {
                let mut tmp_vec = vec![];
                m_feature.add_tesselation_3d(&mut tmp_vec, 1.);
            }));
            assert!(add_tesselation_3d_test.is_err());
        }

        {
            let m_feature = m_points_layer.feature(1).unwrap();
            // id
            assert_eq!(m_feature.id(), Some(1));
            // properties
            assert_eq!(m_feature.properties(), example_value2);
            // version
            assert_eq!(m_feature.version(), 5);
            // extent
            assert_eq!(m_feature.extent(), 4_096);
            // get_type
            assert_eq!(m_feature.get_type(), FeatureType::Points);
            // bbox
            assert_eq!(m_feature.bbox(), None);
            // has_m_values
            assert!(!m_feature.has_m_values());
            // is points
            assert!(m_feature.is_points());
            // is lines
            assert!(!m_feature.is_lines());
            // is polys
            assert!(!m_feature.is_polygons());
            // is points3d
            assert!(!m_feature.is_points_3d());
            // is lines3d
            assert!(!m_feature.is_lines_3d());
            // is polys3d
            assert!(!m_feature.is_polygons_3d());
            // load_points
            let points = m_feature.load_points();
            assert_eq!(points.len(), 2);
            assert_eq!(points, vec![Point::new(0, 0), Point::new(1, 1)]);
            // load_geometry
            let geometry = m_feature.load_geometry();
            assert_eq!(
                geometry,
                VectorGeometry::VectorPoints(vec![Point::new(0, 0), Point::new(1, 1)])
            );
            // load indices
            assert_eq!(m_feature.read_indices(), Vec::<u32>::new());
        }

        // LINES

        let m_lines_layer = mapbox_tile.layer("lines").unwrap();

        assert_eq!(m_lines_layer.version(), 5);
        assert_eq!(m_lines_layer.name(), "lines");
        assert_eq!(m_lines_layer.extent(), 2_048);

        assert_eq!(m_lines_layer.len(), 2);

        {
            let m_feature = m_lines_layer.feature(0).unwrap();
            // id
            assert_eq!(m_feature.id(), None);
            // properties
            assert_eq!(m_feature.properties(), example_value);
            // version
            assert_eq!(m_feature.version(), 5);
            // extent
            assert_eq!(m_feature.extent(), 2_048);
            // get_type
            assert_eq!(m_feature.get_type(), FeatureType::Lines);
            // bbox
            assert_eq!(m_feature.bbox(), None);
            // has_m_values
            assert!(!m_feature.has_m_values());
            // is points
            assert!(!m_feature.is_points());
            // is lines
            assert!(m_feature.is_lines());
            // is polys
            assert!(!m_feature.is_polygons());
            // is points3d
            assert!(!m_feature.is_points_3d());
            // is lines3d
            assert!(!m_feature.is_lines_3d());
            // is polys3d
            assert!(!m_feature.is_polygons_3d());
            // load_points
            let points = m_feature.load_points();
            assert_eq!(points.len(), 1);
            assert_eq!(points, vec![Point::new(0, 0)]);
            // load_geometry
            let geometry = m_feature.load_geometry();
            assert_eq!(
                geometry,
                VectorGeometry::VectorLines(vec![VectorLineWithOffset::new(
                    0.0,
                    vec![Point::new(0, 0)],
                )]),
            );
            // load lines
            let lines = m_feature.load_lines();
            assert_eq!(lines.len(), 1);
            assert_eq!(lines, vec![VectorLineWithOffset::new(0.0, vec![Point::new(0, 0)])],);
            // load indices
            assert_eq!(m_feature.read_indices(), Vec::<u32>::new());
        }
        {
            let m_feature = m_lines_layer.feature(1).unwrap();
            // id
            assert_eq!(m_feature.id(), Some(1));
            // properties
            assert_eq!(m_feature.properties(), example_value2);
            // version
            assert_eq!(m_feature.version(), 5);
            // extent
            assert_eq!(m_feature.extent(), 2_048);
            // get_type
            assert_eq!(m_feature.get_type(), FeatureType::Lines);
            // bbox
            assert_eq!(m_feature.bbox(), None);
            // has_m_values
            assert!(!m_feature.has_m_values());
            // is points
            assert!(!m_feature.is_points());
            // is lines
            assert!(m_feature.is_lines());
            // is polys
            assert!(!m_feature.is_polygons());
            // is points3d
            assert!(!m_feature.is_points_3d());
            // is lines3d
            assert!(!m_feature.is_lines_3d());
            // is polys3d
            assert!(!m_feature.is_polygons_3d());
            // load_points
            let points = m_feature.load_points();
            assert_eq!(points.len(), 3);
            assert_eq!(points, vec![Point::new(0, 0), Point::new(2, 2), Point::new(3, 3)]);
            // load_geometry
            let geometry = m_feature.load_geometry();
            assert_eq!(
                geometry,
                VectorGeometry::VectorLines(vec![
                    VectorLineWithOffset::new(0.0, vec![Point::new(0, 0)]),
                    VectorLineWithOffset::new(0.0, vec![Point::new(2, 2), Point::new(3, 3)]),
                ]),
            );
            // load lines
            let lines = m_feature.load_lines();
            assert_eq!(lines.len(), 2);
            assert_eq!(
                lines,
                vec![
                    VectorLineWithOffset::new(0.0, vec![Point::new(0, 0)],),
                    VectorLineWithOffset::new(0.0, vec![Point::new(2, 2), Point::new(3, 3)]),
                ],
            );
            // load indices
            assert_eq!(m_feature.read_indices(), Vec::<u32>::new());
        }

        // POLYGONS

        let m_polygons_layer = mapbox_tile.layer("polys").unwrap();

        assert_eq!(m_polygons_layer.version(), 5);
        assert_eq!(m_polygons_layer.name(), "polys");
        assert_eq!(m_polygons_layer.extent(), 8_192);

        assert_eq!(m_polygons_layer.len(), 2);

        {
            let m_feature = m_polygons_layer.feature(0).unwrap();
            // id
            assert_eq!(m_feature.id(), None);
            // properties
            assert_eq!(m_feature.properties(), example_value);
            // version
            assert_eq!(m_feature.version(), 5);
            // extent
            assert_eq!(m_feature.extent(), 8_192);
            // get_type
            assert_eq!(m_feature.get_type(), FeatureType::Polygons);
            // bbox
            assert_eq!(m_feature.bbox(), None);
            // has_m_values
            assert!(!m_feature.has_m_values());
            // is points
            assert!(!m_feature.is_points());
            // is lines
            assert!(!m_feature.is_lines());
            // is polys
            assert!(m_feature.is_polygons());
            // is points3d
            assert!(!m_feature.is_points_3d());
            // is lines3d
            assert!(!m_feature.is_lines_3d());
            // is polys3d
            assert!(!m_feature.is_polygons_3d());
            // load_points
            let points = m_feature.load_points();
            assert_eq!(points.len(), 4);
            assert_eq!(
                points,
                vec![Point::new(0, 0), Point::new(1, 1), Point::new(2, 2), Point::new(3, 3),]
            );
            // load_geometry
            let geometry = m_feature.load_geometry();
            assert_eq!(
                geometry,
                VectorGeometry::VectorPolys(vec![vec![VectorLineWithOffset::new(
                    0.0,
                    vec![
                        Point::new(0, 0),
                        Point::new(1, 1),
                        Point::new(2, 2),
                        Point::new(3, 3),
                        Point::new(0, 0),
                    ],
                )]]),
            );
            // load lines
            let lines = m_feature.load_lines();
            assert_eq!(lines.len(), 1);
            assert_eq!(
                lines,
                vec![VectorLineWithOffset::new(
                    0.0,
                    vec![
                        Point::new(0, 0),
                        Point::new(1, 1),
                        Point::new(2, 2),
                        Point::new(3, 3),
                        Point::new(0, 0)
                    ]
                )],
            );
            // load indices
            assert_eq!(m_feature.read_indices(), Vec::<u32>::new());
            // load tessellations
            let mut tess = vec![];
            m_feature.add_tesselation(&mut tess, 1.0 / 8_192.0);
            assert_eq!(tess, Vec::<f64>::new());

            // load_geometry_flat
            let (geometry_flat, indices) = m_feature.load_geometry_flat();
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
            let m_feature = m_polygons_layer.feature(1).unwrap();
            // id
            assert_eq!(m_feature.id(), Some(1));
            // properties
            assert_eq!(m_feature.properties(), example_value2);
            // version
            assert_eq!(m_feature.version(), 5);
            // extent
            assert_eq!(m_feature.extent(), 8_192);
            // get_type
            assert_eq!(m_feature.get_type(), FeatureType::Polygons);
            // bbox
            assert_eq!(m_feature.bbox(), None);
            // has_m_values
            assert!(!m_feature.has_m_values());
            // is points
            assert!(!m_feature.is_points());
            // is lines
            assert!(!m_feature.is_lines());
            // is polys
            assert!(m_feature.is_polygons());
            // is points3d
            assert!(!m_feature.is_points_3d());
            // is lines3d
            assert!(!m_feature.is_lines_3d());
            // is polys3d
            assert!(!m_feature.is_polygons_3d());
            // load_points
            let points = m_feature.load_points();
            assert_eq!(points.len(), 12);
            assert_eq!(
                points,
                vec![
                    Point::new(0, 0),
                    Point::new(1, 1),
                    Point::new(2, 2),
                    Point::new(3, 3),
                    Point::new(0, 0),
                    Point::new(1, 1),
                    Point::new(2, 2),
                    Point::new(3, 3),
                    Point::new(2, 2),
                    Point::new(3, 3),
                    Point::new(4, 4),
                    Point::new(5, 5),
                ]
            );
            // load_geometry
            let geometry = m_feature.load_geometry();
            assert_eq!(
                geometry,
                VectorGeometry::VectorPolys(vec![
                    vec![VectorLineWithOffset::new(
                        0.0,
                        vec![
                            Point::new(0, 0),
                            Point::new(1, 1),
                            Point::new(2, 2),
                            Point::new(3, 3),
                            Point::new(0, 0),
                        ],
                    )],
                    vec![
                        VectorLineWithOffset::new(
                            0.0,
                            vec![
                                Point::new(0, 0),
                                Point::new(1, 1),
                                Point::new(2, 2),
                                Point::new(3, 3),
                                Point::new(0, 0),
                            ],
                        ),
                        VectorLineWithOffset::new(
                            0.0,
                            vec![
                                Point::new(2, 2),
                                Point::new(3, 3),
                                Point::new(4, 4),
                                Point::new(5, 5),
                                Point::new(2, 2),
                            ],
                        ),
                    ],
                ]),
            );
            // load lines
            let lines = m_feature.load_lines();
            assert_eq!(lines.len(), 3);
            assert_eq!(
                lines,
                vec![
                    VectorLineWithOffset::new(
                        0.0,
                        vec![
                            Point::new(0, 0),
                            Point::new(1, 1),
                            Point::new(2, 2),
                            Point::new(3, 3),
                            Point::new(0, 0),
                        ]
                    ),
                    VectorLineWithOffset::new(
                        0.0,
                        vec![
                            Point::new(0, 0),
                            Point::new(1, 1),
                            Point::new(2, 2),
                            Point::new(3, 3),
                            Point::new(0, 0),
                        ]
                    ),
                    VectorLineWithOffset::new(
                        0.0,
                        vec![
                            Point::new(2, 2),
                            Point::new(3, 3),
                            Point::new(4, 4),
                            Point::new(5, 5),
                            Point::new(2, 2),
                        ]
                    ),
                ],
            );
            // load indices
            assert_eq!(m_feature.read_indices(), vec![0, 1, 2, 1, 5]);
            // load tessellations
            let mut tess = vec![];
            m_feature.add_tesselation(&mut tess, 1.0);
            assert_eq!(tess, vec![10.0, 4.0, 11.0, 5.0, 12.0, 6.0]);

            // load_geometry_flat
            let (geometry_flat, indices) = m_feature.load_geometry_flat();
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
    fn test_parse_file() {
        let data = fs::read("./tests/fixtures/multi-point.pbf").unwrap();
        let mut tile = MapboxVectorTile::new(data, None);
        assert_eq!(tile.layers.len(), 1);

        let geojson_layer = tile.layer("geojson").unwrap();
        assert_eq!(geojson_layer.version(), 2);
        assert_eq!(geojson_layer.name(), "geojson");
        assert_eq!(geojson_layer.extent(), 4_096);
        assert_eq!(geojson_layer.len(), 1);
        assert!(!geojson_layer.is_empty());

        let geojson_feature = geojson_layer.feature(0).unwrap();
        let geojson_geometry = geojson_feature.load_geometry();
        assert_eq!(
            geojson_geometry,
            VectorGeometry::VectorPoints(vec![Point::new(2059, 2025), Point::new(2082, 2002)])
        );
    }

    #[test]
    fn test_parse_file_vector_tile() {
        let data = fs::read("./tests/fixtures/multi-point.pbf").unwrap();
        let mut tile = VectorTile::new(data, None);
        assert_eq!(tile.layers.len(), 1);

        let geojson_layer = tile.layer("geojson").unwrap();
        assert_eq!(geojson_layer.version(), 2);
        assert_eq!(geojson_layer.name(), "geojson");
        assert_eq!(geojson_layer.extent(), 4_096);
        assert_eq!(geojson_layer.len(), 1);
        assert!(!geojson_layer.is_empty());

        let geojson_feature = geojson_layer.feature(0).unwrap();
        let geojson_geometry = geojson_feature.load_geometry();
        assert_eq!(
            geojson_geometry,
            VectorGeometry::VectorPoints(vec![Point::new(2059, 2025), Point::new(2082, 2002)])
        );
    }

    #[test]
    fn test_issue_60_file() {
        // https://github.com/mapbox/vector-tile-js/issues/60
        let data = fs::read("./tests/fixtures/multipolygon-with-closepath.pbf").unwrap();
        let mut tile = MapboxVectorTile::new(data, None);
        assert_eq!(tile.layers.len(), 1);

        let layer = tile.layer("geojsonLayer").unwrap();

        let len = layer.len();
        for i in 0..len {
            let feature = layer.feature(i).unwrap();
            feature.load_geometry();
        }
    }

    #[test]
    fn test_issue_60_file_vector_tile() {
        // https://github.com/mapbox/vector-tile-js/issues/60
        let data = fs::read("./tests/fixtures/multipolygon-with-closepath.pbf").unwrap();
        let mut tile = VectorTile::new(data, None);
        assert_eq!(tile.layers.len(), 1);

        let layer = tile.layer("geojsonLayer").unwrap();

        let len = layer.len();
        for i in 0..len {
            let feature = layer.feature(i).unwrap();
            feature.load_geometry();
        }
    }

    #[test]
    fn test_parse_file_multi_polygon() {
        let data = fs::read("./tests/fixtures/multipolygon-with-closepath.pbf").unwrap();
        let mut tile = MapboxVectorTile::new(data, None);
        assert_eq!(tile.layers.len(), 1);

        let geojson_layer = tile.layer("geojsonLayer").unwrap();
        assert_eq!(geojson_layer.version(), 1);
        assert_eq!(geojson_layer.name(), "geojsonLayer");
        assert_eq!(geojson_layer.extent(), 4_096);
        assert_eq!(geojson_layer.len(), 1);

        let geojson_feature = geojson_layer.feature(0).unwrap();
        let geojson_geometry = geojson_feature.load_geometry();
        assert_eq!(
            geojson_geometry,
            VectorGeometry::VectorPolys(vec![
                vec![VectorLineWithOffset {
                    offset: 0.0,
                    geometry: vec![
                        Point::new(1707, 1690),
                        Point::new(2390, 1690),
                        Point::new(2390, 2406),
                        Point::new(1707, 2406),
                        Point::new(1707, 1690),
                    ],
                },],
                vec![VectorLineWithOffset {
                    offset: 0.0,
                    geometry: vec![
                        Point::new(1878, 1876),
                        Point::new(2219, 1876),
                        Point::new(2219, 2221),
                        Point::new(1878, 2221),
                        Point::new(1878, 1876),
                    ],
                },],
            ])
        );

        let base_tile = BaseVectorTile::from(&mut tile);
        assert_eq!(base_tile.layers.len(), 1);
        assert_eq!(base_tile.layers.get("geojsonLayer").unwrap().len(), 1);

        let geojson_layer = base_tile.layers.get("geojsonLayer").unwrap();
        assert_eq!(geojson_layer.version, 1);
        assert_eq!(geojson_layer.name, "geojsonLayer");
        assert_eq!(geojson_layer.extent, Extent::Extent4096);
        assert_eq!(geojson_layer.len(), 1);

        let geojson_feature = geojson_layer.feature(0);
        // extract BaseVectorPolysFeature
        match geojson_feature {
            BaseVectorFeature::BaseVectorPolysFeature(feature) => {
                assert_eq!(feature.load_geometry(), geojson_geometry);
            }
            _ => panic!("expected BaseVectorPolysFeature"),
        }
    }

    #[test]
    fn test_parse_file_multi_polygon_vector_tile() {
        let data = fs::read("./tests/fixtures/multipolygon-with-closepath.pbf").unwrap();
        let mut tile = VectorTile::new(data, None);
        assert_eq!(tile.layers.len(), 1);

        let geojson_layer = tile.layer("geojsonLayer").unwrap();
        assert_eq!(geojson_layer.version(), 1);
        assert_eq!(geojson_layer.name(), "geojsonLayer");
        assert_eq!(geojson_layer.extent(), 4_096);
        assert_eq!(geojson_layer.len(), 1);

        let geojson_feature = geojson_layer.feature(0).unwrap();
        let geojson_geometry = geojson_feature.load_geometry();
        assert_eq!(
            geojson_geometry,
            VectorGeometry::VectorPolys(vec![
                vec![VectorLineWithOffset {
                    offset: 0.0,
                    geometry: vec![
                        Point::new(1707, 1690),
                        Point::new(2390, 1690),
                        Point::new(2390, 2406),
                        Point::new(1707, 2406),
                        Point::new(1707, 1690),
                    ],
                },],
                vec![VectorLineWithOffset {
                    offset: 0.0,
                    geometry: vec![
                        Point::new(1878, 1876),
                        Point::new(2219, 1876),
                        Point::new(2219, 2221),
                        Point::new(1878, 2221),
                        Point::new(1878, 1876),
                    ],
                },],
            ])
        );

        let base_tile = BaseVectorTile::from(&mut tile);
        assert_eq!(base_tile.layers.len(), 1);
        assert_eq!(base_tile.layers.get("geojsonLayer").unwrap().len(), 1);

        let geojson_layer = base_tile.layers.get("geojsonLayer").unwrap();
        assert_eq!(geojson_layer.version, 1);
        assert_eq!(geojson_layer.name, "geojsonLayer");
        assert_eq!(geojson_layer.extent, Extent::Extent4096);
        assert_eq!(geojson_layer.len(), 1);

        let geojson_feature = geojson_layer.feature(0);
        // extract BaseVectorPolysFeature
        match geojson_feature {
            BaseVectorFeature::BaseVectorPolysFeature(feature) => {
                assert_eq!(feature.load_geometry(), geojson_geometry);
            }
            _ => panic!("expected BaseVectorPolysFeature"),
        }
    }
}
