#![no_std]
// #![deny(missing_docs)]
//! The `open-vector-tile` Rust crate provides functionalities to read and write
//! Open Vector Tile Spec messages. This crate uses `no_std` and is intended to be used in
//! embedded systems and WASM applications.

extern crate alloc;
extern crate num_traits;
extern crate pbf;

pub mod base;
pub mod mapbox;
pub mod open;
pub mod geometry;
pub mod util;
pub mod vector_tile;

pub use geometry::*;
pub use vector_tile::*;
