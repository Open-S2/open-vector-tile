#[cfg(test)]
mod tests {
    extern crate alloc;

    use ovtile::mapbox::FeatureType as MapboxFeatureType;
    use ovtile::open::{Extent, FeatureType};

    use pbf::Protobuf;

    #[test]
    fn test_extent() {
        assert_eq!(Extent::Extent512, Extent::from(512));
        assert_eq!(Extent::Extent1024, Extent::from(1024));
        assert_eq!(Extent::Extent2048, Extent::from(2048));
        assert_eq!(Extent::Extent4096, Extent::from(4096));
        assert_eq!(Extent::Extent8192, Extent::from(8192));
        assert_eq!(Extent::Extent16384, Extent::from(16_384));
        assert_eq!(Extent::from(1_usize), Extent::Extent512);

        assert_eq!(512, Extent::Extent512 as usize);
        assert_eq!(1024, Extent::Extent1024 as usize);
        assert_eq!(2048, Extent::Extent2048 as usize);
        assert_eq!(4096, Extent::Extent4096 as usize);
        assert_eq!(8192, Extent::Extent8192 as usize);
        assert_eq!(16_384, Extent::Extent16384 as usize);

        assert_eq!(f64::from(Extent::Extent512), 512.0);
        assert_eq!(f64::from(Extent::Extent1024), 1024.0);
        assert_eq!(f64::from(Extent::Extent2048), 2048.0);
        assert_eq!(f64::from(Extent::Extent4096), 4096.0);
        assert_eq!(f64::from(Extent::Extent8192), 8192.0);
        assert_eq!(f64::from(Extent::Extent16384), 16_384.0);

        let mut pb = Protobuf::new();
        pb.write_varint(Extent::Extent512);
        pb.write_varint(Extent::Extent1024);
        pb.write_varint(Extent::Extent2048);
        pb.write_varint(Extent::Extent4096);
        pb.write_varint(Extent::Extent8192);
        pb.write_varint(Extent::Extent16384);
        pb.write_varint(100000);

        pb.set_pos(0);

        assert_eq!(pb.read_varint::<Extent>(), Extent::Extent512);
        assert_eq!(pb.read_varint::<Extent>(), Extent::Extent1024);
        assert_eq!(pb.read_varint::<Extent>(), Extent::Extent2048);
        assert_eq!(pb.read_varint::<Extent>(), Extent::Extent4096);
        assert_eq!(pb.read_varint::<Extent>(), Extent::Extent8192);
        assert_eq!(pb.read_varint::<Extent>(), Extent::Extent16384);
        assert_eq!(pb.read_varint::<Extent>(), Extent::Extent512);
    }

    #[test]
    #[should_panic(expected = "unknown value: 7")]
    fn test_feature_type() {
        let mut pb = Protobuf::new();
        pb.write_varint(7);
        pb.set_pos(0);
        pb.read_varint::<FeatureType>();
    }

    #[test]
    fn test_mapbox_feature_type() {
        // MapboxFeatureType::Polygon => FeatureType::Polygons,
        assert_eq!(FeatureType::Polygons, (&MapboxFeatureType::Polygon).into());
    }
}
