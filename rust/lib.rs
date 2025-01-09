// #![no_std]
#![deny(missing_docs)]
#![feature(stmt_expr_attributes)]
#![feature(register_tool)]
#![register_tool(tarpaulin)]
//! # Open Vector Tile
//!
//! ## Description
//! The `open-vector-tile` Rust crate provides functionalities to read and write
//! Open Vector Tile Spec messages. This crate uses `no_std` and is intended to be available for
//! embedded systems and WASM applications.
//!
//! Types of layers include:
//! - Vector data - vector points, lines, and polygons with 3D coordinates, properties, and/or m-values
//! - Image data - raster data that is RGB(A) encoded
//! - Grid data: data that has a max-min range, works much like an image but has floating/double precision point values for each point on the grid
//!
//! ### Reading
//!
//! ```rust,ignore
//! use ovtile::{VectorTile, VectorLayerMethods};
//!
//! let data: Vec<u8> = vec![];
//! let mut tile = VectorTile::new(data, None);
//!
//! // VECTOR API
//!
//! let landuse = tile.layer("landuse").unwrap();
//!
//! // grab the first feature
//! let firstFeature = landuse.feature(0).unwrap();
//! // grab the geometry
//! let geometry = firstFeature.load_geometry();
//!
//! // OR specifically ask for a geometry type
//! let points = firstFeature.load_points();
//! let lines = firstFeature.load_lines();
//!
//! // If you want to take advantage of the pre-tessellated and indexed geometries
//! // and you're loading the data for a renderer, you can grab the pre-tessellated geometry
//! let (geometry_flat, indices) = firstFeature.load_geometry_flat();
//!
//! // IMAGE API
//!
//! let satellite = tile.images.get("satellite").unwrap();
//! // grab the image data
//! let data = &satellite.image;
//!
//! // GRID API
//!
//! let elevation = tile.grids.get("elevation").unwrap();
//! // grab the grid data
//! let data = &elevation.data;
//! ```
//!
//! ### Writing
//!
//! ```rust
//! // NOTE: Be sure to include the `serde_json` crate
//! extern crate alloc;
//! use std::collections::BTreeMap;
//! use ovtile::{
//! base::{
//!     BaseVectorFeature, BaseVectorLayer, BaseVectorLines3DFeature, BaseVectorLinesFeature,
//!     BaseVectorPoints3DFeature, BaseVectorPointsFeature, BaseVectorPolys3DFeature,
//!     BaseVectorPolysFeature, BaseVectorTile,
//! },
//! open::{
//!     Extent, FeatureType, GridData, ImageData, ImageType, PrimitiveValue, Value,
//!     ValuePrimitiveType, ValueType,
//! },
//! write_tile, BBox, BBox3D, Point, Point3D, VectorGeometry, VectorLayerMethods,
//! VectorLine3DWithOffset, VectorLineWithOffset, VectorTile, BBOX,
//! };
//!
//!
//! // WRITE VECTOR DATA //-//-//-//-//-//-//-//-//-//-//
//!
//! let mut tile = BaseVectorTile::default();
//!
//! // setup the property shapes
//!
//! let example_value_str = r#"{
//!     "a": -20,
//!     "b": 1,
//!     "c": 2.2
//! }"#;
//! let example_value = serde_json::from_str::<Value>(example_value_str).unwrap();
//! let example_value_str_2 = r#"{
//!     "a": -2,
//!     "b": 1,
//!     "c": 2.2
//! }"#;
//! let example_value2 = serde_json::from_str::<Value>(example_value_str_2).unwrap();
//!
//! let empty_value = Value(BTreeMap::from([
//!     ("a".to_string(), ValueType::Primitive(PrimitiveValue::I64(0))),
//!     ("b".to_string(), ValueType::Primitive(PrimitiveValue::U64(0))),
//!     ("c".to_string(), ValueType::Primitive(PrimitiveValue::F32(0.0))),
//! ]));
//!
//! // WRITE THE POINTS
//!
//! let mut points_layer =
//!     BaseVectorLayer::new("points".to_string(), 4096.into(), vec![], None, None);
//!
//! let feature = BaseVectorPointsFeature::new(
//!     None,
//!     vec![Point::new_with_m(0, 0, example_value2.clone())],
//!     example_value.clone(),
//!     None,
//! );
//! let feature2 = BaseVectorPointsFeature::new(
//!     Some(1),
//!     vec![Point::new_with_m(0, 0, example_value.clone()), Point::new(1, 1)],
//!     example_value2.clone(),
//!     Some(BBox::new(-1.1, 0.0, 1.0, 1.0)),
//! );
//!
//! // add_features
//! points_layer.add_feature(BaseVectorFeature::BaseVectorPointsFeature(feature));
//! points_layer.add_feature(BaseVectorFeature::BaseVectorPointsFeature(feature2));
//!
//! tile.add_layer(points_layer);
//!
//! // Lastly build the tile:
//! let open_tile_bytes = write_tile(Some(&mut tile), None, None);
//!
//!
//! // WRITE IMAGE DATA //-//-//-//-//-//-//-//-//-//-//
//!
//! let image =
//!   ImageData::new("test".to_string(), ImageType::AVIF, 2, 3, Vec::from([1, 2, 3, 10]));
//!
//! let open_tile_bytes = write_tile(None, Some(vec![&image]), None);
//!
//!
//! // WRITE GRID DATA //-//-//-//-//-//-//-//-//-//-//
//!
//! let elevation_data = GridData::new(
//!     "elevation".to_owned(),
//!     8_192.into(),
//!     512.0,
//!     0.0,
//!     0.0,
//!     vec![-1.0, 2.0, 3.0, 4.0],
//! );
//! let open_tile_bytes = write_tile(None, None, Some(vec![&elevation_data]));
//! ```

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
