use crate::{
    delta_decode_array, delta_encode_array, unweave_and_delta_decode_3d_array,
    unweave_and_delta_decode_array, weave_and_delta_encode_3d_array, weave_and_delta_encode_array,
    CustomOrdWrapper, Point, Point3D, VectorPoints, VectorPoints3D, BBOX,
};

use pbf::{ProtoRead, ProtoWrite, Protobuf};

use alloc::collections::BTreeMap;
use alloc::string::String;
use alloc::vec::Vec;
use core::cell::RefCell;

/// Column Types take up 3 bits.
/// ColumnNames define various common data structures to be stored in a column fashion
#[derive(Debug, Default, Clone, PartialEq, PartialOrd, Eq, Ord)]
pub enum OColumnName {
    /// stores string values
    #[default]
    String = 0,
    /// Note: IDs are stored in unsigned
    /// Number types are sorted prior to storing
    Unsigned = 1,
    /// Number types are sorted prior to storing
    Signed = 2,
    /// Floating precision helps ensure only 32 bit cost
    /// Number types are sorted prior to storing
    Float = 3,
    /// worst case, no compression
    /// Number types are sorted prior to storing
    Double = 4,
    /// points is an array of { x: number, y: number }
    /// points also stores lines.
    /// if a line is stored, note that it has an acompanying offset and potentially mValues
    /// Polygons are stored as a collection of lines.
    /// The points feature type that has more than one will be stored here as well.
    Points = 5,
    /// points3D is an array of { x: number, y: number, z: number }
    /// points3D also stores lines.
    /// if a line is stored, note that it has an acompanying offset and potentially mValues
    /// Polygons are stored as a collection of lines.
    /// The points 3D feature type that has more than one will be stored here as well.
    Points3D = 6,
    /// store M-Value, Shape, and Value encodings
    /// store geometry shapes.
    /// store geometry indices.
    Indices = 7,
    /// Shapes describe how to rebuild objects
    Shapes = 8,
    /// BBox - specially compressed to reduce byte cost. each value is only 3 bytes worst case
    /// BBox3D - specially compressed to reduce byte cost. each value is only 3 bytes worst case.
    /// The z values are stored as floats and cost 4 bytes.
    BBox = 9,
}
impl From<u8> for OColumnName {
    fn from(value: u8) -> Self {
        match value {
            0 => OColumnName::String,
            1 => OColumnName::Unsigned,
            2 => OColumnName::Signed,
            3 => OColumnName::Float,
            4 => OColumnName::Double,
            5 => OColumnName::Points,
            6 => OColumnName::Points3D,
            7 => OColumnName::Indices,
            8 => OColumnName::Shapes,
            9 => OColumnName::BBox,
            _ => OColumnName::String,
        }
    }
}
impl From<OColumnName> for u64 {
    fn from(col: OColumnName) -> Self {
        col as u64
    }
}

//? READING

/// note: base1 type allows you to decode as needed for each grouping of data.
/// for instance OColumnString is an array of strings, but you may only need a few strings on use.
/// Store either data itself or a reference to the position in the protobuf to deserialize
#[derive(Debug)]
pub enum ColumnContainer<T> {
    /// reference to a position in the protobuf
    Pos(usize),
    /// data itself
    Data(T),
}

/// Column Cache Reader
/// Stores all data in a column format.
/// Upon construction, all columns are decoded from the protobuf.
/// This allows for quick and easy access to data in a column format.
#[derive(Debug, Default)]
pub struct ColumnCacheReader {
    /// strings are stored in a column of strings
    string: Vec<String>,
    /// unsigned whole numbers are stored in unsigned
    unsigned: Vec<u64>,
    /// negative numbers are stored in signed
    signed: Vec<i64>,
    /// non-whole 32-bit numbers are stored in float
    float: Vec<f32>,
    /// non-whole numbers greater than 32-bit are stored in double
    double: Vec<f64>,
    /// for geometry types each column is individually weaved and delta encoded
    points: Vec<VectorPoints>,
    /// for geometry types each column is individually weaved and delta encoded
    points_3d: Vec<VectorPoints3D>,
    /// store M-Value indices>, geometry indices>, and geometry shapes
    indices: Vec<Vec<u32>>,
    /// shapes and possibly value indices are stored in a number[] to be decoded by readShape
    shapes: Vec<Vec<usize>>,
    /// Stores both BBox and BBox3D in a single column
    bbox: Vec<BBOX>,
}
impl ColumnCacheReader {
    /// create an instance
    pub fn new() -> Self {
        ColumnCacheReader {
            ..Default::default()
        }
    }

    /// get a string
    pub fn get_string(&mut self, index: usize) -> String {
        self.string[index].clone()
    }

    /// get an unsigned integer
    pub fn get_unsigned(&self, index: usize) -> u64 {
        self.unsigned[index]
    }

    /// get a signed integer
    pub fn get_signed(&self, index: usize) -> i64 {
        self.signed[index]
    }

    /// get a float
    pub fn get_float(&self, index: usize) -> f32 {
        self.float[index]
    }

    /// get a double
    pub fn get_double(&self, index: usize) -> f64 {
        self.double[index]
    }

    /// get a vector of points used by all geometry types
    pub fn get_points(&mut self, index: usize) -> VectorPoints {
        self.points[index].clone()
    }

    /// get a vector of 3D points used by all geometry types
    pub fn get_points_3d(&mut self, index: usize) -> VectorPoints3D {
        self.points_3d[index].clone()
    }

    /// get a vector of indices used by all geometry types
    pub fn get_indices(&mut self, index: usize) -> Vec<u32> {
        self.indices[index].clone()
    }

    /// get a vector of encoded data that helps decode shapes
    pub fn get_shapes(&mut self, index: usize) -> Vec<usize> {
        self.shapes[index].clone()
    }

    /// get a BBox
    pub fn get_bbox(&mut self, index: usize) -> BBOX {
        self.bbox[index]
    }
}
impl ProtoRead for ColumnCacheReader {
    fn read(&mut self, tag: u64, pb: &mut Protobuf) {
        match tag {
            0 => self.string.push(pb.read_string()),
            1 => self.unsigned.push(pb.read_varint::<u64>()),
            2 => self.signed.push(pb.read_s_varint::<i64>()),
            3 => self.float.push(pb.read_varint::<f32>()),
            4 => self.double.push(pb.read_varint::<f64>()),
            5 => self
                .points
                .push(unweave_and_delta_decode_array(&pb.read_packed::<u64>())),
            6 => self
                .points_3d
                .push(unweave_and_delta_decode_3d_array(&pb.read_packed::<u64>())),
            7 => self
                .indices
                .push(delta_decode_array(&pb.read_packed::<u32>())),
            8 => self.shapes.push(pb.read_packed::<usize>()),
            9 => self.bbox.push((&pb.read_packed::<u8>()[..]).into()),
            _ => panic!("Unknown column type"),
        }
    }
}

//? WRITING

/// Numbers track their own index for sorting purposes
#[derive(Debug, Default, Clone, PartialEq, PartialOrd, Eq, Ord)]
pub struct OColumnBaseChunk {
    /// The index in the column. Will be updated during the writing phase when converted
    /// from a map to an array
    pub index: usize,
    /// track how many times this chunk is reused
    pub count: usize,
}
/// A value is a collection of lookup devices. A number is decoded by the appropriate function,
/// but the object is a reference to one of the number columns.
/// Number types are eventually sorted, so we track the column and index with the data.
#[derive(Debug, Clone, PartialEq, PartialOrd, Eq, Ord)]
pub enum ColumnValue {
    /// raw number index pointing to a location in the cache column
    Number(usize),
    /// a reference to a column
    Column(RefCell<OColumnBaseChunk>),
}
impl From<usize> for ColumnValue {
    fn from(index: usize) -> Self {
        ColumnValue::Number(index)
    }
}
impl From<RefCell<OColumnBaseChunk>> for ColumnValue {
    fn from(chunk: RefCell<OColumnBaseChunk>) -> Self {
        ColumnValue::Column(chunk)
    }
}
/// A building block for all column types.
pub type OColumnBaseWrite<K> = BTreeMap<K, RefCell<OColumnBaseChunk>>;

/// A building block for all number column types.
pub type OColumnBaseFloatWrite<K> = BTreeMap<CustomOrdWrapper<K>, RefCell<OColumnBaseChunk>>;

/// The cache where all data is stored in a column format.
/// Each column type has its own array of data.
/// Number types maintain their own index for sorting purposes.
#[derive(Debug, Default)]
pub struct ColumnCacheWriter {
    /// strings are grouped by their bytes.
    string: OColumnBaseWrite<String>,
    /// Unsigned integers are sorted prior to storing
    unsigned: OColumnBaseWrite<u64>,
    /// Signed integers are sorted prior to storing
    signed: OColumnBaseWrite<i64>,
    /// 32-bit partial values are sorted prior to storing
    float: OColumnBaseFloatWrite<f32>,
    /// 64-bit partial values are sorted prior to storing
    double: OColumnBaseFloatWrite<f64>,
    /// for geometry types each column is individually weaved and delta encoded
    points: OColumnBaseWrite<Vec<Point>>,
    /// for geometry types each column is individually weaved and delta encoded
    points_3d: OColumnBaseWrite<Vec<Point3D>>,
    /// Indices track geometry indices, geometry shapes, or other indexing data
    indices: OColumnBaseWrite<Vec<u32>>,
    /// Contains number arrays of how to rebuild objects
    shapes: OColumnBaseWrite<Vec<ColumnValue>>,
    /// Features should be sorted by id prior to building a column
    bbox: OColumnBaseWrite<BBOX>,
}
impl ColumnCacheWriter {
    /// add string to cache
    pub fn add_string(&mut self, value: String) -> usize {
        add(&mut self.string, value)
    }

    /// add u64 to cache
    pub fn add_u64(&mut self, value: u64) -> RefCell<OColumnBaseChunk> {
        add_number(&mut self.unsigned, value)
    }

    /// add i64 to cache
    pub fn add_i64(&mut self, value: i64) -> RefCell<OColumnBaseChunk> {
        add_number(&mut self.signed, value)
    }

    /// add f32 to cache
    pub fn add_f32(&mut self, value: f32) -> RefCell<OColumnBaseChunk> {
        add_number(&mut self.float, CustomOrdWrapper(value))
    }

    /// add f64 to cache
    pub fn add_f64(&mut self, value: f64) -> RefCell<OColumnBaseChunk> {
        add_number(&mut self.double, CustomOrdWrapper(value))
    }

    /// add points to cache
    pub fn add_points(&mut self, value: Vec<Point>) -> usize {
        add(&mut self.points, value)
    }

    /// add points_3d to cache
    pub fn add_points_3d(&mut self, value: Vec<Point3D>) -> usize {
        add(&mut self.points_3d, value)
    }

    /// add indices to cache
    pub fn add_indices(&mut self, value: Vec<u32>) -> usize {
        add(&mut self.indices, value)
    }

    /// add shapes to cache
    pub fn add_shapes(&mut self, value: Vec<ColumnValue>) -> usize {
        add(&mut self.shapes, value)
    }

    /// add bbox to cache
    pub fn add_bbox(&mut self, value: BBOX) -> usize {
        add(&mut self.bbox, value)
    }
}
impl ProtoWrite for ColumnCacheWriter {
    fn write(&self, pbf: &mut Protobuf) {
        // setup
        let mut strings: Vec<(&String, &RefCell<OColumnBaseChunk>)> = self.string.iter().collect();
        let mut unsigned: Vec<(&u64, &RefCell<OColumnBaseChunk>)> = self.unsigned.iter().collect();
        let mut signed: Vec<(&i64, &RefCell<OColumnBaseChunk>)> = self.signed.iter().collect();
        let mut float: Vec<(&CustomOrdWrapper<f32>, &RefCell<OColumnBaseChunk>)> =
            self.float.iter().collect();
        let mut double: Vec<(&CustomOrdWrapper<f64>, &RefCell<OColumnBaseChunk>)> =
            self.double.iter().collect();
        let mut points: Vec<(&Vec<Point>, &RefCell<OColumnBaseChunk>)> =
            self.points.iter().collect();
        let mut points_3d: Vec<(&Vec<Point3D>, &RefCell<OColumnBaseChunk>)> =
            self.points_3d.iter().collect();
        let mut indices: Vec<(&Vec<u32>, &RefCell<OColumnBaseChunk>)> =
            self.indices.iter().collect();
        let mut shapes: Vec<(&Vec<ColumnValue>, &RefCell<OColumnBaseChunk>)> =
            self.shapes.iter().collect();
        let mut bbox: Vec<(&BBOX, &RefCell<OColumnBaseChunk>)> = self.bbox.iter().collect();

        // sort them
        // TODO: bring this back
        // sort_column(&mut unsigned);
        // sort_column(&mut signed);
        // sort_column(&mut float);
        // sort_column(&mut double);
        strings.sort_by(|a, b| a.1.borrow().index.cmp(&b.1.borrow().index));
        unsigned.sort_by(|a, b| a.1.borrow().index.cmp(&b.1.borrow().index));
        signed.sort_by(|a, b| a.1.borrow().index.cmp(&b.1.borrow().index));
        float.sort_by(|a, b| a.1.borrow().index.cmp(&b.1.borrow().index));
        double.sort_by(|a, b| a.1.borrow().index.cmp(&b.1.borrow().index));
        points.sort_by(|a, b| a.1.borrow().index.cmp(&b.1.borrow().index));
        points_3d.sort_by(|a, b| a.1.borrow().index.cmp(&b.1.borrow().index));
        indices.sort_by(|a, b| a.1.borrow().index.cmp(&b.1.borrow().index));
        shapes.sort_by(|a, b| a.1.borrow().index.cmp(&b.1.borrow().index));
        bbox.sort_by(|a, b| a.1.borrow().index.cmp(&b.1.borrow().index));

        // store
        // strings
        for string in strings {
            pbf.write_string_field(OColumnName::String.into(), string.0);
        }
        // u64
        for u in unsigned {
            pbf.write_varint_field(OColumnName::Unsigned.into(), *u.0);
        }
        // i64
        for s in signed {
            pbf.write_s_varint_field(OColumnName::Signed.into(), *s.0);
        }
        // f32
        for f in float {
            pbf.write_varint_field(OColumnName::Float.into(), f.0 .0);
        }
        // f64
        for d in double {
            pbf.write_varint_field(OColumnName::Double.into(), d.0 .0);
        }
        // points
        for p in points {
            pbf.write_packed_varint(
                OColumnName::Points.into(),
                &weave_and_delta_encode_array(p.0),
            );
        }
        // points 3D
        for p_3d in points_3d {
            pbf.write_packed_varint(
                OColumnName::Points3D.into(),
                &weave_and_delta_encode_3d_array(p_3d.0),
            );
        }
        // indices
        for i in indices {
            pbf.write_packed_varint(OColumnName::Indices.into(), &delta_encode_array(i.0));
        }
        // shapes
        for s in shapes {
            let packed: Vec<usize> =
                s.0.iter()
                    .map(|v| match v {
                        ColumnValue::Number(n) => *n,
                        ColumnValue::Column(c) => c.borrow().index,
                    })
                    .collect();
            pbf.write_packed_varint(OColumnName::Shapes.into(), &packed);
        }
        // bbox
        for bbox in bbox {
            pbf.write_packed_varint(OColumnName::BBox.into(), &bbox.0.quantize());
        }
    }
}

/// Add value to column and return index
pub fn add<T>(col: &mut OColumnBaseWrite<T>, value: T) -> usize
where
    T: Ord,
{
    if let Some(col) = col.get_mut(&value) {
        let mut chunk = col.borrow_mut();
        chunk.count += 1;
        chunk.index
    } else {
        let index = col.len();
        col.insert(value, RefCell::new(OColumnBaseChunk { index, count: 1 }));
        index
    }
}

/// Add a **number** value to column and return index
pub fn add_number<T>(col: &mut OColumnBaseWrite<T>, value: T) -> RefCell<OColumnBaseChunk>
where
    T: Ord,
{
    if let Some(chunk) = col.get_mut(&value) {
        {
            let mut chunk_mut = chunk.borrow_mut();
            chunk_mut.count += 1;
        }
        chunk.clone()
    } else {
        let index = col.len();
        let new_chunk = RefCell::new(OColumnBaseChunk { index, count: 1 });
        col.insert(value, new_chunk.clone());
        new_chunk
    }
}

// /// Sort number types and value types by index then update the index of each row for better
// /// compression down the line.
// pub fn sort_column<T: CustomOrd + core::fmt::Debug>(
//     input: &mut [(&T, &RefCell<OColumnBaseChunk>)],
// ) {
//     // first sort
//     input.sort_by(|a, b| {
//         // First sort by count in descending order
//         match b.1.borrow().count.cmp(&a.1.borrow().count) {
//             Ordering::Equal => a.0.custom_cmp(b.0), // Then sort by data if counts are equal
//             other => other,
//         }
//     });
//     // than update indexes
//     input
//         .iter_mut()
//         .enumerate()
//         .for_each(|(i, v)| v.1.borrow_mut().index = i);
// }
