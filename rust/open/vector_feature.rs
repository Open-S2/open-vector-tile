use pbf::{BitCast, Protobuf};

use crate::{
    base::{decode_offset, BaseVectorFeature, TesselationWrapper},
    mapbox::FeatureType as MapboxFeatureType,
    open::{encode_value, ColumnCacheReader, ColumnCacheWriter, Properties, Shape},
    unweave_2d, unweave_3d, zagzig, Point, Point3D, VectorFeatureMethods, VectorGeometry,
    VectorLine3DWithOffset, VectorLineWithOffset, VectorLines3DWithOffset, VectorLinesWithOffset,
    VectorPoints, VectorPoints3D, BBOX,
};

use core::cell::RefCell;

use alloc::rc::Rc;
use alloc::vec;
use alloc::vec::Vec;

use super::decode_value;

/// Extent guide for how the geometry data is stored
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum Extent {
    /// 512x512
    Extent512 = 512,
    /// 1024x1024
    Extent1024 = 1_024,
    /// 2048x2048
    Extent2048 = 2_048,
    /// 4096x4096 (default)
    #[default]
    Extent4096 = 4_096,
    /// 8_192x8_192
    Extent8192 = 8_192,
    /// 16_384x16_384
    Extent16384 = 16_384,
}
impl BitCast for Extent {
    fn to_u64(&self) -> u64 {
        match self {
            Extent::Extent512 => 0,
            Extent::Extent1024 => 1,
            Extent::Extent2048 => 2,
            Extent::Extent4096 => 3,
            Extent::Extent8192 => 4,
            Extent::Extent16384 => 5,
        }
    }

    fn from_u64(value: u64) -> Self {
        match value {
            1 => Extent::Extent1024,
            2 => Extent::Extent2048,
            3 => Extent::Extent4096,
            4 => Extent::Extent8192,
            5 => Extent::Extent16384,
            _ => Extent::Extent512,
        }
    }
}
impl From<usize> for Extent {
    fn from(extent: usize) -> Self {
        match extent {
            512 => Extent::Extent512,
            1_024 => Extent::Extent1024,
            2_048 => Extent::Extent2048,
            4_096 => Extent::Extent4096,
            8_192 => Extent::Extent8192,
            16_384 => Extent::Extent16384,
            _ => Extent::Extent512,
        }
    }
}
impl From<Extent> for usize {
    fn from(extent: Extent) -> Self {
        extent as i32 as usize
    }
}
impl From<Extent> for f64 {
    fn from(extent: Extent) -> Self {
        extent as i32 as f64
    }
}

/// Open Vector Tile Feature types.
#[derive(Default, Debug, Copy, Clone, PartialEq, PartialOrd, Ord, Eq)]
pub enum FeatureType {
    /// Points Feature
    #[default]
    Points = 1,
    /// Lines Feature
    Lines = 2,
    /// Polygons Feature
    Polygons = 3,
    /// Points3D Feature
    Points3D = 4,
    /// Lines3D Feature
    Lines3D = 5,
    /// Polygons3D Feature
    Polygons3D = 6,
}
impl BitCast for FeatureType {
    fn to_u64(&self) -> u64 {
        (*self) as u64
    }
    fn from_u64(value: u64) -> Self {
        match value {
            1 => FeatureType::Points,
            2 => FeatureType::Lines,
            3 => FeatureType::Polygons,
            4 => FeatureType::Points3D,
            5 => FeatureType::Lines3D,
            6 => FeatureType::Polygons3D,
            _ => panic!("unknown value: {}", value),
        }
    }
}
impl From<&MapboxFeatureType> for FeatureType {
    fn from(mft: &MapboxFeatureType) -> Self {
        match mft {
            MapboxFeatureType::Point => FeatureType::Points,
            MapboxFeatureType::Line => FeatureType::Lines,
            MapboxFeatureType::Polygon => FeatureType::Polygons,
            MapboxFeatureType::MultiPolygon => FeatureType::Polygons,
        }
    }
}

/// Open Vector Tile Feature specification
#[derive(Debug)]
pub struct OpenVectorFeature {
    /// the id of the feature
    pub id: Option<u64>,
    /// the properties of the feature
    pub properties: Properties,
    /// the type of the feature
    pub r#type: FeatureType,
    cache: Rc<RefCell<ColumnCacheReader>>,
    m_shape: Shape,
    extent: Extent,
    geometry_indices: Vec<u32>,
    geometry: Option<VectorGeometry>,
    single: bool,
    bbox_index: Option<usize>,
    has_offsets: bool,
    has_m_values: bool,
    indices_index: Option<usize>,
    tesselation_index: Option<usize>,
}
impl OpenVectorFeature {
    fn _load_geometry_points(&mut self) -> VectorPoints {
        let mut cache = self.cache.borrow_mut();

        let mut index_pos = 0;
        let geometry_index = self.geometry_indices[index_pos];
        index_pos += 1;
        if self.single {
            let (a, b) = unweave_2d(geometry_index);
            vec![Point::new(zagzig(a as u32), zagzig(b as u32))]
        } else {
            let mut geometry = cache.get_points(geometry_index as usize);

            if self.has_m_values {
                let length = geometry.len();
                geometry.iter_mut().take(length).for_each(|p| {
                    let value_index = self.geometry_indices[index_pos];
                    p.m = Some(decode_value(
                        value_index as usize,
                        &self.m_shape,
                        &mut cache,
                    ));
                    index_pos += 1;
                });
            }

            geometry
        }
    }

    fn _load_geometry_points_3d(&mut self) -> VectorPoints3D {
        let mut cache = self.cache.borrow_mut();

        let mut index_pos = 0;
        let geometry_index = self.geometry_indices[index_pos];
        index_pos += 1;
        if self.single {
            let (a, b, c) = unweave_3d(geometry_index as u64);
            vec![Point3D::new(zagzig(a), zagzig(b), zagzig(c))]
        } else {
            let mut geometry = cache.get_points_3d(geometry_index as usize);

            if self.has_m_values {
                let length = geometry.len();
                geometry.iter_mut().take(length).for_each(|p| {
                    let value_index = self.geometry_indices[index_pos];
                    p.m = Some(decode_value(
                        value_index as usize,
                        &self.m_shape,
                        &mut cache,
                    ));
                    index_pos += 1;
                });
            }

            geometry
        }
    }

    fn _load_geometry_lines(&mut self) -> VectorLinesWithOffset {
        let mut cache = self.cache.borrow_mut();

        let mut res: VectorLinesWithOffset = vec![];

        let mut index_pos = 0;
        let mut line_count = 1;
        if !self.single {
            line_count = self.geometry_indices[index_pos];
            index_pos += 1;
        };
        for _ in 0..line_count {
            // get offset if it exists
            let mut offset = 0.0;
            if self.has_offsets {
                offset = decode_offset(self.geometry_indices[index_pos]);
                index_pos += 1;
            }
            // get geometry
            let mut geometry = cache.get_points(self.geometry_indices[index_pos] as usize);
            index_pos += 1;
            // inject m values if they exist
            if self.has_m_values {
                let length = geometry.len();
                geometry.iter_mut().take(length).for_each(|p| {
                    let value_index = self.geometry_indices[index_pos];
                    p.m = Some(decode_value(
                        value_index as usize,
                        &self.m_shape,
                        &mut cache,
                    ));
                    index_pos += 1;
                });
            }
            res.push(VectorLineWithOffset::new(offset, geometry));
        }

        res
    }

    fn _load_geometry_lines_3d(&mut self) -> VectorLines3DWithOffset {
        let mut cache = self.cache.borrow_mut();

        let mut res: VectorLines3DWithOffset = vec![];

        let mut index_pos = 0;
        let mut line_count = 1;
        if !self.single {
            line_count = self.geometry_indices[index_pos];
            index_pos += 1;
        };
        for _ in 0..line_count {
            // get offset if it exists
            let mut offset = 0.0;
            if self.has_offsets {
                offset = decode_offset(self.geometry_indices[index_pos]);
                index_pos += 1;
            }
            // get geometry
            let mut geometry = cache.get_points_3d(self.geometry_indices[index_pos] as usize);
            index_pos += 1;
            // inject m values if they exist
            if self.has_m_values {
                let length = geometry.len();
                geometry.iter_mut().take(length).for_each(|p| {
                    let value_index = self.geometry_indices[index_pos];
                    p.m = Some(decode_value(
                        value_index as usize,
                        &self.m_shape,
                        &mut cache,
                    ));
                    index_pos += 1;
                });
            }
            res.push(VectorLine3DWithOffset::new(offset, geometry));
        }

        res
    }

    fn _load_geometry_polys(&mut self) -> Vec<VectorLinesWithOffset> {
        let mut cache = self.cache.borrow_mut();

        let mut res: Vec<VectorLinesWithOffset> = vec![];

        let mut index_pos = 0;
        let mut poly_count = 1;
        if !self.single {
            poly_count = self.geometry_indices[index_pos];
            index_pos += 1;
        };
        for _ in 0..poly_count {
            let line_count = self.geometry_indices[index_pos];
            index_pos += 1;
            let mut lines: VectorLinesWithOffset = vec![];
            for _ in 0..line_count {
                // get offset if it exists
                let mut offset = 0.0;
                if self.has_offsets {
                    offset = decode_offset(self.geometry_indices[index_pos]);
                    index_pos += 1;
                }
                // get geometry
                let mut geometry = cache.get_points(self.geometry_indices[index_pos] as usize);
                index_pos += 1;
                // inject m values if they exist
                if self.has_m_values {
                    let length = geometry.len();
                    geometry.iter_mut().take(length).for_each(|p| {
                        let value_index = self.geometry_indices[index_pos];
                        p.m = Some(decode_value(
                            value_index as usize,
                            &self.m_shape,
                            &mut cache,
                        ));
                        index_pos += 1;
                    });
                }
                lines.push(VectorLineWithOffset::new(offset, geometry));
            }
            res.push(lines);
        }

        res
    }

    fn _load_geometry_polys_3d(&mut self) -> Vec<VectorLines3DWithOffset> {
        let mut cache = self.cache.borrow_mut();

        let mut res: Vec<VectorLines3DWithOffset> = vec![];

        let mut index_pos = 0;
        let mut poly_count = 1;
        if !self.single {
            poly_count = self.geometry_indices[index_pos];
            index_pos += 1;
        };
        for _ in 0..poly_count {
            let line_count = self.geometry_indices[index_pos];
            index_pos += 1;
            let mut lines: VectorLines3DWithOffset = vec![];
            for _ in 0..line_count {
                // get offset if it exists
                let mut offset = 0.0;
                if self.has_offsets {
                    offset = decode_offset(self.geometry_indices[index_pos]);
                    index_pos += 1;
                }
                // get geometry
                let mut geometry = cache.get_points_3d(self.geometry_indices[index_pos] as usize);
                index_pos += 1;
                // inject m values if they exist
                if self.has_m_values {
                    let length = geometry.len();
                    geometry.iter_mut().take(length).for_each(|p| {
                        let value_index = self.geometry_indices[index_pos];
                        p.m = Some(decode_value(
                            value_index as usize,
                            &self.m_shape,
                            &mut cache,
                        ));
                        index_pos += 1;
                    });
                }
                lines.push(VectorLine3DWithOffset::new(offset, geometry));
            }
            res.push(lines);
        }

        res
    }
}
impl VectorFeatureMethods for OpenVectorFeature {
    /// get the id of the feature
    fn id(&self) -> Option<u64> {
        self.id
    }

    /// get the version of the feature
    fn version(&self) -> u16 {
        1
    }

    /// get the extent of the feature
    fn extent(&self) -> usize {
        self.extent.into()
    }

    fn properties(&self) -> Properties {
        self.properties.clone()
    }

    /// Create a new OpenVectorFeature
    fn get_type(&self) -> FeatureType {
        self.r#type
    }

    /// get the bbox of the feature
    fn bbox(&self) -> Option<BBOX> {
        if let Some(index) = self.bbox_index {
            let mut cache = self.cache.borrow_mut();
            Some(cache.get_bbox(index))
        } else {
            None
        }
    }

    /// whether the feature has m values
    fn has_m_values(&self) -> bool {
        self.has_m_values
    }

    /// regardless of the type, we return a flattend point array
    fn load_points(&mut self) -> VectorPoints {
        match self.load_geometry() {
            VectorGeometry::VectorPoints(p) => p,
            VectorGeometry::VectorLines(lines) => {
                lines.iter().flat_map(|p| p.geometry.clone()).collect()
            }
            VectorGeometry::VectorPolys(polys) => polys
                .iter()
                .flat_map(|p| {
                    p.iter()
                        .flat_map(|p| p.geometry[..p.geometry.len() - 1].to_vec())
                })
                .collect(),
            _ => {
                panic!("unexpected geometry type")
            }
        }
    }

    /// regardless of the type, we return a flattend point array
    fn load_points_3d(&mut self) -> VectorPoints3D {
        match self.load_geometry() {
            VectorGeometry::VectorPoints3D(p) => p,
            VectorGeometry::VectorLines3D(lines) => {
                lines.iter().flat_map(|p| p.geometry.clone()).collect()
            }
            VectorGeometry::VectorPolys3D(polys) => polys
                .iter()
                .flat_map(|p| {
                    p.iter()
                        .flat_map(|p| p.geometry[..p.geometry.len() - 1].to_vec())
                })
                .collect(),
            _ => {
                panic!("unexpected geometry type")
            }
        }
    }

    /// an array of lines. The offsets will be set to 0
    fn load_lines(&mut self) -> VectorLinesWithOffset {
        match self.load_geometry() {
            VectorGeometry::VectorLines(lines) => lines,
            VectorGeometry::VectorPolys(polys) => polys.iter().flat_map(|p| p.clone()).collect(),
            _ => {
                panic!("unexpected geometry type")
            }
        }
    }

    /// an array of lines. The offsets will be set to 0
    fn load_lines_3d(&mut self) -> VectorLines3DWithOffset {
        match self.load_geometry() {
            VectorGeometry::VectorLines3D(lines) => lines,
            VectorGeometry::VectorPolys3D(polys) => polys.iter().flat_map(|p| p.clone()).collect(),
            _ => {
                panic!("unexpected geometry type")
            }
        }
    }

    /// returns the indices of the geometry
    fn read_indices(&mut self) -> Vec<u32> {
        if self.indices_index.is_none() {
            return vec![];
        }
        let mut cache = self.cache.borrow_mut();
        cache.get_indices(self.indices_index.unwrap())
    }

    /// Add tesselation data to the geometry
    fn add_tesselation(&mut self, geometry: &mut Vec<f64>, multiplier: f64) {
        let Some(tesselation_index) = self.tesselation_index else {
            return;
        };
        let mut cache = self.cache.borrow_mut();
        let data = cache.get_points(tesselation_index);
        for point in data {
            geometry.push(point.x as f64 * multiplier);
            geometry.push(point.y as f64 * multiplier);
        }
    }

    /// Add 3D tesselation data to the geometry
    fn add_tesselation_3d(&mut self, geometry: &mut Vec<f64>, multiplier: f64) {
        let Some(tesselation_index) = self.tesselation_index else {
            return;
        };
        let mut cache = self.cache.borrow_mut();
        let data = cache.get_points_3d(tesselation_index);
        for point in data {
            geometry.push(point.x as f64 * multiplier);
            geometry.push(point.y as f64 * multiplier);
            geometry.push(point.z as f64 * multiplier);
        }
    }

    /// (flattened geometry & tesslation if applicable, indices)
    fn load_geometry_flat(&mut self) -> (Vec<f64>, Vec<u32>) {
        // build a multiplier
        let multiplier: f64 = 1.0 / f64::from(self.extent);
        // grab the geometry, flatten it, and mutate to an f64
        let geometry: Vec<f64> = match self.load_geometry() {
            VectorGeometry::VectorPolys(polys) => {
                let mut geo = polys
                    .iter()
                    .flat_map(|p| {
                        p.iter().flat_map(|p| {
                            p.geometry.clone().into_iter().flat_map(|p| {
                                vec![p.x as f64 * multiplier, p.y as f64 * multiplier]
                            })
                        })
                    })
                    .collect();
                self.add_tesselation(&mut geo, multiplier);
                geo
            }
            VectorGeometry::VectorPolys3D(polys) => {
                let mut geo = polys
                    .iter()
                    .flat_map(|p| {
                        p.iter().flat_map(|p| {
                            p.geometry.clone().into_iter().flat_map(|p| {
                                vec![p.x as f64 * multiplier, p.y as f64 * multiplier]
                            })
                        })
                    })
                    .collect();
                self.add_tesselation_3d(&mut geo, multiplier);
                geo
            }
            _ => {
                panic!("unexpected geometry type")
            }
        };
        // if a poly, check if we should load indices
        let indices = self.read_indices();

        (geometry, indices)
    }

    /// load the geometry
    fn load_geometry(&mut self) -> VectorGeometry {
        if let Some(geometry) = &self.geometry {
            return geometry.clone();
        }

        self.geometry = Some(match self.r#type {
            FeatureType::Points => VectorGeometry::VectorPoints(self._load_geometry_points()),
            FeatureType::Points3D => {
                VectorGeometry::VectorPoints3D(self._load_geometry_points_3d())
            }
            FeatureType::Lines => VectorGeometry::VectorLines(self._load_geometry_lines()),
            FeatureType::Lines3D => VectorGeometry::VectorLines3D(self._load_geometry_lines_3d()),
            FeatureType::Polygons => VectorGeometry::VectorPolys(self._load_geometry_polys()),
            FeatureType::Polygons3D => {
                VectorGeometry::VectorPolys3D(self._load_geometry_polys_3d())
            }
        });

        self.load_geometry()
    }
}

/// Read a single feature given the encoded data
pub fn read_feature(
    data: Vec<u8>,
    extent: Extent,
    cache: Rc<RefCell<ColumnCacheReader>>,
    shape: &Shape,
    m_shape: Shape,
) -> OpenVectorFeature {
    let mut pbf = Protobuf::from_input(RefCell::new(data));
    // pull in the type
    let r#type: FeatureType = pbf.read_varint();
    // next the flags
    let flags: u8 = pbf.read_varint();
    // read the id if it exists
    let id: Option<u64> = if flags & 1 > 0 {
        Some(pbf.read_varint())
    } else {
        None
    };
    let has_bbox = flags & (1 << 1) > 0;
    let has_offsets = (flags & (1 << 2)) > 0;
    let has_indices = flags & (1 << 3) > 0;
    let has_tessellation = flags & (1 << 4) > 0;
    let has_m_values = flags & (1 << 5) > 0;
    let single = flags & (1 << 6) > 0;
    // read the properties
    let value_index: usize = pbf.read_varint();
    let properties = decode_value(value_index, shape, &mut cache.borrow_mut());
    // if type is 1 or 4, read geometry as a single index, otherwise as an array
    let mut geometry_indices: Vec<u32> = vec![];
    let mut indices_index: Option<usize> = None;
    let mut tesselation_index: Option<usize> = None;
    if r#type == FeatureType::Points || r#type == FeatureType::Points3D {
        if single {
            geometry_indices.push(pbf.read_varint())
        } else {
            geometry_indices = cache.borrow_mut().get_indices(pbf.read_varint());
        }
    } else {
        geometry_indices = cache.borrow_mut().get_indices(pbf.read_varint());
    }
    // read indices and tesselation if they exist
    if r#type == FeatureType::Polygons || r#type == FeatureType::Polygons3D {
        if has_indices {
            indices_index = Some(pbf.read_varint());
        }
        if has_tessellation {
            tesselation_index = Some(pbf.read_varint());
        }
    }
    let bbox_index = if has_bbox {
        Some(pbf.read_varint())
    } else {
        None
    };

    OpenVectorFeature {
        id,
        properties,
        r#type,
        cache,
        m_shape,
        extent,
        geometry_indices,
        geometry: None,
        single,
        bbox_index,
        has_offsets,
        has_m_values,
        indices_index,
        tesselation_index,
    }
}

/// Write a single feature to the column cache and return the encoding indexes for lookup
pub fn write_feature(
    feature: &BaseVectorFeature,
    shape: &Shape,
    m_shape: Option<&Shape>,
    cache: &mut ColumnCacheWriter,
) -> Vec<u8> {
    // write id, type, properties, bbox, geometry, indices, tesselation, mValues
    let mut pbf = Protobuf::new();
    // type is just stored as a varint
    pbf.write_varint(feature.get_type());
    // store flags if each one exists or not into a single byte
    let id = feature.id();
    let has_id: bool = id.is_some();
    let indices = feature.indices();
    let has_indices = indices.is_some() && !indices.unwrap().is_empty();
    let tesselation = feature.tesselation();
    let has_tessellation = tesselation.is_some() && !tesselation.as_ref().unwrap().is_empty();
    let has_offsets = feature.has_offsets();
    let bbox = feature.bbox();
    let has_bbox = bbox.is_some();
    let has_m_values = feature.has_m_values();
    let single = feature.single();
    let mut flags: u8 = 0;
    if has_id {
        flags += 1;
    }
    if has_bbox {
        flags += 1 << 1;
    }
    if has_offsets {
        flags += 1 << 2;
    }
    if has_indices {
        flags += 1 << 3;
    }
    if has_tessellation {
        flags += 1 << 4;
    }
    if has_m_values {
        flags += 1 << 5;
    }
    if single {
        flags += 1 << 6;
    }
    pbf.write_varint(flags);
    // id is stored in unsigned column
    if has_id {
        pbf.write_varint(id.unwrap());
    }
    // index to values column
    let value_index = encode_value(feature.properties(), shape, cache);
    pbf.write_varint(value_index);
    // geometry
    let stored_geo = feature.encode_to_cache(cache, m_shape);
    pbf.write_varint(stored_geo);
    // indices
    if has_indices {
        pbf.write_varint(cache.add_indices(feature.indices().unwrap()));
    }
    // tesselation
    if has_tessellation {
        match tesselation.unwrap() {
            TesselationWrapper::Tesselation(t) => pbf.write_varint(cache.add_points(t)),
            TesselationWrapper::Tesselation3D(t) => pbf.write_varint(cache.add_points_3d(t)),
        }
    }
    // bbox is stored in double column.
    if has_bbox {
        pbf.write_varint(cache.add_bbox(bbox.unwrap()));
    }

    pbf.take()
}
