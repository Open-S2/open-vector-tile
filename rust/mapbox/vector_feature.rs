use pbf::{Protobuf, ProtoRead, ProtoWrite, Type, bit_cast::BitCast};

use crate::{Point, VectorGeometry, VectorLineWithOffset, VectorLinesWithOffset, VectorPoints, BBOX};
use crate::open::FeatureType as OpenFeatureType;

use core::cell::RefCell;

use alloc::rc::Rc;
use alloc::vec;
use alloc::vec::Vec;
use alloc::string::String;
use alloc::collections::BTreeMap;

pub struct MapboxVectorFeature {
    pub id: Option<u64>,
    pub version: u16,
    pub properties: Properties,
    pub extent: usize,
    pub r#type: FeatureType,
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
    pub fn new(
        pbf: Rc<RefCell<Protobuf>>,
        is_s2: bool,
        extent: usize,
        version: u16,
        keys: Rc<RefCell<Vec<String>>>,
        values: Rc<RefCell<Vec<Value>>>,
    ) -> MapboxVectorFeature {
        let pbf_clone = pbf.clone();
        let mut mvt = MapboxVectorFeature {
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
        };

        let mut tmp_pbf = pbf_clone.borrow_mut();
        tmp_pbf.read_message::<MapboxVectorFeature>(&mut mvt);

        mvt
    }

    pub fn get_type(&self) -> OpenFeatureType {
        (&self.r#type).into()
    }

    pub fn bbox(&self) -> Option<BBOX> {
        None
    }

    pub fn has_m_values(&self) -> bool {
        false
    }

    /// regardless of the type, we return a flattend point array
    pub fn load_points(&mut self) -> VectorPoints {
        match self.load_geometry() {
            VectorGeometry::VectorPoints(p) => p,
            VectorGeometry::VectorLines(lines) => {
                lines.iter().flat_map(|p| p.geometry.clone()).collect()
            },
            VectorGeometry::VectorPolys(polys) => {
                polys.iter().flat_map(|p| {
                    p.iter().flat_map(|p| p.geometry.clone())
                }).collect()
            },
            _ => { panic!("unexpected geometry type") },
        }
    }

    /// an array of lines. The offsets will be set to 0
    pub fn load_lines(&mut self) -> VectorLinesWithOffset {
        match self.load_geometry() {
            VectorGeometry::VectorLines(lines) => lines,
            VectorGeometry::VectorPolys(polys) => {
                polys.iter().flat_map(|p| p.clone()).collect()
            }
            _ => { panic!("unexpected geometry type") },
        }
    }

    /// (flattened geometry & tesslation if applicable, indices)
    pub fn load_geometry_flat(&mut self) -> (Vec<f64>, Vec<u32>) {
        // build a multiplier
        let multiplier: f64 = 1.0 / self.extent as f64;
        // grab the geometry, flatten it, and mutate to an f64
        let mut geometry: Vec<f64> = match self.load_geometry() {
            VectorGeometry::VectorPolys(polys) => {
                polys.iter().flat_map(|p| {
                    p.iter().flat_map(|p| {
                        p.geometry.clone().into_iter().flat_map(|p| {
                            vec![p.x as f64 * multiplier, p.y as f64 * multiplier]
                        })
                    })
                }).collect()
            },
            _ => { panic!("unexpected geometry type") },
        };
        // if a poly, check if we should load indices
        let indices = self.read_indices();
        // if a poly, check if we should load tesselation
        self.add_tesselation(&mut geometry, multiplier);

        (geometry, indices)
    }

    pub fn load_geometry(&mut self) -> VectorGeometry {
        if let Some(geometry) = &self.geometry { return geometry.clone(); }

        let mut pbf = self.pbf.borrow_mut();
        pbf.set_pos(self.geometry_index);

        let end: usize = pbf.read_varint::<usize>() + self.geometry_index;
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

                if cmd == 1 { // moveTo
                    if !points.is_empty() && self.r#type != FeatureType::Point {
                        lines.push((&points).into());
                        points = vec![];
                    }
                }
                points.push(Point::new(x, y));
            } else if cmd == 4 { // next poly
                if !points.is_empty() { lines.push((&points).into()); }
                polys.push(lines);
                lines = vec![];
                points = vec![];
            } else if cmd == 7 { // close path
                if !points.is_empty() {
                    points.push(points[0].clone());
                    lines.push((&points).into());
                    points = vec![];
                }
            } else {
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
            } else if self.r#type == FeatureType::Polygon && !self.is_s2 {
                VectorGeometry::VectorPolys(classify_rings(&lines))
            } else {
                VectorGeometry::VectorPolys(polys)
            }
        };
    
        self.geometry = Some(geometry.clone());
        geometry
    }

    pub fn read_indices(&mut self) -> Vec<u32> {
        if let Some(indices) = &self.indices {
            return indices.clone();
        } else if self.indices_index.is_none() {
            return vec![];
        }

        let mut pbf = self.pbf.borrow_mut();
        pbf.set_pos(self.indices_index.unwrap());
    
        let mut curr: i32 = 0;
        let end = pbf.read_varint::<usize>() + self.indices_index.unwrap();
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
    pub fn add_tesselation(&mut self, geometry: &mut Vec<f64>, multiplier: f64) {
        if self.tesselation_index.is_none() { return; }

        let mut pbf = self.pbf.borrow_mut();
        pbf.set_pos(self.tesselation_index.unwrap());

        let end = pbf.read_varint::<usize>() + self.tesselation_index.unwrap();
        let mut x = 0;
        let mut y = 0;
        while pbf.get_pos() < end {
            x += pbf.read_s_varint::<i32>();
            y += pbf.read_s_varint::<i32>();
            geometry.push(x as f64 * multiplier);
            geometry.push(y as f64 * multiplier);
        }
    }
}
impl ProtoRead for MapboxVectorFeature {
    fn read(&mut self, tag: u64, pb: &mut Protobuf) {
        match tag {
            15 => self.id = Some(pb.read_varint::<u64>()),
            1 => {
                let end = pb.get_pos() + pb.read_varint::<usize>();

                while pb.get_pos() < end {
                    let key = &self.keys.borrow()[pb.read_varint::<usize>()];
                    let value = &self.values.borrow()[pb.read_varint::<usize>()];
            
                    self.properties.insert(key.clone(), value.clone());
                }
            },
            2 => self.r#type = pb.read_varint::<FeatureType>(),
            3 => self.geometry_index = pb.read_varint::<usize>(),
            4 => self.indices_index = Some(pb.read_varint::<usize>()),
            5 => self.tesselation_index = Some(pb.read_varint::<usize>()),
            _ => panic!("unknown tag: {}", tag),
        }
    }
}

fn classify_rings(
    rings: &VectorLinesWithOffset,
) -> Vec<VectorLinesWithOffset> {
    let mut polygons: Vec<VectorLinesWithOffset> = vec![];
    let mut polygon: VectorLinesWithOffset = vec![];
    let mut ccw: Option<bool> = None;

    let mut i: usize = 0;
    while i < rings.len() {
        let area = signed_area(&rings[i].geometry);
        if area == 0 { continue; }
        if ccw.is_none() { ccw = Some(area < 0); }

        if ccw.is_some() && ccw.unwrap() == (area < 0) { // outer poly ring
            if !polygon.is_empty() {
                polygons.push(polygon.clone());
                polygon = vec![];
            }
            polygon.push(rings[i].clone());
        } else { // inner poly ring (hole)
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
    Point = 1,
    Line = 2,
    Polygon = 3,
    MultiPolygon = 4,
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
            _ => panic!("unknown value: {}", value),
        }
    }
}

/// `Value` is the old type used by Mapbox vector tiles. Properties cannot be nested, so we only
/// support string, number, boolean, and null (None in Rust).
#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    String(String),
    UInt(u64),
    Int(i32),
    SInt(i64),
    Float(f32),
    Double(f64),
    Bool(bool),
    Null,
}
impl ProtoRead for Value {
    fn read(&mut self, tag: u64, pb: &mut Protobuf) {
        match tag {
            0 => *self = Value::Null,
            1 => *self = Value::String(pb.read_string()),
            2 => *self = Value::Float(pb.read_varint::<f32>()),
            3 => *self = Value::Double(pb.read_varint::<f64>()),
            4 => *self = Value::Int(pb.read_s_varint::<i32>()),
            5 => *self = Value::UInt(pb.read_varint::<u64>()),
            6 => *self = Value::SInt(pb.read_s_varint::<i64>()),
            7 => *self = Value::Bool(pb.read_varint::<bool>()),
            _ => panic!("unknown tag: {}", tag),
        }
    }
}
impl ProtoWrite for Value {
    fn write(&self, pbf: &mut Protobuf) {
        match self {
            Value::Null => pbf.write_field(0, Type::None),
            Value::String(value) => pbf.write_string_field(1, value),
            Value::Float(value) => pbf.write_varint_field(2, *value),
            Value::Double(value) => pbf.write_varint_field(3, *value),
            Value::Int(value) => pbf.write_varint_field(4, *value),
            Value::UInt(value) => pbf.write_varint_field(5, *value),
            Value::SInt(value) => pbf.write_s_varint_field(6, *value),
            Value::Bool(value) => pbf.write_varint_field(7, *value),
        }
    }
}

/// `Properties` is a storage structure for the vector feature. Keys are strings, values are
/// any basic type of `Value`.
pub type Properties = BTreeMap<String, Value>;
