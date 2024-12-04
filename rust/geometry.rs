use crate::open::{LineStringMValues, MValue};

use core::cmp::Ordering;

use alloc::vec::Vec;

/// The Bounding box, whether the tile bounds or lon-lat bounds or whatever.
#[derive(Default, Copy, Clone, Debug, PartialEq, PartialOrd, Eq)]
pub struct BBox<T = f64> {
    /// left most point; Also represents the left-most longitude
    pub left: T,
    /// bottom most point; Also represents the bottom-most latitude
    pub bottom: T,
    /// right most point; Also represents the right-most longitude
    pub right: T,
    /// top most point; Also represents the top-most latitude
    pub top: T,
}
impl<T> BBox<T> {
    /// Create a new BBox
    pub fn new(left: T, bottom: T, right: T, top: T) -> Self {
        Self { left, bottom, right, top }
    }
}

/// A BBOX is defined in lon-lat space and helps with zooming motion to
/// see the entire 3D line or polygon
#[derive(Default, Copy, Clone, Debug, PartialEq, PartialOrd, Ord, Eq)]
pub struct BBox3D<T = f64> {
    /// left most longitude (WG) or S (S2)
    pub left: T,
    /// bottom most latitude (WG) or T (S2)
    pub bottom: T,
    /// right most longitude (WG) or T (S2)
    pub right: T,
    /// top most latitude (WG) or S (S2)
    pub top: T,
    /// back most height (WG) or T (S2)
    /// generic height is relative to the surface of the earth in meters
    pub far: T,
    /// front most height (WG) or T (S2)
    /// generic height is relative to the surface of the earth in meters
    pub near: T,
}
impl<T> BBox3D<T> {
    /// Create a new BBox3D
    pub fn new(left: T, bottom: T, right: T, top: T, near: T, far: T) -> Self {
        Self { left, bottom, right, top, near, far }
    }
}

/// BBox or BBox3D
#[derive(Copy, Clone, Debug, PartialEq)]
pub enum BBOX {
    /// 2D bounding box
    BBox(BBox),
    /// 3D bounding box
    BBox3D(BBox3D),
}
impl Eq for BBOX {}
impl PartialOrd for BBOX {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}
impl Ord for BBOX {
    fn cmp(&self, other: &Self) -> Ordering {
        match (self, other) {
            (BBOX::BBox(a), BBOX::BBox(b)) => a.partial_cmp(b).unwrap_or(Ordering::Equal),
            (BBOX::BBox3D(a), BBOX::BBox3D(b)) => a.partial_cmp(b).unwrap_or(Ordering::Equal),
            // Ensure that BBox and BBox3D are ordered correctly
            (BBOX::BBox(_), BBOX::BBox3D(_)) => Ordering::Less,
            (BBOX::BBox3D(_), BBOX::BBox(_)) => Ordering::Greater,
        }
    }
}

/// Open Vector Spec can be an x,y but also may contain an MValue if the
/// geometry is a line or polygon
#[derive(Debug, Clone, PartialEq)]
pub struct Point {
    /// x value
    pub x: i32,
    /// y value
    pub y: i32,
    /// M value
    pub m: Option<MValue>,
}
impl Point {
    /// Create a new point
    pub fn new(x: i32, y: i32) -> Point {
        Point { x, y, m: None }
    }

    /// Create a new point with an MValue
    pub fn new_with_m(x: i32, y: i32, m: MValue) -> Point {
        Point { x, y, m: Some(m) }
    }
}
impl PartialOrd for Point {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        // only compare x and y
        Some(core::cmp::Ord::cmp(self, other))
    }
}
impl Eq for Point {}
impl Ord for Point {
    fn cmp(&self, other: &Self) -> Ordering {
        // only compare x and y
        self.x.cmp(&other.x).then(self.y.cmp(&other.y))
    }
}
/// Open Vector Spec can be an x,y,z but also may contain an MValue
/// if the geometry is a line or polygon
#[derive(Debug, Clone, PartialEq)]
pub struct Point3D {
    /// x value
    pub x: i32,
    /// y value
    pub y: i32,
    /// z value
    pub z: i32,
    /// M value
    pub m: Option<MValue>,
}
impl Point3D {
    /// Create a new point
    pub fn new(x: i32, y: i32, z: i32) -> Point3D {
        Point3D { x, y, z, m: None }
    }

    /// Create a new point with an MValue
    pub fn new_with_m(x: i32, y: i32, z: i32, m: MValue) -> Point3D {
        Point3D { x, y, z, m: Some(m) }
    }
}
impl PartialOrd for Point3D {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        // only compare x and y
        Some(core::cmp::Ord::cmp(self, other))
    }
}
impl Eq for Point3D {}
impl Ord for Point3D {
    fn cmp(&self, other: &Self) -> Ordering {
        // only compare x and y
        self.x.cmp(&other.x).then(self.y.cmp(&other.y)).then(self.z.cmp(&other.z))
    }
}

/// Built array line data with associated offset to help render dashed lines across tiles.
#[derive(Debug, Clone, PartialEq)]
pub struct VectorLineWithOffset {
    /// the offset of the line to start processing the dash position
    pub offset: f64,
    /// the line data
    pub geometry: VectorLine,
}
impl From<&[Point]> for VectorLineWithOffset {
    fn from(p: &[Point]) -> Self {
        Self { offset: 0.0, geometry: p.to_vec() }
    }
}
impl VectorLineWithOffset {
    /// Create a new VectorLineWithOffset
    pub fn new(offset: f64, geometry: VectorLine) -> Self {
        Self { offset, geometry }
    }

    /// check if the line has an offset. 0.0 is considered no offset
    pub fn has_offset(&self) -> bool {
        self.offset != 0.0
    }

    /// check if the line has M values
    pub fn has_m_values(&self) -> bool {
        self.geometry.iter().any(|p| p.m.is_some())
    }

    /// Get the M values for the line
    pub fn m_values(&self) -> Option<LineStringMValues> {
        if !self.has_m_values() {
            return None;
        }
        Some(self.geometry.iter().map(|p| p.m.clone().unwrap_or_default()).collect())
    }
}
/// Built array line data with associated offset to help render dashed lines across tiles.
pub type VectorLinesWithOffset = Vec<VectorLineWithOffset>;

/// Built array line data with associated offset to help render dashed lines across tiles.
#[derive(Debug, Clone, PartialEq)]
pub struct VectorLine3DWithOffset {
    /// the offset of the line to start processing the dash position
    pub offset: f64,
    /// the line data
    pub geometry: VectorLine3D,
}
impl VectorLine3DWithOffset {
    /// Create a new VectorLine3DWithOffset
    pub fn new(offset: f64, geometry: VectorLine3D) -> Self {
        Self { offset, geometry }
    }

    /// check if the line has an offset. 0.0 is considered no offset
    pub fn has_offset(&self) -> bool {
        self.offset != 0.0
    }

    /// check if the line has M values
    pub fn has_m_values(&self) -> bool {
        self.geometry.iter().any(|p| p.m.is_some())
    }

    /// Get the M values for the line
    pub fn m_values(&self) -> Option<LineStringMValues> {
        if !self.has_m_values() {
            return None;
        }
        Some(self.geometry.iter().map(|p| p.m.clone().unwrap_or_default()).collect())
    }
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
#[derive(Debug, Clone, PartialEq)]
pub enum VectorGeometry {
    /// points
    VectorPoints(VectorPoints),
    /// lines
    VectorLines(VectorLinesWithOffset),
    /// polygons
    VectorPolys(Vec<VectorLinesWithOffset>),
    /// 3D points
    VectorPoints3D(VectorPoints3D),
    /// 3D lines
    VectorLines3D(VectorLines3DWithOffset),
    /// 3D polygons
    VectorPolys3D(Vec<VectorLines3DWithOffset>),
}
