use pbf::{BitCast, ProtoRead, ProtoWrite, Protobuf, Type};

use crate::{
    base::{BaseVectorFeature, TesselationWrapper},
    command_encode,
    open::{FeatureType as OpenFeatureType, Properties as OpenProperties},
    zigzag, CustomOrdWrapper, Point, VectorFeatureMethods, VectorGeometry, VectorLineWithOffset,
    VectorLines3DWithOffset, VectorLinesWithOffset, VectorPoints, VectorPoints3D, BBOX,
};

use core::cell::RefCell;

use alloc::collections::BTreeMap;
use alloc::rc::Rc;
use alloc::string::String;
use alloc::vec;
use alloc::vec::Vec;

/// Mapbox specification for a Feature
#[derive(Debug)]
pub struct MapboxVectorFeature {
    /// the id of the feature
    pub id: Option<u64>,
    /// the version of the vector tile
    pub version: u16,
    /// the properties
    pub properties: Properties,
    /// the extent
    pub extent: usize,
    /// the feature type
    pub r#type: FeatureType,
    /// whether the feature is using the S2 spec. This isn't used by most tooling and was replaced by
    /// the open spec
    pub is_s2: bool,
    indices_index: Option<usize>,
    indices: Option<Vec<u32>>,
    geometry_index: usize,
    geometry: Option<VectorGeometry>,
    tesselation_index: Option<usize>,
    keys: Rc<RefCell<Vec<String>>>,
    values: Rc<RefCell<Vec<Value>>>,
    pbf: Rc<RefCell<Protobuf>>,
}
impl MapboxVectorFeature {
    /// Create a new MapboxVectorFeature
    pub fn new(
        pbf: Rc<RefCell<Protobuf>>,
        is_s2: bool,
        extent: usize,
        version: u16,
        keys: Rc<RefCell<Vec<String>>>,
        values: Rc<RefCell<Vec<Value>>>,
    ) -> MapboxVectorFeature {
        MapboxVectorFeature {
            id: None,
            version,
            properties: Properties::new(),
            extent,
            r#type: FeatureType::Point,
            is_s2,
            // tmp pbf until after reading in attributes
            indices_index: None,
            indices: None,
            geometry_index: 0,
            geometry: None,
            tesselation_index: None,
            keys,
            values,
            pbf,
        }
    }
}
impl VectorFeatureMethods for MapboxVectorFeature {
    /// get the feature id
    fn id(&self) -> Option<u64> {
        self.id
    }

    /// get the feature version
    fn version(&self) -> u16 {
        self.version
    }

    /// get the feature properties
    fn properties(&self) -> OpenProperties {
        (&self.properties).into()
    }

    /// get the feature extent
    fn extent(&self) -> usize {
        self.extent
    }

    /// get the feature type
    fn get_type(&self) -> OpenFeatureType {
        (&self.r#type).into()
    }

    /// get the bbox
    fn bbox(&self) -> Option<BBOX> {
        None
    }

    /// whether the feature has m values
    fn has_m_values(&self) -> bool {
        false
    }

    /// whether the feature is a points type
    fn is_points(&self) -> bool {
        self.r#type == FeatureType::Point
    }

    /// whether the feature is a line type
    fn is_lines(&self) -> bool {
        self.r#type == FeatureType::Line
    }

    /// whether the feature is a polygon type
    fn is_polygons(&self) -> bool {
        self.r#type == FeatureType::Polygon || self.r#type == FeatureType::MultiPolygon
    }

    /// whether the feature is a points 3D type
    fn is_points_3d(&self) -> bool {
        false
    }

    /// whether the feature is a line 3D type
    fn is_lines_3d(&self) -> bool {
        false
    }

    /// whether the feature is a polygon 3D type
    fn is_polygons_3d(&self) -> bool {
        false
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
                .flat_map(|p| p.iter().flat_map(|p| p.geometry[..p.geometry.len() - 1].to_vec()))
                .collect(),
            #[tarpaulin::skip]
            _ => panic!("unexpected geometry type"),
        }
    }

    #[tarpaulin::skip]
    fn load_points_3d(&mut self) -> VectorPoints3D {
        panic!("unexpected geometry type")
    }

    /// an array of lines. The offsets will be set to 0
    fn load_lines(&mut self) -> VectorLinesWithOffset {
        match self.load_geometry() {
            VectorGeometry::VectorLines(lines) => lines,
            VectorGeometry::VectorPolys(polys) => polys.iter().flat_map(|p| p.clone()).collect(),
            #[tarpaulin::skip]
            _ => panic!("unexpected geometry type"),
        }
    }

    /// an array of 3D lines. The offsets will be set to 0
    #[tarpaulin::skip]
    fn load_lines_3d(&mut self) -> VectorLines3DWithOffset {
        panic!("unexpected geometry type")
    }

    /// (flattened geometry & tesslation if applicable, indices)
    fn load_geometry_flat(&mut self) -> (Vec<f64>, Vec<u32>) {
        // build a multiplier
        let multiplier: f64 = 1.0 / self.extent as f64;
        // grab the geometry, flatten it, and mutate to an f64
        let mut geometry: Vec<f64> = match self.load_geometry() {
            VectorGeometry::VectorPolys(polys) => polys
                .iter()
                .flat_map(|p| {
                    p.iter().flat_map(|p| {
                        p.geometry
                            .clone()
                            .into_iter()
                            .flat_map(|p| vec![p.x as f64 * multiplier, p.y as f64 * multiplier])
                    })
                })
                .collect(),
            #[tarpaulin::skip]
            _ => panic!("unexpected geometry type"),
        };
        // if a poly, check if we should load indices
        let indices = self.read_indices();
        // if a poly, check if we should load tesselation
        self.add_tesselation(&mut geometry, multiplier);

        (geometry, indices)
    }

    /// load the geometry
    fn load_geometry(&mut self) -> VectorGeometry {
        if let Some(geometry) = &self.geometry {
            return geometry.clone();
        }

        let mut pbf = self.pbf.borrow_mut();
        pbf.set_pos(self.geometry_index);

        let end: usize = pbf.read_varint::<usize>() + pbf.get_pos();
        let mut cmd: usize = 1;
        let mut length: isize = 0;
        let mut x: i32 = 0;
        let mut y: i32 = 0;

        let mut points: VectorPoints = vec![];
        let mut lines: VectorLinesWithOffset = vec![];
        let mut polys: Vec<VectorLinesWithOffset> = vec![];

        while pbf.get_pos() < end {
            if length <= 0 {
                let cmd_len: usize = pbf.read_varint();
                cmd = cmd_len & 0x7;
                length = (cmd_len >> 3) as isize;
            }

            length -= 1;

            if cmd == 1 || cmd == 2 {
                x += pbf.read_s_varint::<i32>();
                y += pbf.read_s_varint::<i32>();

                if cmd == 1 {
                    // moveTo
                    if !points.is_empty() && self.r#type != FeatureType::Point {
                        lines.push((&points[..]).into());
                        points = vec![];
                    }
                }
                points.push(Point::new(x, y));
            } else if cmd == 4 {
                // close poly
                if !points.is_empty() {
                    lines.push((&points[..]).into());
                }
                polys.push(lines);
                lines = vec![];
                points = vec![];
            } else if cmd == 7 {
                // close path
                if !points.is_empty() {
                    points.push(points[0].clone());
                    lines.push((&points[..]).into());
                    points = vec![];
                }
            } else {
                #[tarpaulin::skip]
                panic!("unknown cmd: {}", cmd);
            }
        }

        let geometry = if self.r#type == FeatureType::Point {
            VectorGeometry::VectorPoints(points)
        } else {
            if !points.is_empty() {
                lines.push(VectorLineWithOffset::new(0.0, points.clone()));
            }
            if self.r#type == FeatureType::Line {
                VectorGeometry::VectorLines(lines)
            } else if (self.r#type == FeatureType::MultiPolygon
                || self.r#type == FeatureType::Polygon)
                && !self.is_s2
            {
                VectorGeometry::VectorPolys(classify_rings(&lines))
            } else {
                VectorGeometry::VectorPolys(polys)
            }
        };

        self.geometry = Some(geometry.clone());
        geometry
    }

    /// load the indices
    fn read_indices(&mut self) -> Vec<u32> {
        if let Some(indices) = &self.indices {
            return indices.clone();
        } else if self.indices_index.is_none() {
            return vec![];
        }

        let mut pbf = self.pbf.borrow_mut();
        pbf.set_pos(self.indices_index.unwrap());

        let mut curr: i32 = 0;
        let end = pbf.read_varint::<usize>() + pbf.get_pos();
        // build indices
        let mut indices: Vec<u32> = vec![];
        while pbf.get_pos() < end {
            curr += pbf.read_s_varint::<i32>();
            indices.push(curr as u32);
        }

        self.indices = Some(indices.clone());
        indices
    }

    /// Add tesselation data to the geometry
    fn add_tesselation(&mut self, geometry: &mut Vec<f64>, multiplier: f64) {
        if self.tesselation_index.is_none() {
            return;
        }

        let mut pbf = self.pbf.borrow_mut();
        pbf.set_pos(self.tesselation_index.unwrap());

        let end = pbf.read_varint::<usize>() + pbf.get_pos();
        let mut x = 0;
        let mut y = 0;
        while pbf.get_pos() < end {
            x += pbf.read_s_varint::<i32>();
            y += pbf.read_s_varint::<i32>();
            geometry.push(x as f64 * multiplier);
            geometry.push(y as f64 * multiplier);
        }
    }

    /// Add 3D tesselation data to the geometry
    #[tarpaulin::skip]
    fn add_tesselation_3d(&mut self, _geometry: &mut Vec<f64>, _multiplier: f64) {
        panic!("unexpected geometry type")
    }
}
impl ProtoRead for MapboxVectorFeature {
    fn read(&mut self, tag: u64, pb: &mut Protobuf) {
        if self.is_s2 {
            match tag {
                15 => self.id = Some(pb.read_varint::<u64>()),
                1 => {
                    let end = pb.get_pos() + pb.read_varint::<usize>();

                    while pb.get_pos() < end {
                        let key = &self.keys.borrow()[pb.read_varint::<usize>()];
                        let value = &self.values.borrow()[pb.read_varint::<usize>()];

                        self.properties.insert(key.clone(), value.clone());
                    }
                }
                2 => self.r#type = pb.read_varint::<FeatureType>(),
                3 => self.geometry_index = pb.get_pos(),
                4 => self.indices_index = Some(pb.get_pos()),
                5 => self.tesselation_index = Some(pb.get_pos()),
                #[tarpaulin::skip]
                _ => panic!("unknown tag: {}", tag),
            }
        } else {
            match tag {
                1 => self.id = Some(pb.read_varint::<u64>()),
                2 => {
                    let end = pb.get_pos() + pb.read_varint::<usize>();

                    while pb.get_pos() < end {
                        let key = &self.keys.borrow()[pb.read_varint::<usize>()];
                        let value = &self.values.borrow()[pb.read_varint::<usize>()];

                        self.properties.insert(key.clone(), value.clone());
                    }
                }
                3 => self.r#type = pb.read_varint::<FeatureType>(),
                4 => self.geometry_index = pb.get_pos(),
                5 => self.indices_index = Some(pb.get_pos()),
                6 => self.tesselation_index = Some(pb.get_pos()),
                #[tarpaulin::skip]
                _ => panic!("unknown tag: {}", tag),
            }
        }
    }
}

fn classify_rings(rings: &VectorLinesWithOffset) -> Vec<VectorLinesWithOffset> {
    let mut polygons: Vec<VectorLinesWithOffset> = vec![];
    let mut polygon: VectorLinesWithOffset = vec![];
    let mut ccw: Option<bool> = None;

    let mut i: usize = 0;
    while i < rings.len() {
        let area = signed_area(&rings[i].geometry);
        if area == 0 {
            continue;
        }
        if ccw.is_none() {
            ccw = Some(area < 0);
        }

        if ccw.is_some() && ccw.unwrap() == (area < 0) {
            // outer poly ring
            if !polygon.is_empty() {
                polygons.push(polygon.clone());
                polygon = vec![];
            }
            polygon.push(rings[i].clone());
        } else {
            // inner poly ring (hole)
            polygon.push(rings[i].clone());
        }

        i += 1
    }
    if !polygon.is_empty() {
        polygons.push(polygon.clone());
    }

    polygons
}

fn signed_area(ring: &[Point]) -> i32 {
    let mut sum: i32 = 0;
    let mut i: usize = 0;
    let mut j = ring.len() - 1;
    while i < ring.len() {
        let p1 = &ring[i];
        let p2 = &ring[j];
        sum += (p2.x - p1.x) * (p1.y + p2.y);

        j = i;
        i += 1;
    }

    sum
}

/// Mapbox Vector Feature types.
#[derive(Debug, Clone, PartialEq)]
pub enum FeatureType {
    /// Point Feature
    Point = 1,
    /// Line Feature
    Line = 2,
    /// Polygon Feature
    Polygon = 3,
    /// MultiPolygon Feature
    MultiPolygon = 4,
}
impl From<OpenFeatureType> for FeatureType {
    fn from(value: OpenFeatureType) -> Self {
        match value {
            OpenFeatureType::Points => FeatureType::Point,
            OpenFeatureType::Lines => FeatureType::Line,
            OpenFeatureType::Polygons => FeatureType::MultiPolygon,
            #[tarpaulin::skip]
            _ => panic!("unknown value: {:?}", value),
        }
    }
}
impl BitCast for FeatureType {
    fn to_u64(&self) -> u64 {
        (*self).clone() as u64
    }
    fn from_u64(value: u64) -> Self {
        match value {
            1 => FeatureType::Point,
            2 => FeatureType::Line,
            3 => FeatureType::Polygon,
            4 => FeatureType::MultiPolygon,
            #[tarpaulin::skip]
            _ => panic!("unknown value: {}", value),
        }
    }
}

/// `Value` is the old type used by Mapbox vector tiles. Properties cannot be nested, so we only
/// support string, number, boolean, and null (None in Rust).
#[derive(Debug, Clone, PartialEq, Ord, PartialOrd, Eq)]
pub enum Value {
    /// String value
    String(String),
    /// Unsigned integer value
    UInt(u64),
    /// Signed integer 64-bit value
    SInt(i64),
    /// 32-bit Floating point value
    Float(CustomOrdWrapper<f32>),
    /// 64-bit Floating point value
    Double(CustomOrdWrapper<f64>),
    /// Boolean value
    Bool(bool),
    /// Null value
    Null,
}
impl ProtoRead for Value {
    fn read(&mut self, tag: u64, pb: &mut Protobuf) {
        match tag {
            0 => *self = Value::Null,
            1 => *self = Value::String(pb.read_string()),
            2 => *self = Value::Float(CustomOrdWrapper(pb.read_varint::<f32>())),
            3 => *self = Value::Double(CustomOrdWrapper(pb.read_varint::<f64>())),
            5 => *self = Value::UInt(pb.read_varint::<u64>()),
            4 | 6 => *self = Value::SInt(pb.read_s_varint::<i64>()),
            7 => *self = Value::Bool(pb.read_varint::<bool>()),
            #[tarpaulin::skip]
            _ => *self = Value::Null,
        }
    }
}
impl ProtoWrite for Value {
    fn write(&self, pbf: &mut Protobuf) {
        match self {
            Value::Null => pbf.write_field(0, Type::None),
            Value::String(value) => pbf.write_string_field(1, value),
            Value::Float(value) => pbf.write_varint_field(2, value.0),
            Value::Double(value) => pbf.write_varint_field(3, value.0),
            Value::UInt(value) => pbf.write_varint_field(5, *value),
            Value::SInt(value) => pbf.write_s_varint_field(6, *value),
            Value::Bool(value) => pbf.write_varint_field(7, *value),
        }
    }
}

/// `Properties` is a storage structure for the vector feature. Keys are strings, values are
/// any basic type of `Value`.
pub type Properties = BTreeMap<String, Value>;

/// Write a feature to a protobuffer using the S2 Specification
pub fn write_feature(
    feature: &BaseVectorFeature,
    keys: &mut BTreeMap<String, usize>,
    values: &mut BTreeMap<Value, usize>,
    mapbox_support: bool,
) -> Vec<u8> {
    let mut pbf = Protobuf::new();

    let properties: Properties = feature.properties().clone().into();
    if let Some(id) = feature.id() {
        pbf.write_varint_field(if mapbox_support { 1 } else { 15 }, id);
    }
    pbf.write_bytes_field(
        if mapbox_support { 2 } else { 1 },
        &write_properties(&properties, keys, values),
    );
    let _type: FeatureType = feature.get_type().into();
    pbf.write_varint_field(if mapbox_support { 3 } else { 2 }, _type);
    // Geometry
    let written = write_geometry(feature, mapbox_support);
    pbf.write_bytes_field(if mapbox_support { 4 } else { 3 }, &written);
    // Indices
    if let Some(indices) = feature.indices() {
        pbf.write_bytes_field(if mapbox_support { 5 } else { 4 }, &write_indices(&indices));
    }
    // Tesselation
    if let Some(TesselationWrapper::Tesselation(tess)) = feature.tesselation() {
        pbf.write_bytes_field(if mapbox_support { 6 } else { 5 }, &write_tesselation(&tess));
    }

    pbf.take()
}

/// Write a properties to a protobuffer using the S2 Specification
fn write_properties(
    properties: &Properties,
    keys: &mut BTreeMap<String, usize>,
    values: &mut BTreeMap<Value, usize>,
) -> Vec<u8> {
    let mut pbf = Protobuf::new();

    for (key, value) in properties {
        let key_length = keys.len();
        let key_index = keys.entry(key.clone()).or_insert(key_length);
        pbf.write_varint(*key_index);
        let value_length = values.len();
        let value_index = values.entry(value.clone()).or_insert(value_length);
        pbf.write_varint(*value_index);
    }

    pbf.take()
}

/// write the indices to a protobuffer using the S2 Specification
fn write_indices(indices: &[u32]) -> Vec<u8> {
    let mut pbf = Protobuf::new();

    let mut curr: i32 = 0;
    for index in indices {
        let d_curr = (*index as i32) - curr;
        pbf.write_varint(zigzag(d_curr));
        curr += d_curr;
    }

    pbf.take()
}

/// write the tesselation to a protobuffer using the S2 Specification
fn write_tesselation(geometry: &[Point]) -> Vec<u8> {
    let mut pbf = Protobuf::new();
    let mut x = 0;
    let mut y = 0;
    for point in geometry {
        let dx = point.x - x;
        let dy = point.y - y;
        pbf.write_varint(zigzag(dx));
        pbf.write_varint(zigzag(dy));
        x += dx;
        y += dy;
    }

    pbf.take()
}

/// write the geometry to a protobuffer using the S2 Specification
fn write_geometry(feature: &BaseVectorFeature, mapbox_support: bool) -> Vec<u8> {
    use BaseVectorFeature::*;
    let mut pbf = Protobuf::new();
    match feature {
        BaseVectorPointsFeature(points) => write_geometry_points(&points.geometry, &mut pbf),
        BaseVectorLinesFeature(lines) => write_geometry_lines(&lines.geometry, &mut pbf),
        BaseVectorPolysFeature(polys) => {
            write_geometry_polys(&polys.geometry, &mut pbf, mapbox_support)
        }
        #[tarpaulin::skip]
        _ => panic!("unknown feature type: {:?}", feature.get_type()),
    };
    pbf.take()
}

/// write the points geometry to a protobuffer using the S2 Specification
fn write_geometry_points(points: &[Point], pbf: &mut Protobuf) {
    let mut x = 0;
    let mut y = 0;

    for point in points {
        // move
        pbf.write_varint(command_encode(1, 1)); // moveto
                                                // store
        let dx = point.x - x;
        let dy = point.y - y;
        pbf.write_varint(zigzag(dx));
        pbf.write_varint(zigzag(dy));
        // update position
        x += dx;
        y += dy;
    }
}

/// write the lines geometry to a protobuffer using the S2 Specification
fn write_geometry_lines(lines: &[VectorLineWithOffset], pbf: &mut Protobuf) {
    let mut x = 0;
    let mut y = 0;

    for line in lines {
        let line_geo = &line.geometry;
        pbf.write_varint(command_encode(1, 1)); // moveto
                                                // do not write polygon closing path as lineto
        let line_count = line_geo.len();
        let mut i = 0;
        while i < line_count {
            if i == 1 {
                pbf.write_varint(command_encode(2, (line_count - 1).try_into().unwrap()));
                // lineto
            }

            let point = &line_geo[i];
            let dx = point.x - x;
            let dy = point.y - y;
            pbf.write_varint(zigzag(dx));
            pbf.write_varint(zigzag(dy));
            x += dx;
            y += dy;

            i += 1;
        }
    }
}

/// write the polys geometry to a protobuffer using the S2 Specification
fn write_geometry_polys(
    polys: &[Vec<VectorLineWithOffset>],
    pbf: &mut Protobuf,
    mapbox_support: bool,
) {
    let mut x = 0;
    let mut y = 0;

    for poly in polys {
        for ring in poly {
            let ring_geo = &ring.geometry;
            pbf.write_varint(command_encode(1, 1)); // moveto
            let line_count = ring_geo.len() - 1;
            let mut i = 0;
            while i < line_count {
                if i == 1 {
                    pbf.write_varint(command_encode(2, (line_count - 1).try_into().unwrap()));
                    // lineto
                }

                let point = &ring_geo[i];
                let dx = point.x - x;
                let dy = point.y - y;
                pbf.write_varint(zigzag(dx));
                pbf.write_varint(zigzag(dy));
                x += dx;
                y += dy;

                i += 1;
            }
            pbf.write_varint(command_encode(7, 1)); // ClosePath
        }
        // ClosePolygon (Mapbox does not support so close path if not supported)
        pbf.write_varint(command_encode(if mapbox_support { 7 } else { 4 }, 1));
    }
}
