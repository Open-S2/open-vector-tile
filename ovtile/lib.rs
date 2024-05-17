#![no_std]
// #![deny(missing_docs)]
//! The `ovtile` Rust crate provides functionalities to read and write Open Vector Tile Spec messages.
//! This crate is a 0 dependency package that uses `no_std` and is intended to be used in
//! embedded systems and WASM applications.

/// The Value enum emulates JSON like syntax
pub mod value;

/// Add two usize numbers into one
pub fn add(left: usize, right: usize) -> usize {
    left + right
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn it_works() {
        let result = add(1, 2);
        let result2 = add(1, 1);

        assert_eq!(result, 3);
        assert_eq!(result2, 2);
    }
}
