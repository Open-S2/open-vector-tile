#[cfg(test)]
mod tests {
    extern crate alloc;
    use open_vector_tile::open::{ImageData, ImageType};
    use pbf::Protobuf;
    use std::panic::{self, AssertUnwindSafe};

    #[test]
    fn test_image_type() {
        // test from string
        assert_eq!(ImageType::PNG, "png".into());
        assert_eq!(ImageType::JPG, "jpg".into());
        assert_eq!(ImageType::WEBP, "webp".into());
        assert_eq!(ImageType::GIF, "gif".into());
        assert_eq!(ImageType::AVIF, "avif".into());
        assert_eq!(ImageType::SVG, "svg".into());
        assert_eq!(ImageType::BMP, "bmp".into());
        assert_eq!(ImageType::RAW, "raw".into());
        assert_eq!(ImageType::UNKNOWN, "unknown".into());

        // test to string
        assert_eq!(ImageType::PNG.to_string(), "PNG");
        assert_eq!(ImageType::JPG.to_string(), "JPG");
        assert_eq!(ImageType::WEBP.to_string(), "WEBP");
        assert_eq!(ImageType::GIF.to_string(), "GIF");
        assert_eq!(ImageType::AVIF.to_string(), "AVIF");
        assert_eq!(ImageType::SVG.to_string(), "SVG");
        assert_eq!(ImageType::BMP.to_string(), "BMP");
        assert_eq!(ImageType::RAW.to_string(), "RAW");
        assert_eq!(ImageType::UNKNOWN.to_string(), "UNKNOWN");
    }

    #[test]
    fn test_protobuf() {
        let image =
            ImageData::new("test".to_string(), ImageType::AVIF, 222, 333, Vec::from([1, 2, 3, 4]));
        let mut pb = Protobuf::new();
        pb.write_message(1, &image);

        let bytes = pb.take();

        let mut pb = Protobuf::from(bytes);
        let _message_id = pb.read_field();
        let mut image_res = ImageData::default();
        pb.read_message(&mut image_res);

        assert_eq!(image_res, image)
    }

    #[test]
    fn test_image_type_proto() {
        let mut pb = Protobuf::new();

        pb.write_varint(ImageType::PNG);
        pb.write_varint(ImageType::JPG);
        pb.write_varint(ImageType::WEBP);
        pb.write_varint(ImageType::GIF);
        pb.write_varint(ImageType::AVIF);
        pb.write_varint(ImageType::SVG);
        pb.write_varint(ImageType::BMP);
        pb.write_varint(ImageType::RAW);
        pb.write_varint(ImageType::UNKNOWN);
        pb.write_varint(20);

        let bytes = pb.take();

        let mut pb = Protobuf::from(bytes);
        assert_eq!(pb.read_varint::<ImageType>(), ImageType::PNG);
        assert_eq!(pb.read_varint::<ImageType>(), ImageType::JPG);
        assert_eq!(pb.read_varint::<ImageType>(), ImageType::WEBP);
        assert_eq!(pb.read_varint::<ImageType>(), ImageType::GIF);
        assert_eq!(pb.read_varint::<ImageType>(), ImageType::AVIF);
        assert_eq!(pb.read_varint::<ImageType>(), ImageType::SVG);
        assert_eq!(pb.read_varint::<ImageType>(), ImageType::BMP);
        assert_eq!(pb.read_varint::<ImageType>(), ImageType::RAW);
        assert_eq!(pb.read_varint::<ImageType>(), ImageType::UNKNOWN);

        let result = panic::catch_unwind(AssertUnwindSafe(|| pb.read_varint::<ImageType>()));
        assert!(result.is_err());
    }
}
