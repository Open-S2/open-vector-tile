/// Taking s2json type geometry and creating base features
pub mod s2json_impl;
/// Base Features covering 2D and 3D for points, lines, and polygons
pub mod vector_feature;
///  A base layer for all vector features
pub mod vector_layer;
/// A Tile container for all base vector layers
pub mod vector_tile;

pub use s2json_impl::*;
pub use vector_feature::*;
pub use vector_layer::*;
pub use vector_tile::*;
