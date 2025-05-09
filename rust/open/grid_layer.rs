use crate::{delta_decode_array, delta_encode_array, open::Extent};
use alloc::{string::String, vec::Vec};
use libm::round;
use pbf::{ProtoRead, ProtoWrite, Protobuf};

// TODO: This could be faster if we don't read in the grid data on parsing but only if the user needs it

/// Gridded data object to read from
#[derive(Default, Debug, PartialEq)]
pub struct GridData {
    /// The name of the gridded data
    pub name: String,
    /// The grid data
    pub data: Vec<f64>,
    /// The extent for remapping the data with a value between 0 and extent
    pub extent: Extent,
    /// The size of the tile (width and height)
    pub size: f64,
    /// The minimum grid value
    pub min: f64,
    /// The maximum grid value
    pub max: f64,
}
impl GridData {
    /// create a new GridData object
    pub fn new(
        name: String,
        extent: Extent,
        size: f64,
        min: f64,
        max: f64,
        data: Vec<f64>,
    ) -> Self {
        GridData { name, data, extent, size, min, max }
    }
}
impl ProtoRead for GridData {
    fn read(&mut self, tag: u64, pb: &mut Protobuf) {
        match tag {
            1 => self.extent = pb.read_varint(),
            2 => self.size = pb.read_varint(),
            3 => self.min = pb.read_varint(),
            4 => self.max = pb.read_varint(),
            5 => {
                self.data = delta_decode_array(&pb.read_packed())
                    .into_iter()
                    .map(|v| unmap_value(v as f64, self.min, self.max, self.extent.into()))
                    .collect()
            }
            6 => self.name = pb.read_string(),
            _ => panic!("unknown tag: {}", tag),
        }
    }
}
impl ProtoWrite for GridData {
    fn write(&self, pb: &mut Protobuf) {
        let max = self.data.iter().fold(f64::MIN, |a, b| f64::max(a, *b));
        let min = self.data.iter().fold(f64::MAX, |a, b| f64::min(a, *b));
        let re_mapped: Vec<u32> =
            self.data.iter().map(|v| remap_value(*v, min, max, self.extent.into())).collect();
        let d_coded = delta_encode_array(&re_mapped);

        pb.write_varint_field(1, self.extent);
        pb.write_varint_field(2, self.size);
        pb.write_varint_field(3, min);
        pb.write_varint_field(4, max);
        pb.write_packed_varint(5, &d_coded);
        pb.write_string_field(6, &self.name);
    }
}

/// map the value to the range 0->extent
fn remap_value(value: f64, min: f64, max: f64, extent: f64) -> u32 {
    round(((value - min) * extent) / (max - min)) as u32
}

/// map the value back to floats
fn unmap_value(value: f64, min: f64, max: f64, extent: f64) -> f64 {
    (value * (max - min)) / extent + min
}

/// convert rgb to elevation using terrarium formula
pub fn convert_terrarium_elevation_data(r: u8, g: u8, b: u8) -> f64 {
    r as f64 * 256. + g as f64 + b as f64 / 256. - 32768.
}

/// convert rgb to elevation using mapbox formula
pub fn convert_mapbox_elevation_data(r: u8, g: u8, b: u8) -> f64 {
    -10000. + (r as f64 * 256. * 256. + g as f64 * 256. + b as f64) * 0.1
}
