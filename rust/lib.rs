// #![no_std]
#![deny(missing_docs)]
#![feature(stmt_expr_attributes)]
#![feature(register_tool)]
#![register_tool(tarpaulin)]
//! The `open-vector-tile` Rust crate provides functionalities to read and write
//! Open Vector Tile Spec messages. This crate uses `no_std` and is intended to be available for
//! embedded systems and WASM applications.

extern crate alloc;
extern crate pbf;

/// Base Vector containers for Tiles, Layers, and Features
pub mod base;
/// Geometry utilities
pub mod geometry;
/// Mapbox specification for Layers and Features
pub mod mapbox;
/// Open specification for Layers and Features
pub mod open;
/// Utilities/functions that are useful across all specifications
pub mod util;
/// The vector tile struct that covers both "open" and "mapbox" specifications
pub mod vector_tile;

pub use geometry::*;
pub use util::*;
pub use vector_tile::*;
