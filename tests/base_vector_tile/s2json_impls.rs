#[cfg(test)]
mod tests {
    extern crate alloc;

    use open_vector_tile::{
        base::{
            BaseVectorFeature, BaseVectorLines3DFeature, BaseVectorLinesFeature,
            BaseVectorPoints3DFeature, BaseVectorPointsFeature, BaseVectorPolys3DFeature,
            BaseVectorPolysFeature,
        },
        Point, Point3D, VectorLine3DWithOffset, VectorLineWithOffset,
    };
    use s2json::{
        BBox, BBox3D, MValue, Properties, VectorFeature, VectorGeometry, VectorLineStringGeometry,
        VectorMultiLineStringGeometry, VectorMultiPolygonGeometry, VectorPoint,
        VectorPolygonGeometry,
    };

    #[test]
    fn test_point_vector_feature_to_base_vector_feature() {
        let vf: VectorFeature<(), Properties, MValue> = VectorFeature {
            id: Some(3),
            properties: Properties::from([("foo".into(), "bar".into())]),
            geometry: VectorGeometry::new_point(
                VectorPoint::new_xy(1.1, 1.9, Some(MValue::from([("a".into(), 1_u32.into())]))),
                Some(BBox3D::new(0.0, 1.0, 2.0, 3.0, 0.0, 0.0)),
            ),
            ..Default::default()
        };

        let bvf: BaseVectorFeature = (&vf).into();

        assert_eq!(
            bvf,
            BaseVectorFeature::BaseVectorPointsFeature(BaseVectorPointsFeature {
                id: Some(3),
                geometry: vec![Point::new_with_m(1, 2, MValue::from([("a".into(), 1_u32.into())]))],
                properties: Properties::from([("foo".into(), "bar".into())]),
                bbox: Some(BBox::new(0.0, 1.0, 2.0, 3.0)),
            })
        );

        let vf: VectorFeature<(), Properties, MValue> = VectorFeature {
            id: Some(2),
            properties: Properties::from([("foo".into(), "bar".into())]),
            geometry: VectorGeometry::new_point(
                VectorPoint::new_xyz(
                    1.1,
                    1.9,
                    22.2,
                    Some(MValue::from([("a".into(), 1_u32.into())])),
                ),
                Some(BBox3D::new(0.0, 1.0, 2.0, 3.0, -3.3, 3.3)),
            ),
            ..Default::default()
        };

        let bvf: BaseVectorFeature = (&vf).into();

        assert_eq!(
            bvf,
            BaseVectorFeature::BaseVectorPoints3DFeature(BaseVectorPoints3DFeature {
                id: Some(2),
                geometry: vec![Point3D::new_with_m(
                    1,
                    2,
                    22,
                    MValue::from([("a".into(), 1_u32.into())])
                )],
                properties: Properties::from([("foo".into(), "bar".into())]),
                bbox: Some(BBox3D::new(0.0, 1.0, 2.0, 3.0, -3.3, 3.3)),
            })
        );
    }

    #[test]
    fn test_multipoint_vector_feature_to_base_vector_feature() {
        let vf: VectorFeature<(), Properties, MValue> = VectorFeature {
            id: Some(3),
            properties: Properties::from([("foo".into(), "bar".into())]),
            geometry: VectorGeometry::new_multipoint(
                vec![
                    VectorPoint::new_xy(1.1, 1.9, Some(MValue::from([("a".into(), 1_u32.into())]))),
                    VectorPoint::new_xy(
                        -1.1,
                        -1.9,
                        Some(MValue::from([("a".into(), 12_u32.into())])),
                    ),
                ],
                Some(BBox3D::new(0.0, 1.0, 2.0, 3.0, 0.0, 0.0)),
            ),
            ..Default::default()
        };

        let bvf: BaseVectorFeature = (&vf).into();

        assert_eq!(
            bvf,
            BaseVectorFeature::BaseVectorPointsFeature(BaseVectorPointsFeature {
                id: Some(3),
                geometry: vec![
                    Point::new_with_m(1, 2, MValue::from([("a".into(), 1_u32.into())])),
                    Point::new_with_m(-1, -2, MValue::from([("a".into(), 12_u32.into())]))
                ],
                properties: Properties::from([("foo".into(), "bar".into())]),
                bbox: Some(BBox::new(0.0, 1.0, 2.0, 3.0)),
            })
        );

        let vf: VectorFeature<(), Properties, MValue> = VectorFeature {
            id: Some(3),
            properties: Properties::from([("foo".into(), "bar".into())]),
            geometry: VectorGeometry::new_multipoint(
                vec![
                    VectorPoint::new_xyz(
                        1.1,
                        1.9,
                        3.3,
                        Some(MValue::from([("a".into(), 1_u32.into())])),
                    ),
                    VectorPoint::new_xyz(
                        -1.1,
                        -1.9,
                        -3.3,
                        Some(MValue::from([("a".into(), 12_u32.into())])),
                    ),
                ],
                Some(BBox3D::new(0.0, 1.0, 2.0, 3.0, 0.0, 0.0)),
            ),
            ..Default::default()
        };

        let bvf: BaseVectorFeature = (&vf).into();

        assert_eq!(
            bvf,
            BaseVectorFeature::BaseVectorPoints3DFeature(BaseVectorPoints3DFeature {
                id: Some(3),
                geometry: vec![
                    Point3D::new_with_m(1, 2, 3, MValue::from([("a".into(), 1_u32.into())])),
                    Point3D::new_with_m(-1, -2, -3, MValue::from([("a".into(), 12_u32.into())]))
                ],
                properties: Properties::from([("foo".into(), "bar".into())]),
                bbox: Some(BBox3D::new(0.0, 1.0, 2.0, 3.0, 0.0, 0.0)),
            })
        );
    }

    #[test]
    fn test_linestring_vector_feature_to_base_vector_feature() {
        let vf: VectorFeature<(), Properties, MValue> = VectorFeature {
            id: Some(3),
            properties: Properties::from([("foo".into(), "bar".into())]),
            geometry: VectorGeometry::LineString(VectorLineStringGeometry {
                coordinates: vec![
                    VectorPoint::new_xy(1.1, 1.9, Some(MValue::from([("a".into(), 1_u32.into())]))),
                    VectorPoint::new_xy(
                        -1.1,
                        -1.9,
                        Some(MValue::from([("a".into(), 12_u32.into())])),
                    ),
                ],
                bbox: Some(BBox3D::new(0.0, 1.0, 2.0, 3.0, 0.0, 0.0)),
                offset: Some(2.2),
                ..Default::default()
            }),
            ..Default::default()
        };

        let bvf: BaseVectorFeature = (&vf).into();

        assert_eq!(
            bvf,
            BaseVectorFeature::BaseVectorLinesFeature(BaseVectorLinesFeature {
                id: Some(3),
                geometry: vec![VectorLineWithOffset::new(
                    2.2,
                    vec![
                        Point::new_with_m(1, 2, MValue::from([("a".into(), 1_u32.into())])),
                        Point::new_with_m(-1, -2, MValue::from([("a".into(), 12_u32.into())]))
                    ]
                ),],
                properties: Properties::from([("foo".into(), "bar".into())]),
                bbox: Some(BBox::new(0.0, 1.0, 2.0, 3.0)),
            })
        );

        let vf: VectorFeature<(), Properties, MValue> = VectorFeature {
            id: Some(3),
            properties: Properties::from([("foo".into(), "bar".into())]),
            geometry: VectorGeometry::LineString(VectorLineStringGeometry {
                coordinates: vec![
                    VectorPoint::new_xyz(
                        1.1,
                        1.9,
                        3.3,
                        Some(MValue::from([("a".into(), 1_u32.into())])),
                    ),
                    VectorPoint::new_xyz(
                        -1.1,
                        -1.9,
                        -3.3,
                        Some(MValue::from([("a".into(), 12_u32.into())])),
                    ),
                ],
                is_3d: true,
                bbox: Some(BBox3D::new(0.0, 1.0, 2.0, 3.0, 0.0, 0.0)),
                offset: Some(2.2),
                ..Default::default()
            }),
            ..Default::default()
        };

        let bvf: BaseVectorFeature = (&vf).into();

        assert_eq!(
            bvf,
            BaseVectorFeature::BaseVectorLines3DFeature(BaseVectorLines3DFeature {
                id: Some(3),
                geometry: vec![VectorLine3DWithOffset::new(
                    2.2,
                    vec![
                        Point3D::new_with_m(1, 2, 3, MValue::from([("a".into(), 1_u32.into())])),
                        Point3D::new_with_m(
                            -1,
                            -2,
                            -3,
                            MValue::from([("a".into(), 12_u32.into())])
                        )
                    ]
                )],
                properties: Properties::from([("foo".into(), "bar".into())]),
                bbox: Some(BBox3D::new(0.0, 1.0, 2.0, 3.0, 0.0, 0.0)),
            })
        );
    }

    #[test]
    fn test_multilinestring_vector_feature_to_base_vector_feature() {
        let vf: VectorFeature<(), Properties, MValue> = VectorFeature {
            id: Some(3),
            properties: Properties::from([("foo".into(), "bar".into())]),
            geometry: VectorGeometry::MultiLineString(VectorMultiLineStringGeometry {
                coordinates: vec![
                    vec![
                        VectorPoint::new_xy(
                            1.1,
                            1.9,
                            Some(MValue::from([("a".into(), 1_u32.into())])),
                        ),
                        VectorPoint::new_xy(
                            -1.1,
                            -1.9,
                            Some(MValue::from([("a".into(), 12_u32.into())])),
                        ),
                    ],
                    vec![
                        VectorPoint::new_xy(
                            2.1,
                            2.9,
                            Some(MValue::from([("a".into(), 7_u32.into())])),
                        ),
                        VectorPoint::new_xy(
                            -2.1,
                            -2.9,
                            Some(MValue::from([("a".into(), 8_u32.into())])),
                        ),
                    ],
                ],
                bbox: Some(BBox3D::new(0.0, 1.0, 2.0, 3.0, -1.0, 1.0)),
                offset: Some(vec![2.2, 7.2]),
                ..Default::default()
            }),
            ..Default::default()
        };

        let bvf: BaseVectorFeature = (&vf).into();

        assert_eq!(
            bvf,
            BaseVectorFeature::BaseVectorLinesFeature(BaseVectorLinesFeature {
                id: Some(3),
                geometry: vec![
                    VectorLineWithOffset::new(
                        2.2,
                        vec![
                            Point::new_with_m(1, 2, MValue::from([("a".into(), 1_u32.into())])),
                            Point::new_with_m(-1, -2, MValue::from([("a".into(), 12_u32.into())]))
                        ]
                    ),
                    VectorLineWithOffset::new(
                        7.2,
                        vec![
                            Point::new_with_m(2, 3, MValue::from([("a".into(), 7_u32.into())])),
                            Point::new_with_m(-2, -3, MValue::from([("a".into(), 8_u32.into())]))
                        ]
                    )
                ],
                properties: Properties::from([("foo".into(), "bar".into())]),
                bbox: Some(BBox::new(0.0, 1.0, 2.0, 3.0)),
            })
        );

        let vf: VectorFeature<(), Properties, MValue> = VectorFeature {
            id: Some(3),
            properties: Properties::from([("foo".into(), "bar".into())]),
            geometry: VectorGeometry::MultiLineString(VectorMultiLineStringGeometry {
                coordinates: vec![
                    vec![
                        VectorPoint::new_xyz(
                            1.1,
                            1.9,
                            3.1,
                            Some(MValue::from([("a".into(), 1_u32.into())])),
                        ),
                        VectorPoint::new_xyz(
                            -1.1,
                            -1.9,
                            -3.1,
                            Some(MValue::from([("a".into(), 12_u32.into())])),
                        ),
                    ],
                    vec![
                        VectorPoint::new_xyz(
                            2.1,
                            2.9,
                            4.1,
                            Some(MValue::from([("a".into(), 7_u32.into())])),
                        ),
                        VectorPoint::new_xyz(
                            -2.1,
                            -2.9,
                            -4.1,
                            Some(MValue::from([("a".into(), 8_u32.into())])),
                        ),
                    ],
                ],
                is_3d: true,
                bbox: Some(BBox3D::new(0.0, 1.0, 2.0, 3.0, -1.0, 1.0)),
                offset: Some(vec![2.2, 7.2]),
                ..Default::default()
            }),
            ..Default::default()
        };

        let bvf: BaseVectorFeature = (&vf).into();

        assert_eq!(
            bvf,
            BaseVectorFeature::BaseVectorLines3DFeature(BaseVectorLines3DFeature {
                id: Some(3),
                geometry: vec![
                    VectorLine3DWithOffset::new(
                        2.2,
                        vec![
                            Point3D::new_with_m(
                                1,
                                2,
                                3,
                                MValue::from([("a".into(), 1_u32.into())])
                            ),
                            Point3D::new_with_m(
                                -1,
                                -2,
                                -3,
                                MValue::from([("a".into(), 12_u32.into())])
                            )
                        ]
                    ),
                    VectorLine3DWithOffset::new(
                        7.2,
                        vec![
                            Point3D::new_with_m(
                                2,
                                3,
                                4,
                                MValue::from([("a".into(), 7_u32.into())])
                            ),
                            Point3D::new_with_m(
                                -2,
                                -3,
                                -4,
                                MValue::from([("a".into(), 8_u32.into())])
                            )
                        ]
                    )
                ],
                properties: Properties::from([("foo".into(), "bar".into())]),
                bbox: Some(BBox3D::new(0.0, 1.0, 2.0, 3.0, -1., 1.)),
            })
        );
    }

    #[test]
    fn test_polygon_vector_feature_to_base_vector_feature() {
        let vf: VectorFeature<(), Properties, MValue> = VectorFeature {
            id: Some(3),
            properties: Properties::from([("foo".into(), "bar".into())]),
            geometry: VectorGeometry::Polygon(VectorPolygonGeometry {
                coordinates: vec![
                    vec![
                        VectorPoint::new_xy(
                            1.1,
                            1.9,
                            Some(MValue::from([("a".into(), 1_u32.into())])),
                        ),
                        VectorPoint::new_xy(
                            -1.1,
                            -1.9,
                            Some(MValue::from([("a".into(), 12_u32.into())])),
                        ),
                    ],
                    vec![
                        VectorPoint::new_xy(
                            2.1,
                            2.9,
                            Some(MValue::from([("a".into(), 7_u32.into())])),
                        ),
                        VectorPoint::new_xy(
                            -2.1,
                            -2.9,
                            Some(MValue::from([("a".into(), 8_u32.into())])),
                        ),
                    ],
                ],
                bbox: Some(BBox3D::new(0.0, 1.0, 2.0, 3.0, -1.0, 1.0)),
                offset: Some(vec![2.2, 7.2]),
                tessellation: Some(vec![-1.1, -2.2, 1.1, 2.2]),
                indices: Some(vec![1, 0]),
                ..Default::default()
            }),
            ..Default::default()
        };

        let bvf: BaseVectorFeature = (&vf).into();

        assert_eq!(
            bvf,
            BaseVectorFeature::BaseVectorPolysFeature(BaseVectorPolysFeature {
                id: Some(3),
                geometry: vec![vec![
                    VectorLineWithOffset::new(
                        2.2,
                        vec![
                            Point::new_with_m(1, 2, MValue::from([("a".into(), 1_u32.into())])),
                            Point::new_with_m(-1, -2, MValue::from([("a".into(), 12_u32.into())]))
                        ]
                    ),
                    VectorLineWithOffset::new(
                        7.2,
                        vec![
                            Point::new_with_m(2, 3, MValue::from([("a".into(), 7_u32.into())])),
                            Point::new_with_m(-2, -3, MValue::from([("a".into(), 8_u32.into())]))
                        ]
                    )
                ]],
                properties: Properties::from([("foo".into(), "bar".into())]),
                bbox: Some(BBox::new(0.0, 1.0, 2.0, 3.0)),
                tessellation: vec![Point::new(-1, -2), Point::new(1, 2)],
                indices: vec![1, 0],
            })
        );

        let vf: VectorFeature<(), Properties, MValue> = VectorFeature {
            id: Some(3),
            properties: Properties::from([("foo".into(), "bar".into())]),
            geometry: VectorGeometry::Polygon(VectorPolygonGeometry {
                coordinates: vec![
                    vec![
                        VectorPoint::new_xyz(
                            1.1,
                            1.9,
                            3.3,
                            Some(MValue::from([("a".into(), 1_u32.into())])),
                        ),
                        VectorPoint::new_xyz(
                            -1.1,
                            -1.9,
                            -3.3,
                            Some(MValue::from([("a".into(), 12_u32.into())])),
                        ),
                    ],
                    vec![
                        VectorPoint::new_xyz(
                            2.1,
                            2.9,
                            4.4,
                            Some(MValue::from([("a".into(), 7_u32.into())])),
                        ),
                        VectorPoint::new_xyz(
                            -2.1,
                            -2.9,
                            -4.4,
                            Some(MValue::from([("a".into(), 8_u32.into())])),
                        ),
                    ],
                ],
                is_3d: true,
                bbox: Some(BBox3D::new(0.0, 1.0, 2.0, 3.0, -1.0, 1.0)),
                offset: Some(vec![2.2, 7.2]),
                tessellation: Some(vec![-1.1, -2.2, -3.3, 1.1, 2.2, 3.3]),
                indices: Some(vec![1, 0]),
                ..Default::default()
            }),
            ..Default::default()
        };

        let bvf: BaseVectorFeature = (&vf).into();

        assert_eq!(
            bvf,
            BaseVectorFeature::BaseVectorPolys3DFeature(BaseVectorPolys3DFeature {
                id: Some(3),
                geometry: vec![vec![
                    VectorLine3DWithOffset::new(
                        2.2,
                        vec![
                            Point3D::new_with_m(
                                1,
                                2,
                                3,
                                MValue::from([("a".into(), 1_u32.into())])
                            ),
                            Point3D::new_with_m(
                                -1,
                                -2,
                                -3,
                                MValue::from([("a".into(), 12_u32.into())])
                            )
                        ]
                    ),
                    VectorLine3DWithOffset::new(
                        7.2,
                        vec![
                            Point3D::new_with_m(
                                2,
                                3,
                                4,
                                MValue::from([("a".into(), 7_u32.into())])
                            ),
                            Point3D::new_with_m(
                                -2,
                                -3,
                                -4,
                                MValue::from([("a".into(), 8_u32.into())])
                            )
                        ]
                    )
                ]],
                properties: Properties::from([("foo".into(), "bar".into())]),
                bbox: Some(BBox3D::new(0.0, 1.0, 2.0, 3.0, -1., 1.)),
                tessellation: vec![Point3D::new(-1, -2, -3), Point3D::new(1, 2, 3)],
                indices: vec![1, 0],
            })
        );
    }

    #[test]
    fn test_multipolygon_vector_feature_to_base_vector_feature() {
        let vf: VectorFeature<(), Properties, MValue> = VectorFeature {
            id: Some(3),
            properties: Properties::from([("foo".into(), "bar".into())]),
            geometry: VectorGeometry::MultiPolygon(VectorMultiPolygonGeometry {
                coordinates: vec![vec![
                    vec![
                        VectorPoint::new_xy(
                            1.1,
                            1.9,
                            Some(MValue::from([("a".into(), 1_u32.into())])),
                        ),
                        VectorPoint::new_xy(
                            -1.1,
                            -1.9,
                            Some(MValue::from([("a".into(), 12_u32.into())])),
                        ),
                    ],
                    vec![
                        VectorPoint::new_xy(
                            2.1,
                            2.9,
                            Some(MValue::from([("a".into(), 7_u32.into())])),
                        ),
                        VectorPoint::new_xy(
                            -2.1,
                            -2.9,
                            Some(MValue::from([("a".into(), 8_u32.into())])),
                        ),
                    ],
                ]],
                bbox: Some(BBox3D::new(0.0, 1.0, 2.0, 3.0, -1.0, 1.0)),
                offset: Some(vec![vec![2.2, 7.2]]),
                tessellation: Some(vec![-1.1, -2.2, 1.1, 2.2]),
                indices: Some(vec![1, 0]),
                ..Default::default()
            }),
            ..Default::default()
        };

        let bvf: BaseVectorFeature = (&vf).into();

        assert_eq!(
            bvf,
            BaseVectorFeature::BaseVectorPolysFeature(BaseVectorPolysFeature {
                id: Some(3),
                geometry: vec![vec![
                    VectorLineWithOffset::new(
                        2.2,
                        vec![
                            Point::new_with_m(1, 2, MValue::from([("a".into(), 1_u32.into())])),
                            Point::new_with_m(-1, -2, MValue::from([("a".into(), 12_u32.into())]))
                        ]
                    ),
                    VectorLineWithOffset::new(
                        7.2,
                        vec![
                            Point::new_with_m(2, 3, MValue::from([("a".into(), 7_u32.into())])),
                            Point::new_with_m(-2, -3, MValue::from([("a".into(), 8_u32.into())]))
                        ]
                    )
                ]],
                properties: Properties::from([("foo".into(), "bar".into())]),
                bbox: Some(BBox::new(0.0, 1.0, 2.0, 3.0)),
                tessellation: vec![Point::new(-1, -2), Point::new(1, 2)],
                indices: vec![1, 0],
            })
        );

        let vf: VectorFeature<(), Properties, MValue> = VectorFeature {
            id: Some(3),
            properties: Properties::from([("foo".into(), "bar".into())]),
            geometry: VectorGeometry::MultiPolygon(VectorMultiPolygonGeometry {
                coordinates: vec![vec![
                    vec![
                        VectorPoint::new_xyz(
                            1.1,
                            1.9,
                            3.3,
                            Some(MValue::from([("a".into(), 1_u32.into())])),
                        ),
                        VectorPoint::new_xyz(
                            -1.1,
                            -1.9,
                            -3.3,
                            Some(MValue::from([("a".into(), 12_u32.into())])),
                        ),
                    ],
                    vec![
                        VectorPoint::new_xyz(
                            2.1,
                            2.9,
                            4.4,
                            Some(MValue::from([("a".into(), 7_u32.into())])),
                        ),
                        VectorPoint::new_xyz(
                            -2.1,
                            -2.9,
                            -4.4,
                            Some(MValue::from([("a".into(), 8_u32.into())])),
                        ),
                    ],
                ]],
                is_3d: true,
                bbox: Some(BBox3D::new(0.0, 1.0, 2.0, 3.0, -1.0, 1.0)),
                offset: Some(vec![vec![2.2, 7.2]]),
                tessellation: Some(vec![-1.1, -2.2, -3.3, 1.1, 2.2, 3.3]),
                indices: Some(vec![1, 0]),
                ..Default::default()
            }),
            ..Default::default()
        };

        let bvf: BaseVectorFeature = (&vf).into();

        assert_eq!(
            bvf,
            BaseVectorFeature::BaseVectorPolys3DFeature(BaseVectorPolys3DFeature {
                id: Some(3),
                geometry: vec![vec![
                    VectorLine3DWithOffset::new(
                        2.2,
                        vec![
                            Point3D::new_with_m(
                                1,
                                2,
                                3,
                                MValue::from([("a".into(), 1_u32.into())])
                            ),
                            Point3D::new_with_m(
                                -1,
                                -2,
                                -3,
                                MValue::from([("a".into(), 12_u32.into())])
                            )
                        ]
                    ),
                    VectorLine3DWithOffset::new(
                        7.2,
                        vec![
                            Point3D::new_with_m(
                                2,
                                3,
                                4,
                                MValue::from([("a".into(), 7_u32.into())])
                            ),
                            Point3D::new_with_m(
                                -2,
                                -3,
                                -4,
                                MValue::from([("a".into(), 8_u32.into())])
                            )
                        ]
                    )
                ]],
                properties: Properties::from([("foo".into(), "bar".into())]),
                bbox: Some(BBox3D::new(0.0, 1.0, 2.0, 3.0, -1., 1.)),
                tessellation: vec![Point3D::new(-1, -2, -3), Point3D::new(1, 2, 3)],
                indices: vec![1, 0],
            })
        );
    }
}
