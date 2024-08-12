use crate::mapbox::MapboxVectorFeature;
use crate::{
    BBOX,
    BBox,
    BBox3D,
    VectorGeometry,
    VectorLines3DWithOffset,
    VectorLinesWithOffset,
    VectorPoints,
    VectorPoints3D,
    Point,
    Point3D,
};
use crate::util::{weave_2d, weave_3d, zigzag};
use crate::open::{
    encode_value,
    ColumnCacheWriter,
    FeatureType,
    LineStringMValues,
    Properties,
    Shape,
};

use alloc::vec::Vec;

/// Vector Feature functions that are common to all vector features
pub trait VectorFeature {
    /// Get the type of the vector feature
    fn get_type(&self) -> FeatureType;
    /// Get the properties of the vector feature
    fn get_properties(&self) -> &Properties;
    /// true if the feature has BBox
    fn has_bbox(&self) -> bool;
    /// true if the feature has offsets
    fn has_offsets(&self) -> bool;
    /// true if the feature has M values
    fn has_m_values(&self) -> bool;
    /// Get the geometry of the feature
    fn load_geometry(&self) -> VectorGeometry;
    /// Get the M values of the feature
    fn get_m_values(&self) -> Option<LineStringMValues>;
    /// Encode the feature to cache
    fn encode_to_cache(&self, cache: &mut ColumnCacheWriter, m_shape: &Option<Shape>) -> usize;
}

//? Points & Points3D

/// Base Vector Points Feature
#[derive(Default, Debug, Clone, PartialEq)]
pub struct BaseVectorPointsFeature {
    /// Unique ID
    pub id: Option<u64>,
    /// Geometry
    pub geometry: VectorPoints,
    /// Properties
    pub properties: Properties,
    /// BBox
    pub bbox: Option<BBox>,
}
impl BaseVectorPointsFeature {
    /// Create a new BaseVectorPointsFeature
    pub fn new(
        id: Option<u64>,
        geometry: VectorPoints,
        properties: Properties,
        bbox: Option<BBox>
    ) -> Self {
        Self {
            id,
            geometry,
            properties,
            bbox,
        }
    }
}
impl VectorFeature for BaseVectorPointsFeature {
    /// Get the type of the feature
    fn get_type(&self) -> FeatureType {
        FeatureType::Points
    }

    /// Get the properties of the feature
    fn get_properties(&self) -> &Properties {
        &self.properties
    }

    /// true if the feature has BBox
    fn has_bbox(&self) -> bool {
        self.bbox.is_some()
    }

    /// Points do not have this feature, so return false
    fn has_offsets(&self) -> bool {
        false
    }

    /// Points do not have this feature, so return false
    fn has_m_values(&self) -> bool {
        self.geometry.iter().any(|g| g.m.is_some())
    }

    fn load_geometry(&self) -> VectorGeometry {
        VectorGeometry::VectorPoints(self.geometry.clone())
    }

    fn get_m_values(&self) -> Option<LineStringMValues> {
        if !self.has_m_values() { return None; }
        Some(self.geometry.iter().map(|g| {
            // grab the m values, if they exist otherwise return default
            g.m.clone().unwrap_or_default()
        }).collect())
    }

    fn encode_to_cache(&self, cache: &mut ColumnCacheWriter, m_shape: &Option<Shape>) -> usize {
        let geometry = &self.geometry;
        if geometry.len() == 1 {
            let point = &geometry[0];
            weave_2d(zigzag(point.x) as u16, zigzag(point.y) as u16) as usize
        } else {
            let mut indices: Vec<u32> = Vec::new();
            indices.push(cache.add_points(geometry.to_vec()) as u32);
            // store the mvalues indexes if they exist
            if let (Some(m_values), Some(shape)) = (self.get_m_values(), m_shape) {
                for m in m_values {
                    indices.push(encode_value(&m, shape, cache) as u32);
                }
            }
            cache.add_indices(indices)
        }
    }
}
/// Base Vector Points Feature
#[derive(Default, Debug, Clone, PartialEq)]
pub struct BaseVectorPoints3DFeature {
    /// Unique ID
    pub id: Option<u64>,
    /// Geometry
    pub geometry: VectorPoints3D,
    /// Properties
    pub properties: Properties,
    /// BBox
    pub bbox: Option<BBox3D>,
}
impl BaseVectorPoints3DFeature {
    /// Create a new BaseVectorPoints3DFeature
    pub fn new(
        id: Option<u64>,
        geometry: VectorPoints3D,
        properties: Properties,
        bbox: Option<BBox3D>
    ) -> Self {
        Self {
            id,
            geometry,
            properties,
            bbox,
        }
    }
}
impl VectorFeature for BaseVectorPoints3DFeature {
    /// Get the type of the feature
    fn get_type(&self) -> FeatureType {
        FeatureType::Points3D
    }

    /// Get the properties of the feature
    fn get_properties(&self) -> &Properties {
        &self.properties
    }

    /// true if the feature has BBox
    fn has_bbox(&self) -> bool {
        self.bbox.is_some()
    }

    /// Points do not have this feature, so return false
    fn has_offsets(&self) -> bool {
        false
    }

    /// Points do not have this feature, so return false
    fn has_m_values(&self) -> bool {
        self.geometry.iter().any(|g| g.m.is_some())
    }

    fn load_geometry(&self) -> VectorGeometry {
        VectorGeometry::VectorPoints3D(self.geometry.clone())
    }

    fn get_m_values(&self) -> Option<LineStringMValues> {
        if !self.has_m_values() { return None; }
        Some(self.geometry.iter().map(|g| {
            g.m.clone().unwrap_or_default()
        }).collect())
    }

    fn encode_to_cache(&self, cache: &mut ColumnCacheWriter, m_shape: &Option<Shape>) -> usize {
        let geometry = &self.geometry;
        if geometry.len() == 1 {
            let point = &geometry[0];
            weave_3d(zigzag(point.x) as u16, zigzag(point.y) as u16, zigzag(point.z) as u16) as usize
        } else {
            let mut indices: Vec<u32> = Vec::new();
            indices.push(cache.add_points_3d(geometry.to_vec()) as u32);
            // store the mvalues indexes if they exist
            if let (Some(m_values), Some(shape)) = (self.get_m_values(), m_shape) {
                for m in m_values {
                    indices.push(encode_value(&m, shape, cache) as u32);
                }
            }
            cache.add_indices(indices)
        }
    }
}

//? Lines & Lines3D

/// Base Vector Line Feature
#[derive(Default, Debug, Clone, PartialEq)]
pub struct BaseVectorLinesFeature {
    /// Unique ID
    pub id: Option<u64>,
    /// Geometry
    pub geometry: VectorLinesWithOffset,
    /// Properties
    pub properties: Properties,
    /// BBox
    pub bbox: Option<BBox>,
}
impl BaseVectorLinesFeature {
    /// Create a new BaseVectorLinesFeature
    pub fn new(
        id: Option<u64>,
        geometry: VectorLinesWithOffset,
        properties: Properties,
        bbox: Option<BBox>
    ) -> Self {
        Self {
            id,
            geometry,
            properties,
            bbox,
        }
    }
}
impl VectorFeature for BaseVectorLinesFeature {
    /// Get the type of the feature
    fn get_type(&self) -> FeatureType {
        FeatureType::Lines
    }

    /// Get the properties of the feature
    fn get_properties(&self) -> &Properties {
        &self.properties
    }

    /// true if the feature has BBox
    fn has_bbox(&self) -> bool {
        self.bbox.is_some()
    }

    /// Points do not have this feature, so return false
    fn has_offsets(&self) -> bool {
        self.geometry.iter().any(|g| g.has_offset())
    }

    /// Points do not have this feature, so return false
    fn has_m_values(&self) -> bool {
        self.geometry.iter().any(|g| g.has_m_values())
    }

    fn load_geometry(&self) -> VectorGeometry {
        VectorGeometry::VectorLines(
            self.geometry.to_vec()
        )
    }

    fn get_m_values(&self) -> Option<LineStringMValues> {
        if !self.has_m_values() { return None; }
        Some(self.geometry.iter().flat_map(|g| g.get_m_values().unwrap()).collect())
    }

    fn encode_to_cache(&self, cache: &mut ColumnCacheWriter, m_shape: &Option<Shape>) -> usize {
        let geometry = &self.geometry;
        let mut indices: Vec<u32> = Vec::new();
        if geometry.len() != 1 { indices.push(geometry.len() as u32) }
        for line in geometry {
            if line.has_offset() { indices.push(encode_offset(line.offset)); }
            indices.push(cache.add_points(line.geometry.clone()) as u32);
            // store the mvalues indexes if they exist
            if let (Some(m_values), Some(shape)) = (line.get_m_values(), m_shape.clone()) {
                for m in m_values {
                    indices.push(encode_value(&m, &shape, cache) as u32);
                }
            }
        }
        cache.add_indices(indices)
    }
}

/// Base Vector Line 3D Feature
#[derive(Default, Debug, Clone, PartialEq)]
pub struct BaseVectorLines3DFeature {
    /// Unique ID
    pub id: Option<u64>,
    /// Geometry
    pub geometry: VectorLines3DWithOffset,
    /// Properties
    pub properties: Properties,
    /// BBox
    pub bbox: Option<BBox3D>,
}
impl BaseVectorLines3DFeature {
    /// Create a new BaseVectorLines3DFeature
    pub fn new(
        id: Option<u64>,
        geometry: VectorLines3DWithOffset,
        properties: Properties,
        bbox: Option<BBox3D>
    ) -> Self {
        Self {
            id,
            geometry,
            properties,
            bbox,
        }
    }
}
impl VectorFeature for BaseVectorLines3DFeature {
    /// Get the type of the feature
    fn get_type(&self) -> FeatureType {
        FeatureType::Lines3D
    }

    /// Get the properties of the feature
    fn get_properties(&self) -> &Properties {
        &self.properties
    }

    /// true if the feature has BBox
    fn has_bbox(&self) -> bool {
        self.bbox.is_some()
    }

    /// Points do not have this feature, so return false
    fn has_offsets(&self) -> bool {
        self.geometry.iter().any(|g| g.has_offset())
    }

    /// Points do not have this feature, so return false
    fn has_m_values(&self) -> bool {
        self.geometry.iter().any(|g| g.has_m_values())
    }

    fn load_geometry(&self) -> VectorGeometry {
        VectorGeometry::VectorLines3D(
            self.geometry.to_vec()
        )
    }

    fn get_m_values(&self) -> Option<LineStringMValues> {
        if !self.has_m_values() { return None; }
        Some(self.geometry.iter().flat_map(|g| g.get_m_values().unwrap()).collect())
    }

    fn encode_to_cache(&self, cache: &mut ColumnCacheWriter, m_shape: &Option<Shape>) -> usize {
        let geometry = &self.geometry;
        let mut indices: Vec<u32> = Vec::new();
        if geometry.len() != 1 { indices.push(geometry.len() as u32) }
        for line in geometry {
            if line.has_offset() { indices.push(encode_offset(line.offset)); }
            indices.push(cache.add_points_3d(line.geometry.clone()) as u32);
            // store the mvalues indexes if they exist
            if let (Some(m_values), Some(shape)) = (line.get_m_values(), m_shape.clone()) {
                for m in m_values {
                    indices.push(encode_value(&m, &shape, cache) as u32);
                }
            }
        }
        cache.add_indices(indices)
    }
}

//? Polygons & Polygons3D

/// Base Vector Polygon Feature
#[derive(Default, Debug, Clone, PartialEq)]
pub struct BaseVectorPolysFeature {
    /// Unique ID
    pub id: Option<u64>,
    /// Geometry
    pub geometry: Vec<VectorLinesWithOffset>,
    /// Properties
    pub properties: Properties,
    /// BBox
    pub bbox: Option<BBox>,
    /// Tesselation
    pub tesselation: Vec<Point>,
    /// Indices
    pub indices: Vec<u32>,
}
impl BaseVectorPolysFeature {
    /// Create a new BaseVectorPolysFeature
    pub fn new(
        id: Option<u64>,
        geometry: Vec<VectorLinesWithOffset>,
        properties: Properties,
        bbox: Option<BBox>,
        indices: Vec<u32>,
        tesselation: Vec<Point>,
    ) -> Self {
        Self {
            id,
            geometry,
            properties,
            bbox,
            indices,
            tesselation,
        }
    }
}
impl VectorFeature for BaseVectorPolysFeature {
    /// Get the type of the feature
    fn get_type(&self) -> FeatureType {
        FeatureType::Polygons
    }

    /// Get the properties of the feature
    fn get_properties(&self) -> &Properties {
        &self.properties
    }

    /// true if the feature has BBox
    fn has_bbox(&self) -> bool {
        self.bbox.is_some()
    }

    /// Points do not have this feature, so return false
    fn has_offsets(&self) -> bool {
        self.geometry.iter().any(|g| {
            g.iter().any(|l| l.has_offset())
        })
    }

    /// Points do not have this feature, so return false
    fn has_m_values(&self) -> bool {
        self.geometry.iter().any(|g| {
            g.iter().any(|l| l.has_m_values())
        })
    }

    fn load_geometry(&self) -> VectorGeometry {
        VectorGeometry::VectorPolys(
            self.geometry.iter().map(|line| {
                line.to_vec()
            }).collect()
        )
    }

    fn get_m_values(&self) -> Option<LineStringMValues> {
        if !self.has_m_values() { return None; }
        Some(self.geometry.iter().flat_map(|g| {
            g.iter().flat_map(|l| l.get_m_values().unwrap())
        }).collect())
    }

    fn encode_to_cache(&self, cache: &mut ColumnCacheWriter, m_shape: &Option<Shape>) -> usize {
        let geometry = &self.geometry;
        let mut indices: Vec<u32> = Vec::new();
        if geometry.len() != 1 { indices.push(geometry.len() as u32) }
        for poly in geometry {
            indices.push(poly.len() as u32);
            for line in poly {
                if line.has_offset() { indices.push(encode_offset(line.offset)); }
                indices.push(cache.add_points(line.geometry.clone()) as u32);
                // store the mvalues indexes if they exist
                if let (Some(m_values), Some(shape)) = (line.get_m_values(), m_shape.clone()) {
                    for m in m_values {
                        indices.push(encode_value(&m, &shape, cache) as u32);
                    }
                }
            }
        }
        cache.add_indices(indices)
    }
}

/// Base Vector Polygon Feature
#[derive(Default, Debug, Clone, PartialEq)]
pub struct BaseVectorPolys3DFeature {
    /// Unique ID
    pub id: Option<u64>,
    /// Geometry
    pub geometry: Vec<VectorLines3DWithOffset>,
    /// Properties
    pub properties: Properties,
    /// BBox
    pub bbox: Option<BBox3D>,
    /// Tesselation
    pub tesselation: Vec<Point3D>,
    /// Indices
    pub indices: Vec<u32>,
}
impl BaseVectorPolys3DFeature {
    /// Create a new BaseVectorPolys3DFeature
    pub fn new(
        id: Option<u64>,
        geometry: Vec<VectorLines3DWithOffset>,
        properties: Properties,
        bbox: Option<BBox3D>,
        indices: Vec<u32>,
        tesselation: Vec<Point3D>,
    ) -> Self {
        Self {
            id,
            geometry,
            properties,
            bbox,
            indices,
            tesselation,
        }
    }
}
impl VectorFeature for BaseVectorPolys3DFeature {
    /// Get the type of the feature
    fn get_type(&self) -> FeatureType {
        FeatureType::Polygons
    }

    /// Get the properties of the feature
    fn get_properties(&self) -> &Properties {
        &self.properties
    }

    /// true if the feature has BBox
    fn has_bbox(&self) -> bool {
        self.bbox.is_some()
    }

    /// Points do not have this feature, so return false
    fn has_offsets(&self) -> bool {
        self.geometry.iter().any(|g| {
            g.iter().any(|l| l.has_offset())
        })
    }

    /// Points do not have this feature, so return false
    fn has_m_values(&self) -> bool {
        self.geometry.iter().any(|g| {
            g.iter().any(|l| l.has_m_values())
        })
    }

    fn load_geometry(&self) -> VectorGeometry {
        VectorGeometry::VectorPolys3D(
            self.geometry.iter().map(|line| {
                line.to_vec()
            }).collect()
        )
    }

    fn get_m_values(&self) -> Option<LineStringMValues> {
        if !self.has_m_values() { return None; }
        Some(self.geometry.iter().flat_map(|g| {
            g.iter().flat_map(|l| l.get_m_values().unwrap())
        }).collect())
    }

    fn encode_to_cache(&self, cache: &mut ColumnCacheWriter, m_shape: &Option<Shape>) -> usize {
        let geometry = &self.geometry;
        let mut indices: Vec<u32> = Vec::new();
        if geometry.len() != 1 { indices.push(geometry.len() as u32) }
        for poly in geometry {
            indices.push(poly.len() as u32);
            for line in poly {
                if line.has_offset() { indices.push(encode_offset(line.offset)); }
                indices.push(cache.add_points_3d(line.geometry.clone()) as u32);
                // store the mvalues indexes if they exist
                if let (Some(m_values), Some(shape)) = (line.get_m_values(), m_shape.clone()) {
                    for m in m_values {
                        indices.push(encode_value(&m, &shape, cache) as u32);
                    }
                }
            }
        }
        cache.add_indices(indices)
    }
}

/// Tesselation Wrapper to handle both 2D and 3D cases
#[derive(Debug, Clone)]
pub enum TesselationWrapper {
    /// 2D tesselation
    Tesselation(Vec<Point>),
    /// 3D tesselation
    Tesselation3D(Vec<Point3D>),
}
impl TesselationWrapper {
    /// check the length of the tesselation
    pub fn len(&self) -> usize {
        match self {
            TesselationWrapper::Tesselation(points) => points.len(),
            TesselationWrapper::Tesselation3D(points) => points.len(),
        }
    }

    /// check if the tesselation is empty
    pub fn is_empty(&self) -> bool {
        match self {
            TesselationWrapper::Tesselation(points) => points.is_empty(),
            TesselationWrapper::Tesselation3D(points) => points.is_empty(),
        }
    }
}

/// A type that encompasses all vector tile feature types
pub enum BaseVectorFeature {
    /// Points
    BaseVectorPointsFeature(BaseVectorPointsFeature),
    /// Lines
    BaseVectorLinesFeature(BaseVectorLinesFeature),
    /// Polygons
    BaseVectorPolysFeature(BaseVectorPolysFeature),
    /// 3D Points
    BaseVectorPoints3DFeature(BaseVectorPoints3DFeature),
    /// 3D Lines
    BaseVectorLines3DFeature(BaseVectorLines3DFeature),
    /// 3D Polygons
    BaseVectorPolys3DFeature(BaseVectorPolys3DFeature),
}
impl BaseVectorFeature {
    /// check if the feature geometry has a single length
    pub fn single(&self) -> bool {
        match self {
            BaseVectorFeature::BaseVectorPointsFeature(f) => f.geometry.len() == 1,
            BaseVectorFeature::BaseVectorLinesFeature(f) => f.geometry.len() == 1,
            BaseVectorFeature::BaseVectorPolysFeature(f) => f.geometry.len() == 1,
            BaseVectorFeature::BaseVectorPoints3DFeature(f) => f.geometry.len() == 1,
            BaseVectorFeature::BaseVectorLines3DFeature(f) => f.geometry.len() == 1,
            BaseVectorFeature::BaseVectorPolys3DFeature(f) => f.geometry.len() == 1,
        }
    }

    /// get the feature properties
    pub fn get_properties(&self) -> &Properties {
        match self {
            BaseVectorFeature::BaseVectorPointsFeature(f) => f.get_properties(),
            BaseVectorFeature::BaseVectorLinesFeature(f) => f.get_properties(),
            BaseVectorFeature::BaseVectorPolysFeature(f) => f.get_properties(),
            BaseVectorFeature::BaseVectorPoints3DFeature(f) => f.get_properties(),
            BaseVectorFeature::BaseVectorLines3DFeature(f) => f.get_properties(),
            BaseVectorFeature::BaseVectorPolys3DFeature(f) => f.get_properties(),
        }
    }

    /// check if the feature has m values
    pub fn has_m_values(&self) -> bool {
        match self {
            BaseVectorFeature::BaseVectorPointsFeature(f) => f.has_m_values(),
            BaseVectorFeature::BaseVectorLinesFeature(f) => f.has_m_values(),
            BaseVectorFeature::BaseVectorPolysFeature(f) => f.has_m_values(),
            BaseVectorFeature::BaseVectorPoints3DFeature(f) => f.has_m_values(),
            BaseVectorFeature::BaseVectorLines3DFeature(f) => f.has_m_values(),
            BaseVectorFeature::BaseVectorPolys3DFeature(f) => f.has_m_values(),
        }
    }

    /// get the feature m values
    pub fn get_m_values(&self) -> Option<LineStringMValues> {
        match self {
            BaseVectorFeature::BaseVectorPointsFeature(f) => f.get_m_values(),
            BaseVectorFeature::BaseVectorLinesFeature(f) => f.get_m_values(),
            BaseVectorFeature::BaseVectorPolysFeature(f) => f.get_m_values(),
            BaseVectorFeature::BaseVectorPoints3DFeature(f) => f.get_m_values(),
            BaseVectorFeature::BaseVectorLines3DFeature(f) => f.get_m_values(),
            BaseVectorFeature::BaseVectorPolys3DFeature(f) => f.get_m_values(),
        }
    }

    /// get the feature type
    pub fn get_type(&self) -> FeatureType {
        match self {
            BaseVectorFeature::BaseVectorPointsFeature(f) => f.get_type(),
            BaseVectorFeature::BaseVectorLinesFeature(f) => f.get_type(),
            BaseVectorFeature::BaseVectorPolysFeature(f) => f.get_type(),
            BaseVectorFeature::BaseVectorPoints3DFeature(f) => f.get_type(),
            BaseVectorFeature::BaseVectorLines3DFeature(f) => f.get_type(),
            BaseVectorFeature::BaseVectorPolys3DFeature(f) => f.get_type(),
        }
    }

    /// get the feature id
    pub fn id(&self) -> Option<u64> {
        match self {
            BaseVectorFeature::BaseVectorPointsFeature(f) => f.id,
            BaseVectorFeature::BaseVectorLinesFeature(f) => f.id,
            BaseVectorFeature::BaseVectorPolysFeature(f) => f.id,
            BaseVectorFeature::BaseVectorPoints3DFeature(f) => f.id,
            BaseVectorFeature::BaseVectorLines3DFeature(f) => f.id,
            BaseVectorFeature::BaseVectorPolys3DFeature(f) => f.id,
        }
    }

    /// get the feature indices
    pub fn indices(&self) -> Option<Vec<u32>> {
        match self {
            BaseVectorFeature::BaseVectorPolysFeature(f) => Some(f.indices.clone()),
            BaseVectorFeature::BaseVectorPolys3DFeature(f) => Some(f.indices.clone()),
            _ => None
        }
    }

    /// get the feature tesselation
    pub fn tesselation(&self) -> Option<TesselationWrapper> {
        match self {
            BaseVectorFeature::BaseVectorPolysFeature(f) =>
                Some(TesselationWrapper::Tesselation(f.tesselation.clone())),
            BaseVectorFeature::BaseVectorPolys3DFeature(f) =>
                Some(TesselationWrapper::Tesselation3D(f.tesselation.clone())),
            _ => None
        }
    }

    /// get the feature bbox
    pub fn bbox(&self) -> Option<BBOX> {
        match self {
            BaseVectorFeature::BaseVectorPointsFeature(f) => f.bbox.map(BBOX::BBox),
            BaseVectorFeature::BaseVectorLinesFeature(f) => f.bbox.map(BBOX::BBox),
            BaseVectorFeature::BaseVectorPolysFeature(f) => f.bbox.map(BBOX::BBox),
            BaseVectorFeature::BaseVectorPoints3DFeature(f) => f.bbox.map(BBOX::BBox3D),
            BaseVectorFeature::BaseVectorLines3DFeature(f) => f.bbox.map(BBOX::BBox3D),
            BaseVectorFeature::BaseVectorPolys3DFeature(f) => f.bbox.map(BBOX::BBox3D),
        }
    }

    /// check if the feature has offsets
    pub fn has_offsets(&self) -> bool {
        match self {
            BaseVectorFeature::BaseVectorLinesFeature(f) => f.has_offsets(),
            BaseVectorFeature::BaseVectorLines3DFeature(f) => f.has_offsets(),
            BaseVectorFeature::BaseVectorPolysFeature(f) => f.has_offsets(),
            BaseVectorFeature::BaseVectorPolys3DFeature(f) => f.has_offsets(),
            _ => false
        }
    }

    /// encode the feature to cache
    pub fn encode_to_cache(&self, cache: &mut ColumnCacheWriter, m_shape: &Option<Shape>) -> usize {
        match self {
            BaseVectorFeature::BaseVectorPointsFeature(f) => f.encode_to_cache(cache, m_shape),
            BaseVectorFeature::BaseVectorLinesFeature(f) => f.encode_to_cache(cache, m_shape),
            BaseVectorFeature::BaseVectorPolysFeature(f) => f.encode_to_cache(cache, m_shape),
            BaseVectorFeature::BaseVectorPoints3DFeature(f) => f.encode_to_cache(cache, m_shape),
            BaseVectorFeature::BaseVectorLines3DFeature(f) => f.encode_to_cache(cache, m_shape),
            BaseVectorFeature::BaseVectorPolys3DFeature(f) => f.encode_to_cache(cache, m_shape),
        }
    }
}
impl From<&mut MapboxVectorFeature> for BaseVectorFeature {
    fn from(mvt: &mut MapboxVectorFeature) -> Self {
        let id = mvt.id;
        let properties: Properties = (&mvt.properties).into();
        let indices = mvt.read_indices();
        let mut tesselation_floats: Vec<f64> = Vec::new();
        mvt.add_tesselation(&mut tesselation_floats, 1.0);
        // convert an flat array of f64 to groups of 2 making a Point (convert to a Vec<Point>)
        let tesselation = tesselation_floats
            .chunks(2)
            .map(|chunk| Point::new(chunk[0] as i32, chunk[1] as i32))
            .collect();

        match mvt.load_geometry() {
            VectorGeometry::VectorPoints(geo) => BaseVectorFeature::BaseVectorPointsFeature(
                BaseVectorPointsFeature::new(id, geo, properties, None)
            ),
            VectorGeometry::VectorLines(geo) => BaseVectorFeature::BaseVectorLinesFeature(
                BaseVectorLinesFeature::new(id, geo, properties, None)
            ),
            VectorGeometry::VectorPolys(geo) => BaseVectorFeature::BaseVectorPolysFeature(
                BaseVectorPolysFeature::new(id, geo, properties, None, indices, tesselation)
            ),
            _ => panic!("unexpected geometry type"),
        }
    }
}

/// Encode offset values into a signed integer to reduce byte cost without too much loss
pub fn encode_offset(offset: f64) -> u32 {
    (offset * 1_000.0).round() as u32
}
  
/// Decode offset from a signed integer into a float or double
pub fn decode_offset(offset: u32) -> f64 {
    (offset as f64) / 1_000.0
}