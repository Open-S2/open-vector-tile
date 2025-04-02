#[cfg(test)]
mod tests {
    extern crate alloc;
    use open_vector_tile::open::OColumnName;

    #[test]
    fn test_column_name() {
        assert_eq!(OColumnName::String, 1_u64.into());
        assert_eq!(OColumnName::Unsigned, 2_u64.into());
        assert_eq!(OColumnName::Signed, 3_u64.into());
        assert_eq!(OColumnName::Float, 4_u64.into());
        assert_eq!(OColumnName::Double, 5_u64.into());
        assert_eq!(OColumnName::Points, 6_u64.into());
        assert_eq!(OColumnName::Points3D, 7_u64.into());
        assert_eq!(OColumnName::Indices, 8_u64.into());
        assert_eq!(OColumnName::Shapes, 9_u64.into());
        assert_eq!(OColumnName::BBox, 10_u64.into());
        assert_eq!(OColumnName::String, 11_u64.into());

        assert_eq!(OColumnName::from(1), OColumnName::String);
        assert_eq!(OColumnName::from(2), OColumnName::Unsigned);
        assert_eq!(OColumnName::from(3), OColumnName::Signed);
        assert_eq!(OColumnName::from(4), OColumnName::Float);
        assert_eq!(OColumnName::from(5), OColumnName::Double);
        assert_eq!(OColumnName::from(6), OColumnName::Points);
        assert_eq!(OColumnName::from(7), OColumnName::Points3D);
        assert_eq!(OColumnName::from(8), OColumnName::Indices);
        assert_eq!(OColumnName::from(9), OColumnName::Shapes);
        assert_eq!(OColumnName::from(10), OColumnName::BBox);
        assert_eq!(OColumnName::from(11), OColumnName::String);
    }
}
