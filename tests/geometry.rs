#[cfg(test)]
mod tests {
    extern crate alloc;

    use alloc::collections::BTreeMap;
    use core::cmp::Ordering;

    use ovtile::geometry::{BBox, BBox3D, Point, Point3D, VectorLineWithOffset, BBOX};
    use ovtile::open::Value;

    #[test]
    fn test_bounding_box() {
        let bbox = BBox {
            left: 0.0,
            bottom: 0.0,
            right: 1.0,
            top: 1.0,
        };
        assert_eq!(bbox, BBox { ..bbox });
        let bbox_3d = BBox3D {
            left: 0.0,
            bottom: 0.0,
            right: 1.0,
            top: 1.0,
            far: 0.0,
            near: 0.0,
        };
        assert_eq!(bbox_3d, BBox3D { ..bbox_3d });

        let bbox_cont = BBOX::BBox(bbox);
        let bbox_3d_cont = BBOX::BBox3D(bbox_3d);

        assert_eq!(bbox_cont.cmp(&bbox_3d_cont), Ordering::Less);
        assert_eq!(bbox_cont.partial_cmp(&bbox_3d_cont), Some(Ordering::Less));
        assert_eq!(bbox_3d_cont.cmp(&bbox_cont), Ordering::Greater);
        assert_eq!(
            bbox_3d_cont.partial_cmp(&bbox_cont),
            Some(Ordering::Greater)
        );
        assert_eq!(
            bbox_cont.cmp(&BBOX::BBox(BBox {
                left: 0.1,
                bottom: 0.1,
                right: 1.0,
                top: 1.0,
            })),
            Ordering::Less
        );
        assert_eq!(
            bbox_3d_cont.cmp(&BBOX::BBox3D(BBox3D {
                left: 0.1,
                bottom: 0.1,
                right: 1.0,
                top: 1.0,
                far: 0.0,
                near: 0.0,
            })),
            Ordering::Less
        );
    }

    #[test]
    fn test_points() {
        let point_a = Point {
            x: 0,
            y: 0,
            m: None,
        };
        let point_b = Point::new(0, 0);
        let point_c = Point::new_with_m(1, 1, Value(BTreeMap::new()));

        assert_eq!(point_a.cmp(&point_b), Ordering::Equal);
        assert_eq!(point_a.partial_cmp(&point_b), Some(Ordering::Equal));
        assert_eq!(point_b.cmp(&point_c), Ordering::Less);
        assert_eq!(point_b.partial_cmp(&point_c), Some(Ordering::Less));

        // 3D (repeat the 2D with 3D values)
        let point_3d_a = Point3D {
            x: 0,
            y: 0,
            z: 0,
            m: None,
        };
        let point_3d_b = Point3D::new(0, 0, 0);
        let point_3d_c = Point3D::new_with_m(1, 1, 1, Value(BTreeMap::new()));

        assert_eq!(point_3d_a.cmp(&point_3d_b), Ordering::Equal);
        assert_eq!(point_3d_a.partial_cmp(&point_3d_b), Some(Ordering::Equal));
        assert_eq!(point_3d_b.cmp(&point_3d_c), Ordering::Less);
        assert_eq!(point_3d_b.partial_cmp(&point_3d_c), Some(Ordering::Less));
    }

    #[test]
    fn test_vector_line_with_offset() {
        let line = vec![Point::new(0, 0), Point::new(1, 1)];
        let line_with_offset: VectorLineWithOffset = (&line[..]).into();

        assert_eq!(line_with_offset, VectorLineWithOffset::new(0.0, line));
    }
}
