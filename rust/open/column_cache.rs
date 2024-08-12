use crate::util::{
    delta_decode_array,
    delta_encode_array,
    unweave_and_delta_decode_3d_array,
    unweave_and_delta_decode_array,
    weave_and_delta_encode_3d_array,
    weave_and_delta_encode_array,
};
use crate::{BBOX, Point, Point3D, VectorPoints, VectorPoints3D};
use crate::util::{CustomOrd, CustomOrdWrapper};

use pbf::{Protobuf, ProtoRead, ProtoWrite};

use alloc::vec::Vec;
use alloc::string::String;
use core::cell::RefCell;
use alloc::rc::Rc;
use alloc::collections::BTreeMap;
use core::cmp::Ordering;

/// Column Types take up 3 bits.
/// ColumnNames define various common data structures to be stored in a column fashion
#[derive(Debug, Default, Clone, PartialEq, PartialOrd, Eq, Ord)]
pub enum OColumnName {
    /// stores string values
    #[default] String = 0,
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
    string: Vec<ColumnContainer<String>>,
    /// unsigned whole numbers are stored in unsigned
    unsigned: Vec<u64>,
    /// negative numbers are stored in signed
    signed: Vec<i64>,
    /// non-whole 32-bit numbers are stored in float
    float: Vec<f32>,
    /// non-whole numbers greater than 32-bit are stored in double
    double: Vec<f64>,
    /// for geometry types each column is individually weaved and delta encoded
    points: Vec<ColumnContainer<VectorPoints>>,
    /// for geometry types each column is individually weaved and delta encoded
    points_3d: Vec<ColumnContainer<VectorPoints3D>>,
    /// store M-Value indices>, geometry indices>, and geometry shapes
    indices: Vec<ColumnContainer<Vec<u32>>>,
    /// shapes and possibly value indices are stored in a number[] to be decoded by readShape
    shapes: Vec<ColumnContainer<Vec<usize>>>,
    /// Stores both BBox and BBox3D in a single column
    bbox: Vec<ColumnContainer<BBOX>>,

    /// keep tabs on the pbf
    pbf: Rc<RefCell<Protobuf>>,
}
impl ColumnCacheReader {
    /// create an instance
    pub fn new(pbf: Rc<RefCell<Protobuf>>, end: usize) -> Self {
        let pbf_clone = pbf.clone();
        let mut ccr = ColumnCacheReader {
            pbf,
            ..Default::default()
        };

        let mut tmp_pbf = pbf_clone.borrow_mut();
        tmp_pbf.read_fields(&mut ccr, Some(end));

        ccr
    }

    /// get a string
    pub fn get_string(&mut self, index: usize) -> String {
        get_value(
            index,
            self.pbf.clone(),
            &mut self.string,
            |pbf| pbf.read_string()
        )
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
        get_value(
            index,
            self.pbf.clone(),
            &mut self.points,
            |pbf| {
                unweave_and_delta_decode_array(&pbf.read_packed::<u64>())
            }
        )
    }

    /// get a vector of 3D points used by all geometry types
    pub fn get_points_3d(&mut self, index: usize) -> VectorPoints3D {
        get_value(
            index,
            self.pbf.clone(),
            &mut self.points_3d,
            |pbf| {
                unweave_and_delta_decode_3d_array(&pbf.read_packed::<u64>())
            }
        )
    }

    /// get a vector of indices used by all geometry types
    pub fn get_indices(&mut self, index: usize) -> Vec<u32> {
        get_value(
            index,
            self.pbf.clone(),
            &mut self.indices,
            |pbf| {
                delta_decode_array(&pbf.read_packed::<u32>())
            }
        )
    }

    /// get a vector of encoded data that helps decode shapes
    pub fn get_shapes(&mut self, index: usize) -> Vec<usize> {
        get_value(
            index,
            self.pbf.clone(),
            &mut self.shapes,
            |pbf| pbf.read_packed::<usize>()
        )
    }

    /// get a BBox
    pub fn get_bbox(&mut self, index: usize) -> BBOX {
        get_value(
            index,
            self.pbf.clone(),
            &mut self.bbox,
            |pbf| {
                let buf = pbf.read_packed::<u8>();
                (&buf[..]).into()
            }
        )
    }
}
impl ProtoRead for ColumnCacheReader {
    fn read(&mut self, tag: u64, pb: &mut Protobuf) {
        let pos = pb.get_pos();
        match tag {
            0 => self.string.push(ColumnContainer::Pos(pos)),
            1 => self.unsigned.push(pb.read_varint::<u64>()),
            2 => self.signed.push(pb.read_s_varint::<i64>()),
            3 => self.float.push(pb.read_varint::<f32>()),
            4 => self.double.push(pb.read_varint::<f64>()),
            5 => self.points.push(ColumnContainer::Pos(pos)),
            6 => self.points_3d.push(ColumnContainer::Pos(pos)),
            7 => self.indices.push(ColumnContainer::Pos(pos)),
            8 => self.shapes.push(ColumnContainer::Pos(pos)),
            9 => self.bbox.push(ColumnContainer::Pos(pos)),
            _ => panic!("Unknown column type"),
        }
    }
}

fn get_value<T, F>(
    index: usize,
    pbf: Rc<RefCell<Protobuf>>,
    container: &mut [ColumnContainer<T>],
    read_func: F
) -> T
    where
        T: Clone,
        F: FnOnce(&mut Protobuf) -> T,
{
    match &container[index] {
        ColumnContainer::Pos(pos) => {
            let mut tmp_pbf = pbf.borrow_mut();
            tmp_pbf.set_pos(*pos);
            let data = read_func(&mut tmp_pbf);
            container[index] = ColumnContainer::Data(data.clone());
            data
        }
        ColumnContainer::Data(data) => data.clone(),
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
pub enum ColumnValue{
    /// raw number index pointing to a location in the cache column
    Number(usize),
    /// a reference to a column
    Column(RefCell::<OColumnBaseChunk>),
}
impl From<usize> for ColumnValue {
    fn from(index: usize) -> Self {
        ColumnValue::Number(index)
    }
}
/// A building block for all column types.
pub type OColumnBaseWrite<K> = BTreeMap<K, RefCell::<OColumnBaseChunk>>;

/// A building block for all number column types.
pub type OColumnBaseFloatWrite<K> = BTreeMap<CustomOrdWrapper<K>, RefCell::<OColumnBaseChunk>>;
  
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
    pub fn add_u64(&mut self, value: u64) -> usize {
        add(&mut self.unsigned, value)
    }

    /// add i64 to cache
    pub fn add_i64(&mut self, value: i64) -> usize {
        add(&mut self.signed, value)
    }

    /// add f32 to cache
    pub fn add_f32(&mut self, value: f32) -> usize {
        add(&mut self.float, CustomOrdWrapper(value))
    }

    /// add f64 to cache
    pub fn add_f64(&mut self, value: f64) -> usize {
        add(&mut self.double, CustomOrdWrapper(value))
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
        let unsigned: Vec<(u64, RefCell<OColumnBaseChunk>)> = self.unsigned
            .iter().map(|(&key, value)| (key, value.clone())).collect();
        let signed: Vec<(i64, RefCell<OColumnBaseChunk>)> = self.signed
            .iter().map(|(&key, value)| (key, value.clone())).collect();
        let float: Vec<(f32, RefCell<OColumnBaseChunk>)> = self.float
            .iter().map(|(&key, value)| (key.0, value.clone())).collect();
        let double: Vec<(f64, RefCell<OColumnBaseChunk>)> = self.double
            .iter().map(|(&key, value)| (key.0, value.clone())).collect();
        // sort them
        // TODO: bring this back
        // sort_column(&mut unsigned);
        // sort_column(&mut signed);
        // sort_column(&mut float);
        // sort_column(&mut double);
        // strings
        for string in self.string.iter() {
            pbf.write_string_field(OColumnName::String.into(), string.0);
        }
        // u64
        for u in unsigned {
            pbf.write_varint_field(OColumnName::Unsigned.into(), u.0);
        }
        // i64
        for s in signed {
            pbf.write_s_varint_field(OColumnName::Signed.into(), s.0);
        }
        // f32
        for f in float {
            pbf.write_varint_field(OColumnName::Float.into(), f.0);
        }
        // f64
        for d in double {
            pbf.write_varint_field(OColumnName::Double.into(), d.0);
        }
        // points
        for p in self.points.iter() {
            pbf.write_packed_varint(OColumnName::Points.into(), &weave_and_delta_encode_array(p.0));
        }
        // points 3D
        for p_3d in self.points_3d.iter() {
            pbf.write_packed_varint(OColumnName::Points3D.into(), &weave_and_delta_encode_3d_array(p_3d.0));
        }
        // indices
        for i in self.indices.iter() {
            pbf.write_packed_varint(OColumnName::Indices.into(), &delta_encode_array(i.0));
        }
        // shapes
        for s in self.shapes.iter() {
            let packed: Vec<usize> = s.0
                .iter()
                .map(|v| match v {
                    ColumnValue::Number(n) => *n,
                    ColumnValue::Column(c) => c.borrow().index,
                })
                .collect();
            pbf.write_packed_varint(OColumnName::Shapes.into(), &packed);
        }
        // bbox
        for bbox in self.bbox.iter() {
            let quantized = bbox.0.quantize();
            pbf.write_packed_varint(OColumnName::BBox.into(), &quantized);
        }
    }
}

/// Add value to column and return index
pub fn add<T>(col: &mut OColumnBaseWrite<T>, value: T)-> usize
where
    T: Ord {
    if let Some(col) = col.get_mut(&value) {
        let mut col: core::cell::RefMut<OColumnBaseChunk> = col.borrow_mut();
        col.count += 1;
        col.index
    } else {
        let index = col.len();
        col.insert(value, RefCell::new(OColumnBaseChunk { index, count: 1 }));
        index
    }
}
  
/// Sort number types and value types by index then update the index of each row for better
/// compression down the line.
pub fn sort_column<T: CustomOrd>(input: &mut [(T, RefCell<OColumnBaseChunk>)]) {
    // first sort
    input.sort_by(|a, b| {
        // First sort by count in descending order
        match b.1.borrow().count.cmp(&a.1.borrow().count) {
            Ordering::Equal => a.0.custom_cmp(&b.0), // Then sort by data if counts are equal
            other => other,
        }
    });
    // than update indexes
    input
        .iter_mut()
        .enumerate()
        .for_each(|(i, v)| v.1.borrow_mut().index = i);
}
