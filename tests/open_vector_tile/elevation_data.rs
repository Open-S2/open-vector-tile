#[cfg(test)]
mod tests {
    extern crate alloc;
    use open_vector_tile::open::{
        Extent, GridData, convert_mapbox_elevation_data, convert_terrarium_elevation_data,
    };
    use pbf::Protobuf;

    #[test]
    fn test_convert_mapbox_elevation_data() {
        assert_eq!(convert_mapbox_elevation_data(0, 0, 0), -10000.0);
        assert_eq!(convert_mapbox_elevation_data(255, 255, 255), 1667721.5);
        assert_eq!(convert_mapbox_elevation_data(0, 0, 255), -9974.5);
        assert_eq!(convert_mapbox_elevation_data(255, 0, 0), 1661168.0);
        assert_eq!(convert_mapbox_elevation_data(0, 255, 0), -3472.0);
    }

    #[test]
    fn test_convert_terrarium_elevation_data() {
        assert_eq!(convert_terrarium_elevation_data(0, 0, 0), -32768.0);
        assert_eq!(convert_terrarium_elevation_data(255, 255, 255), 32767.99609375);
        assert_eq!(convert_terrarium_elevation_data(0, 0, 255), -32767.00390625);
        assert_eq!(convert_terrarium_elevation_data(255, 0, 0), 32512.0);
        assert_eq!(convert_terrarium_elevation_data(0, 255, 0), -32513.0);
    }

    #[test]
    fn test_protobuf() {
        let elevation = GridData::new(
            "elevation".to_owned(),
            8_192.into(),
            512.0,
            0.0,
            0.0,
            vec![-1.0, 2.0, 3.0, 4.0],
        );
        let mut pb = Protobuf::new();
        pb.write_message(1, &elevation);

        let bytes = pb.take();

        let mut pb = Protobuf::from(bytes);
        let _message_id = pb.read_field();
        let mut elevation_res = GridData::default();
        pb.read_message(&mut elevation_res);

        assert_eq!(elevation_res.name, "elevation");
        assert_eq!(elevation_res.extent, Extent::Extent8192);
        assert_eq!(elevation_res.size, 512.0);
        assert_eq!(elevation_res.min, -1.0);
        assert_eq!(elevation_res.max, 4.0);
        assert_eq!(elevation_res.data, vec![-1.0, 1.9998779296875, 3.000244140625, 4.0]);
    }
}
