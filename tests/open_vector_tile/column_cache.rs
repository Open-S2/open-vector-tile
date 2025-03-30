#[cfg(test)]
mod tests {
    extern crate alloc;
    use open_vector_tile::open::OColumnName;

    #[test]
    fn test_column_name() {
        assert_eq!(OColumnName::String, 0_u8.into());
        assert_eq!(OColumnName::Unsigned, 1_u8.into());
        assert_eq!(OColumnName::Signed, 2_u8.into());
        assert_eq!(OColumnName::Float, 3_u8.into());
        assert_eq!(OColumnName::Double, 4_u8.into());
        assert_eq!(OColumnName::Points, 5_u8.into());
        assert_eq!(OColumnName::Points3D, 6_u8.into());
        assert_eq!(OColumnName::Indices, 7_u8.into());
        assert_eq!(OColumnName::Shapes, 8_u8.into());
        assert_eq!(OColumnName::BBox, 9_u8.into());
        assert_eq!(OColumnName::String, 10_u8.into());

        assert_eq!(OColumnName::from(0), OColumnName::String);
        assert_eq!(OColumnName::from(1), OColumnName::Unsigned);
        assert_eq!(OColumnName::from(2), OColumnName::Signed);
        assert_eq!(OColumnName::from(3), OColumnName::Float);
        assert_eq!(OColumnName::from(4), OColumnName::Double);
        assert_eq!(OColumnName::from(5), OColumnName::Points);
        assert_eq!(OColumnName::from(6), OColumnName::Points3D);
        assert_eq!(OColumnName::from(7), OColumnName::Indices);
        assert_eq!(OColumnName::from(8), OColumnName::Shapes);
        assert_eq!(OColumnName::from(9), OColumnName::BBox);
        assert_eq!(OColumnName::from(10), OColumnName::String);
    }
}
