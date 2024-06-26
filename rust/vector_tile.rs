extern crate alloc;

use alloc::vec::Vec;

/// A BBOX is defined in lon-lat space and helps with zooming motion to
/// see the entire line or polygon
/// [left: number, bottom: number, right: number, top: number]
pub struct BBox {
    pub left: f64,
    pub bottom: f64,
    pub right: f64,
    pub top: f64,
}
/// A BBOX is defined in lon-lat space and helps with zooming motion to
/// see the entire 3D line or polygon
pub struct BBox3D {
  left: f64,
  bottom: f64,
  right: f64,
  top: f64,
  near: f64,
  far: f64,
}

/// Mapbox Vector Feature types.
pub enum VectorFeatureType {
    Point = 1,
    Line = 2,
    Polygon = 3,
    MultiPolygon = 4,
}

/// Open Vector Tile Feature types.
pub enum VectorTileFeatureType {
    Points = 1,
    Lines = 2,
    Polygons = 3,
    Points3D = 4,
    Lines3D = 5,
    Polygons3D = 6,
}

/// Open Vector Spec can be an x,y but also may contain an MValue if the
/// geometry is a line or polygon
pub struct Point {
  pub x: u32,
  pub y: u32,
  pub m: Option<Properties>,
}
/// Open Vector Spec can be an x,y,z but also may contain an MValue
/// if the geometry is a line or polygon
pub struct Point3D {
  pub x: u32,
  pub y: u32,
  pub z: u32,
  pub m: Option<Properties>,
}

/// Built array line data with associated offset to help render dashed lines across tiles.
pub struct VectorLineWithOffset {
    /// the offset of the line to start processing the dash position
    pub offset: f32,
    /// the line data
    pub geometry: VectorLine,
}
/// Built array line data with associated offset to help render dashed lines across tiles.
pub type VectorLinesWithOffset = Vec<VectorLineWithOffset>;
/// Built array line data with associated offset to help render dashed lines across tiles.
pub struct VectorLine3DWithOffset {
    /// the offset of the line to start processing the dash position
    pub offset: f32,
    /// the line data
    pub geometry: VectorLine3D,
}
/// Built array line data with associated offset to help render dashed lines across tiles.
pub type VectorLines3DWithOffset = Vec<VectorLine3DWithOffset>;

/// A set of points
pub type VectorPoints = Vec<Point>;
/// A set of 3D points
pub type VectorPoints3D = Vec<Point3D>;
/// A set of points
pub type VectorLine = Vec<Point>;
/// A set of 3D points
pub type VectorLine3D = Vec<Point3D>;
/// A set of lines
pub type VectorLines = Vec<VectorLine>;
/// A set of 3D lines
pub type VectorLines3D = Vec<VectorLine3D>;
/// A set of polygons
pub type VectorPoly = Vec<VectorLine>;
/// A set of 3D polygons
pub type VectorPoly3D = Vec<VectorLine3D>;
/// A set of multiple polygons
pub type VectorMultiPoly = Vec<VectorPoly>;
/// A set of multiple 3D polygons
pub type VectorMultiPoly3D = Vec<VectorPoly3D>;
/// An enumeration of all the geometry types
pub enum VectorGeometry {
    VectorPoints(VectorPoints),
    VectorLines(VectorLines),
    VectorPoly(VectorPoly),
    VectorMultiPoly(VectorMultiPoly),
    VectorPoints3D(VectorPoints3D),
    VectorLines3D(VectorLines3D),
    VectorPoly3D(VectorPoly3D),
    VectorMultiPoly3D(VectorMultiPoly3D),
}
