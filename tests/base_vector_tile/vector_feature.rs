#[cfg(test)]
mod tests {
    extern crate alloc;
    use ovtile::{
        Point,
        BBox,
        VectorGeometry,
        base::{
            BaseVectorPointsFeature,
            // BaseVectorLinesFeature,
            VectorFeature,
            encode_offset,
            decode_offset,
        },
        open::{
            Properties,
            FeatureType,
            ColumnCacheWriter,
            ColumnCacheReader,
        },
    };

    use pbf::Protobuf;

    use alloc::vec;
    use alloc::rc::Rc;
    use core::cell::RefCell;

    #[test]
    fn test_base_vector_points_feature() {
        let feature = BaseVectorPointsFeature {
            id: Some(1),
            geometry: vec![Point::new(0, 0)],
            properties: Properties::default(),
            bbox: Some(BBox { left: 0.0, bottom: 0.0, right: 1.0, top: 1.0 }),
        };
        let feature2 = BaseVectorPointsFeature::new(
            None,
            vec![Point::new(0, 0), Point::new(1, 1)],
            Properties::default(),
            None,
        );

        // get_type
        assert_eq!(feature.get_type(), FeatureType::Points);
        assert_eq!(feature2.get_type(), FeatureType::Points);

        // get_properties
        assert_eq!(feature.get_properties(), &Properties::default());

        // has_bbox
        assert!(feature.has_bbox());

        // has_offsets
        assert!(!feature.has_offsets());

        // has_m_values
        assert!(!feature.has_m_values());

        // load_geometry
        assert_eq!(feature.load_geometry(), VectorGeometry::VectorPoints(vec![Point::new(0, 0)]));

        // get_m_values
        assert!(feature.get_m_values().is_none());

        // TODO: encode_to_cache

        // TODO: wrap in BaseVectorFeature and test all functions
        let mut col = ColumnCacheWriter::default();
        feature.encode_to_cache(&mut col, &None);

        // store the column in a pbf
        let mut pbf = Protobuf::new();
        pbf.write_message(0, &col);
        let raw_data = pbf.take();

        // Now we decode the column
        let pbf_read: Rc<RefCell<Protobuf>> = Rc::new(RefCell::new(raw_data.into()));
        let _field = pbf_read.borrow_mut().read_field();
        let end = pbf_read.borrow_mut().read_varint();
        let mut reader = ColumnCacheReader::new(pbf_read, end);
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
