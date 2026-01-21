use crate::{
    FeatureType, OpenVectorFeature, VectorGeometry, VectorLines3DWithOffset, VectorLinesWithOffset,
    VectorPoints, VectorPoints3D, mapbox::MapboxVectorFeature,
};
use alloc::vec::Vec;
use s2json::{BBOX, Properties};

/// Methods that all vector features should have
pub trait VectorFeatureMethods {
    /// the id of the feature
    fn id(&self) -> Option<u64>;
    /// the version of the vector tile
    fn version(&self) -> u16;
    /// the properties
    fn properties(&self) -> Properties;
    /// the extent
    fn extent(&self) -> usize;
    /// the feature type
    fn get_type(&self) -> FeatureType;
    /// the bounding box
    fn bbox(&self) -> Option<BBOX>;
    /// whether the feature has m values
    fn has_m_values(&self) -> bool;
    /// whether the feature is a points type
    fn is_points(&self) -> bool;
    /// whether the feature is a line type
    fn is_lines(&self) -> bool;
    /// whether the feature is a polygon type
    fn is_polygons(&self) -> bool;
    /// whether the feature is a points 3D type
    fn is_points_3d(&self) -> bool;
    /// whether the feature is a line 3D type
    fn is_lines_3d(&self) -> bool;
    /// whether the feature is a polygon 3D type
    fn is_polygons_3d(&self) -> bool;
    /// regardless of the type, we return a flattend point array
    fn load_points(&mut self) -> VectorPoints;
    /// regardless of the type, we return a flattend point3D array
    fn load_points_3d(&mut self) -> VectorPoints3D;
    /// an array of lines.
    fn load_lines(&mut self) -> VectorLinesWithOffset;
    /// an array of 3D lines.
    fn load_lines_3d(&mut self) -> VectorLines3DWithOffset;
    /// an array of polygons.
    fn load_polys(&mut self) -> Vec<VectorLinesWithOffset>;
    /// an array of 3D polygons.
    fn load_polys_3d(&mut self) -> Vec<VectorLines3DWithOffset>;
    /// (flattened geometry & tesslation if applicable, indices)
    fn load_geometry_flat(&mut self) -> (Vec<f64>, Vec<u32>);
    /// load the geometry
    fn load_geometry(&mut self) -> VectorGeometry;
    /// load the indices
    fn read_indices(&mut self) -> Vec<u32>;
    /// Add tessellation data to the geometry
    fn add_tessellation(&mut self, geometry: &mut Vec<f64>, multiplier: f64);
    /// Add 3D tessellation data to the geometry
    fn add_tessellation_3d(&mut self, geometry: &mut Vec<f64>, multiplier: f64);
}

/// Either a mapbox or open vector feature. Implements the [`VectorFeatureMethods`] trait
#[derive(Debug)]
pub enum VectorFeature<'a> {
    /// Mapbox Vector Feature
    Mapbox(&'a mut MapboxVectorFeature),
    /// Open Vector Feature
    Open(&'a mut OpenVectorFeature),
}
impl<'a> From<&'a mut MapboxVectorFeature> for VectorFeature<'a> {
    fn from(value: &'a mut MapboxVectorFeature) -> Self {
        VectorFeature::Mapbox(value)
    }
}
impl<'a> From<&'a mut OpenVectorFeature> for VectorFeature<'a> {
    fn from(value: &'a mut OpenVectorFeature) -> Self {
        VectorFeature::Open(value)
    }
}
impl VectorFeatureMethods for VectorFeature<'_> {
    fn id(&self) -> Option<u64> {
        match self {
            VectorFeature::Mapbox(feature) => feature.id(),
            VectorFeature::Open(feature) => feature.id(),
        }
    }
    fn version(&self) -> u16 {
        match self {
            VectorFeature::Mapbox(feature) => feature.version(),
            VectorFeature::Open(feature) => feature.version(),
        }
    }
    fn properties(&self) -> Properties {
        match self {
            VectorFeature::Mapbox(feature) => feature.properties(),
            VectorFeature::Open(feature) => feature.properties(),
        }
    }
    fn extent(&self) -> usize {
        match self {
            VectorFeature::Mapbox(feature) => feature.extent(),
            VectorFeature::Open(feature) => feature.extent(),
        }
    }
    fn get_type(&self) -> FeatureType {
        match self {
            VectorFeature::Mapbox(feature) => feature.get_type(),
            VectorFeature::Open(feature) => feature.get_type(),
        }
    }
    fn bbox(&self) -> Option<BBOX> {
        match self {
            VectorFeature::Mapbox(feature) => feature.bbox(),
            VectorFeature::Open(feature) => feature.bbox(),
        }
    }
    fn has_m_values(&self) -> bool {
        match self {
            VectorFeature::Mapbox(feature) => feature.has_m_values(),
            VectorFeature::Open(feature) => feature.has_m_values(),
        }
    }
    fn is_points(&self) -> bool {
        match self {
            VectorFeature::Mapbox(feature) => feature.is_points(),
            VectorFeature::Open(feature) => feature.is_points(),
        }
    }
    fn is_lines(&self) -> bool {
        match self {
            VectorFeature::Mapbox(feature) => feature.is_lines(),
            VectorFeature::Open(feature) => feature.is_lines(),
        }
    }
    fn is_polygons(&self) -> bool {
        match self {
            VectorFeature::Mapbox(feature) => feature.is_polygons(),
            VectorFeature::Open(feature) => feature.is_polygons(),
        }
    }
    fn is_points_3d(&self) -> bool {
        match self {
            VectorFeature::Mapbox(feature) => feature.is_points_3d(),
            VectorFeature::Open(feature) => feature.is_points_3d(),
        }
    }
    fn is_lines_3d(&self) -> bool {
        match self {
            VectorFeature::Mapbox(feature) => feature.is_lines_3d(),
            VectorFeature::Open(feature) => feature.is_lines_3d(),
        }
    }
    fn is_polygons_3d(&self) -> bool {
        match self {
            VectorFeature::Mapbox(feature) => feature.is_polygons_3d(),
            VectorFeature::Open(feature) => feature.is_polygons_3d(),
        }
    }
    fn load_points(&mut self) -> VectorPoints {
        match self {
            VectorFeature::Mapbox(feature) => feature.load_points(),
            VectorFeature::Open(feature) => feature.load_points(),
        }
    }
    fn load_points_3d(&mut self) -> VectorPoints3D {
        match self {
            VectorFeature::Mapbox(feature) => feature.load_points_3d(),
            VectorFeature::Open(feature) => feature.load_points_3d(),
        }
    }
    fn load_lines(&mut self) -> VectorLinesWithOffset {
        match self {
            VectorFeature::Mapbox(feature) => feature.load_lines(),
            VectorFeature::Open(feature) => feature.load_lines(),
        }
    }
    fn load_lines_3d(&mut self) -> VectorLines3DWithOffset {
        match self {
            VectorFeature::Mapbox(feature) => feature.load_lines_3d(),
            VectorFeature::Open(feature) => feature.load_lines_3d(),
        }
    }
    fn load_polys(&mut self) -> Vec<VectorLinesWithOffset> {
        match self {
            VectorFeature::Mapbox(feature) => feature.load_polys(),
            VectorFeature::Open(feature) => feature.load_polys(),
        }
    }
    fn load_polys_3d(&mut self) -> Vec<VectorLines3DWithOffset> {
        match self {
            VectorFeature::Mapbox(feature) => feature.load_polys_3d(),
            VectorFeature::Open(feature) => feature.load_polys_3d(),
        }
    }
    fn load_geometry_flat(&mut self) -> (Vec<f64>, Vec<u32>) {
        match self {
            VectorFeature::Mapbox(feature) => feature.load_geometry_flat(),
            VectorFeature::Open(feature) => feature.load_geometry_flat(),
        }
    }
    fn load_geometry(&mut self) -> VectorGeometry {
        match self {
            VectorFeature::Mapbox(feature) => feature.load_geometry(),
            VectorFeature::Open(feature) => feature.load_geometry(),
        }
    }
    fn read_indices(&mut self) -> Vec<u32> {
        match self {
            VectorFeature::Mapbox(feature) => feature.read_indices(),
            VectorFeature::Open(feature) => feature.read_indices(),
        }
    }
    fn add_tessellation(&mut self, geometry: &mut Vec<f64>, multiplier: f64) {
        match self {
            VectorFeature::Mapbox(feature) => feature.add_tessellation(geometry, multiplier),
            VectorFeature::Open(feature) => feature.add_tessellation(geometry, multiplier),
        }
    }
    fn add_tessellation_3d(&mut self, geometry: &mut Vec<f64>, multiplier: f64) {
        match self {
            VectorFeature::Mapbox(feature) => feature.add_tessellation_3d(geometry, multiplier),
            VectorFeature::Open(feature) => feature.add_tessellation_3d(geometry, multiplier),
        }
    }
}
