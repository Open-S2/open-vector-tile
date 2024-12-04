#[cfg(test)]
mod tests {
    extern crate alloc;

    use ovtile::util::{
        command_decode, command_encode, delta_decode_array, delta_decode_sorted_array,
        delta_encode_array, delta_encode_sorted_array, dequantize_lat, dequantize_lon,
        pack24_bit_uint, pack_float, quantize_lat, quantize_lon, unpack24_bit_uint, unpack_float,
        unweave_2d, unweave_3d, unweave_and_delta_decode_3d_array, unweave_and_delta_decode_array,
        weave_2d, weave_3d, weave_and_delta_encode_3d_array, weave_and_delta_encode_array, zagzig,
        zigzag, Command,
    };
    use ovtile::{BBox, BBox3D, Point, Point3D, BBOX};

    #[test]
    fn test_command_encode() {
        let encode = command_encode(0, 0);
        assert_eq!(encode, 0);
        let decode = command_decode(encode);
        assert_eq!(decode, Command { cmd: 0, len: 0 });

        let encode = command_encode(4, 10);
        assert_eq!(encode, 84);
        let decode = command_decode(encode);
        assert_eq!(decode, Command { cmd: 4, len: 10 });

        let encode = command_encode(4, 1);
        assert_eq!(encode, 12);
        let decode = command_decode(encode);
        assert_eq!(decode, Command { cmd: 4, len: 1 });
    }

    #[test]
    fn test_zigzag() {
        assert_eq!(zagzig(zigzag(0)), 0);
        assert_eq!(zagzig(zigzag(1)), 1);
        assert_eq!(zagzig(zigzag(-1)), -1);
        assert_eq!(zagzig(zigzag(2)), 2);
        assert_eq!(zagzig(zigzag(-2)), -2);
    }

    #[test]
    fn test_delta_encode_decode_array() {
        let array = vec![0, 7, 2, 9, 4, 5, 3, 1, 8, 6];
        let encoded = delta_encode_array(&array);
        assert_eq!(encoded, vec![0, 14, 9, 14, 9, 2, 3, 3, 14, 3]);
        let decoded = delta_decode_array(&encoded);
        assert_eq!(array, decoded);
    }

    #[test]
    fn test_delta_encode_decode_array_sorted() {
        let array = vec![0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        let encoded = delta_encode_sorted_array(&array);
        let decoded = delta_decode_sorted_array(&encoded);
        assert_eq!(array, decoded);
    }

    #[test]
    fn test_quantize_dequantize_lon_lat() {
        assert_eq!(dequantize_lat(quantize_lat(0.0)), -5.364418356634815e-6);
        assert_eq!(dequantize_lon(quantize_lon(0.0)), 1.072883671326963e-5);
        assert_eq!(dequantize_lat(quantize_lat(1.0)), 0.9999973177908288);
        assert_eq!(dequantize_lon(quantize_lon(1.0)), 1.0000026822091854);
        assert_eq!(dequantize_lat(quantize_lat(-1.0)), -1.0000080466275278);
        assert_eq!(dequantize_lon(quantize_lon(-1.0)), -1.0000026822091854);
        assert_eq!(dequantize_lat(quantize_lat(90.0)), 90.0);
        assert_eq!(dequantize_lon(quantize_lon(180.0)), 180.0);
        assert_eq!(dequantize_lat(quantize_lat(-90.0)), -90.0);
        assert_eq!(dequantize_lon(quantize_lon(-180.0)), -180.0);
    }

    #[test]
    fn test_pack_unpack_float() {
        let mut tmp_buf = alloc::vec![0u8; 8];
        pack_float(&mut tmp_buf, 0.0, 0);
        assert_eq!(unpack_float(&tmp_buf, 0), 0.0);
        pack_float(&mut tmp_buf, 1.0, 2);
        assert_eq!(unpack_float(&tmp_buf, 2), 1.0);
        pack_float(&mut tmp_buf, -1.0, 4);
        assert_eq!(unpack_float(&tmp_buf, 4), -1.0);
    }

    #[test]
    fn test_pack24_unpack24_bit_uint() {
        let mut tmp_buf = alloc::vec![0u8; 12];
        pack24_bit_uint(&mut tmp_buf, 0, 0);
        assert_eq!(unpack24_bit_uint(&tmp_buf, 0), 0);
        pack24_bit_uint(&mut tmp_buf, 1, 2);
        assert_eq!(unpack24_bit_uint(&tmp_buf, 2), 1);
        pack24_bit_uint(&mut tmp_buf, 0x7fffff, 4);
        assert_eq!(unpack24_bit_uint(&tmp_buf, 4), 0x7fffff);
        pack24_bit_uint(&mut tmp_buf, 0x800000, 6);
        assert_eq!(unpack24_bit_uint(&tmp_buf, 6), 0x800000);
        pack24_bit_uint(&mut tmp_buf, 0xffffff, 8);
        assert_eq!(unpack24_bit_uint(&tmp_buf, 8), 0xffffff);
    }

    #[test]
    fn test_weave_unweave_2d() {
        assert_eq!(unweave_2d(weave_2d(0, 0)), (0, 0));
        assert_eq!(unweave_2d(weave_2d(1, 0)), (1, 0));
        assert_eq!(unweave_2d(weave_2d(0, 1)), (0, 1));
        assert_eq!(unweave_2d(weave_2d(2_121, 612)), (2_121, 612));
    }

    #[test]
    fn test_weave_unweave_3d() {
        assert_eq!(unweave_3d(weave_3d(0, 0, 0)), (0, 0, 0));
        assert_eq!(unweave_3d(weave_3d(1, 0, 0)), (1, 0, 0));
        assert_eq!(unweave_3d(weave_3d(0, 1, 0)), (0, 1, 0));
        assert_eq!(unweave_3d(weave_3d(0, 0, 1)), (0, 0, 1));
        assert_eq!(unweave_3d(weave_3d(2_121, 612, 0)), (2_121, 612, 0));
        assert_eq!(unweave_3d(weave_3d(0, 0, 2_121)), (0, 0, 2_121));
    }

    #[test]
    fn test_weave_and_delta_encode_array() {
        assert_eq!(
            unweave_and_delta_decode_array(&weave_and_delta_encode_array(&[
                Point::new(0, 0),
                Point::new(1, 0),
                Point::new(0, 1),
                Point::new(0, 0)
            ])),
            vec![Point::new(0, 0), Point::new(1, 0), Point::new(0, 1), Point::new(0, 0),]
        )
    }

    #[test]
    fn test_weave_and_delta_encode_3d_array() {
        assert_eq!(
            unweave_and_delta_decode_3d_array(&weave_and_delta_encode_3d_array(&[
                Point3D::new(0, 0, 0),
                Point3D::new(1, 0, 0),
                Point3D::new(0, 1, 0),
                Point3D::new(0, 0, 1),
            ])),
            vec![
                Point3D::new(0, 0, 0),
                Point3D::new(1, 0, 0),
                Point3D::new(0, 1, 0),
                Point3D::new(0, 0, 1),
            ]
        )
    }

    #[test]
    fn test_quantize_dequantize_bbox() {
        let bbox = BBox { left: -0.5, bottom: -162.2, right: 122.8, top: 77.4 };
        let bbox_2 = BBOX::BBox(bbox);

        let quantized = bbox.quantize();
        let dquantized = BBox::dequantize(&quantized);
        assert_eq!(
            dquantized,
            BBox {
                left: -0.4999959766862503,
                bottom: 17.800014483929544,
                right: 122.80000107288367,
                top: 77.39998980760512
            }
        );

        let quantized_2 = bbox_2.quantize();
        let dquantized_2 = BBOX::dequantize(&quantized_2);
        assert_eq!(
            dquantized_2,
            BBOX::BBox(BBox {
                left: -0.4999959766862503,
                bottom: 17.800014483929544,
                right: 122.80000107288367,
                top: 77.39998980760512
            })
        );
    }

    #[test]
    fn test_quantize_dequantize_bbox_3d() {
        let bbox =
            BBox3D { left: -0.5, bottom: -162.2, right: 122.8, top: 77.4, near: -1.3, far: 100.2 };
        let bbox_2 = BBOX::BBox3D(bbox);

        let quantized = bbox.quantize();
        let dquantized = BBox3D::dequantize(&quantized);
        assert_eq!(
            dquantized,
            BBox3D {
                left: -0.4999959766862503,
                bottom: 17.800014483929544,
                right: 122.80000107288367,
                top: 77.39998980760512,
                far: 100.19999694824219,
                near: -1.2999999523162842
            }
        );

        let quantized_2 = bbox_2.quantize();
        assert_eq!(quantized_2.len(), 20);
        let dquantized_2 = BBOX::dequantize(&quantized_2);
        assert_eq!(
            dquantized_2,
            BBOX::BBox3D(BBox3D {
                left: -0.4999959766862503,
                bottom: 17.800014483929544,
                right: 122.80000107288367,
                top: 77.39998980760512,
                far: 100.19999694824219,
                near: -1.2999999523162842
            })
        );
    }
}
