use crate::{Point, Point3D, BBOX, BBox, BBox3D};

use alloc::vec::Vec;

use core::cmp::Ordering;

/// Manager for float based comparisons
pub trait CustomOrd {
  /// Custom comparison
  fn custom_cmp(&self, other: &Self) -> Ordering;
}
impl CustomOrd for u64 {
  fn custom_cmp(&self, other: &Self) -> Ordering {
      self.partial_cmp(other).unwrap_or(Ordering::Equal)
  }
}
impl CustomOrd for i64 {
  fn custom_cmp(&self, other: &Self) -> Ordering {
      self.partial_cmp(other).unwrap_or(Ordering::Equal)
  }
}
impl CustomOrd for f32 {
  fn custom_cmp(&self, other: &Self) -> Ordering {
      if self.is_nan() || other.is_nan() {
          Ordering::Equal // Or handle NaNs differently if needed
      } else {
          self.partial_cmp(other).unwrap_or(Ordering::Equal)
      }
  }
}
impl CustomOrd for f64 {
  fn custom_cmp(&self, other: &Self) -> Ordering {
      if self.is_nan() || other.is_nan() {
          Ordering::Equal // Or handle NaNs differently if needed
      } else {
          self.partial_cmp(other).unwrap_or(Ordering::Equal)
      }
  }
}
/// Wrapper struct for custom ordering
#[derive(Debug, Default, Clone, Copy)]
pub struct CustomOrdWrapper<T>(pub T);
impl<T: CustomOrd> CustomOrd for CustomOrdWrapper<T> {
    fn custom_cmp(&self, other: &Self) -> Ordering {
        self.0.custom_cmp(&other.0)
    }
}
impl<T: CustomOrd> PartialOrd for CustomOrdWrapper<T> {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}
impl<T: CustomOrd> Eq for CustomOrdWrapper<T> {}
impl<T: CustomOrd> PartialEq for CustomOrdWrapper<T> {
    fn eq(&self, other: &Self) -> bool {
        self.0.custom_cmp(&other.0) == Ordering::Equal
    }
}
impl<T: CustomOrd> Ord for CustomOrdWrapper<T> {
    fn cmp(&self, other: &Self) -> Ordering {
        self.custom_cmp(other)
    }
}

/// Encode a command with the given length of the data that follows.
pub fn command_encode(cmd: u8, len: u32) -> u64 {
  ((len << 3) + ((cmd as u32) & 0x7)) as u64
}

/// A command container. Decoding of a comand and length
pub struct Command {
  /// The command
  pub cmd: u8,
  /// The length
  pub len: u32,
}

/// Decode a command with the given length of the data that follows.
pub fn command_decode(cmd: u64) -> Command {
    Command {
        cmd: (cmd & 0x7) as u8,
        len: (cmd >> 3) as u32,
    }
}

/// Applies zigzag encoding to transform a signed integer into an unsigned integer.
pub fn zigzag(value: i32) -> u32 {
    let val: u32 = value as u32;
    (val << 1) ^ (val >> 31)
}

/// Applies zigzag decoding to transform an unsigned integer into a signed integer.
pub fn zagzig(value: u32) -> i32 {
    let val: i32 = value as i32;
    (val >> 1) ^ -(val & 1)
}

/// Interweave two 16-bit numbers into a 32-bit number.
/// In theory two small numbers can end up varint encoded to use less space.
pub fn weave_2d(a: u16, b: u16) -> u32 {
    let mut a = a as u32;
    let mut b = b as u32;
    let mut result: u32 = 0;
    for i in 0..16 {
        result |= (a & 1) << (i * 2); // Take ith bit from `a` and put it at position 2*i
        result |= (b & 1) << (i * 2 + 1); // Take ith bit from `b` and put it at position 2*i+1
        // move to next bit
        a >>= 1;
        b >>= 1;
    }
    
    result
}

/// Deweave a 32-bit number into two 16-bit numbers.
pub fn unweave_2d(num: u32) -> (u16, u16) {
  let mut num = num;
  let mut a: u16 = 0;
  let mut b: u16 = 0;
  for i in 0..16 {
    let bit = 1 << i;
    if num & 1 != 0 { a |= bit; }
    if num & 2 != 0 { b |= bit; }
    num >>= 2;
  }
  
  (a, b)
}

/// Interweave three 16-bit numbers into a 48-bit number.
/// In theory three small numbers can end up varint encoded to use less space.
pub fn weave_3d(a: u16, b: u16, c: u16) -> u64 {
  // return result
  let mut result: u64 = 0;
  let mut a: u64 = a.into();
  let mut b: u64 = b.into();
  let mut c: u64 = c.into();

  for i in 0..16 {
    if a & 1 != 0 { result |= 1 << (i * 3); } // Take ith bit from `a` and put it at position 3*i
    if b & 1 != 0 { result |= 1 << (i * 3 + 1); } // Take ith bit from `b` and put it at position 3*i+1
    if c & 1 != 0 { result |= 1 << (i * 3 + 2); } // Take ith bit from `c` and put it at position 3*i+2
    // Move to the next bit
    a >>= 1;
    b >>= 1;
    c >>= 1;
  }

  result
}

/// Deweave a 48-bit number into three 16-bit numbers.
/// Returns the three 16-bit numbers in a tuple.
pub fn unweave_3d(num: u64) -> (u32, u32, u32) {
  let mut a = 0;
  let mut b = 0;
  let mut c = 0;
  let mut num = num; // Make a mutable copy of the input

  for i in 0..16 {
      let bit = 1 << i;
      if (num & 1) != 0 { a |= bit; }
      if (num & 2) != 0 { b |= bit; }
      if (num & 4) != 0 { c |= bit; }
      num >>= 3; // Right shift the number by 3 positions
  }

  (a, b, c)
}

/// Encode an array of points using interweaving and delta encoding.
pub fn weave_and_delta_encode_array(array: &[Point]) -> Vec<u32> {
  let mut res = Vec::new();
  let mut prev_x = 0;
  let mut prev_y = 0;

  for point in array.iter() {
      let pos_x = zigzag(point.x - prev_x);
      let pos_y = zigzag(point.y - prev_y);
      res.push(weave_2d(pos_x as u16, pos_y as u16));
      prev_x = point.x;
      prev_y = point.y;
  }

  res
}

/// Decode an array of points that were encoded using interweaving and delta encoding.
pub fn unweave_and_delta_decode_array(array: &[u64]) -> Vec<Point> {
  let mut res = Vec::new();
  let mut prev_x = 0;
  let mut prev_y = 0;

  for &encoded_num in array {
      let (a, b) = unweave_2d(encoded_num as u32);
      let x = zagzig(a as u32) + prev_x;
      let y = zagzig(b as u32) + prev_y;
      res.push(Point::new(x, y));
      prev_x = x;
      prev_y = y;
  }

  res
}

/// Encode an array of 3D points using interweaving and delta encoding.
pub fn weave_and_delta_encode_3d_array(array: &[Point3D]) -> Vec<u64> {
  let mut res = Vec::new();
  let mut offset_x = 0;
  let mut offset_y = 0;
  let mut offset_z = 0;

  for point in array.iter() {
      let pos_x = zigzag(point.x - offset_x);
      let pos_y = zigzag(point.y - offset_y);
      let pos_z = zigzag(point.z - offset_z);
      res.push(weave_3d(pos_x as u16, pos_y as u16, pos_z as u16));
      offset_x = point.x;
      offset_y = point.y;
      offset_z = point.z;
  }

  res
}

/// Decode an array of 3D points that were encoded using interweaving and delta encoding.
pub fn unweave_and_delta_decode_3d_array(array: &[u64]) -> Vec<Point3D> {
  let mut res = Vec::new();
  let mut offset_x = 0;
  let mut offset_y = 0;
  let mut offset_z = 0;

  for &encoded_num in array {
      let (a, b, c) = unweave_3d(encoded_num);
      let x = zagzig(a) + offset_x;
      let y = zagzig(b) + offset_y;
      let z = zagzig(c) + offset_z;
      res.push(Point3D::new(x, y, z));
      offset_x = x;
      offset_y = y;
      offset_z = z;
  }

  res
}

/// Encode an array using delta encoding.
pub fn delta_encode_array(array: &[u32]) -> Vec<u32> {
  let mut res = Vec::new();
  let mut offset = 0;

  for &num in array {
      let num = num as i32;
      let encoded = zigzag(num - offset);
      res.push(encoded);
      offset = num;
  }

  res
}

/// Decode an array that was encoded using delta encoding.
pub fn delta_decode_array(array: &[u32]) -> Vec<u32> {
  let mut res = Vec::new();
  let mut offset = 0;

  for &encoded_num in array {
      let num = zagzig(encoded_num) + offset;
      res.push(num as u32);
      offset = num;
  }

  res
}

/// Encode a sorted array using delta encoding.
pub fn delta_encode_sorted_array(array: &[i32]) -> Vec<u32> {
  let mut res = Vec::new();
  let mut offset = 0;

  for &num in array {
      let delta = (num - offset) as u32; // Safe conversion as the array is sorted
      res.push(delta);
      offset = num;
  }

  res
}

/// Decode a sorted array that was encoded using delta encoding.
pub fn delta_decode_sorted_array(array: &[u32]) -> Vec<i32> {
  let mut res = Vec::new();
  let mut offset = 0;

  for &encoded_num in array {
      let num = encoded_num as i32 + offset;  // Casting to i32; since encoded as non-negative delta
      res.push(num);
      offset = num;
  }

  res
}

/// 24-bit quantization
/// ~0.000021457672119140625 degrees precision
/// ~2.388 meters precision
pub fn quantize_lon(lon: f64) -> i32 {
  ((lon + 180.0) * 16_777_215.0 / 360.0).round() as i32
}

/// 24-bit quantization
/// ~0.000010728836059570312 degrees precision
/// ~1.194 meters precision
pub fn quantize_lat(lat: f64) -> i32 {
  ((lat + 90.0) * 16_777_215.0 / 180.0).round() as i32
}

/// Converts quantized longitude back to geographical longitude
pub fn dequantize_lon(q_lon: i32) -> f64 {
  (q_lon as f64 * 360.0 / 16_777_215.0) - 180.0
}

/// Converts quantized latitude back to geographical latitude
pub fn dequantize_lat(q_lat: i32) -> f64 {
  (q_lat as f64 * 180.0 / 16_777_215.0) - 90.0
}

/// Packs a 24-bit integer into a buffer at the specified offset.
pub fn pack24_bit_uint(buffer: &mut [u8], value: i32, offset: usize) {
  buffer[offset] = ((value >> 16) & 0xff) as u8;
  buffer[offset + 1] = ((value >> 8) & 0xff) as u8;
  buffer[offset + 2] = (value & 0xff) as u8;
}

/// Unpacks a 24-bit integer from a buffer at the specified offset.
pub fn unpack24_bit_uint(buffer: &[u8], offset: usize) -> i32 {
  ((buffer[offset] as i32) << 16) | ((buffer[offset + 1] as i32) << 8) | (buffer[offset + 2] as i32)
}

/// Packs a float into a buffer at the specified offset using little-endian format.
pub fn pack_float(buffer: &mut [u8], value: f32, offset: usize) {
  let bytes: [u8; 4] = value.to_le_bytes();  // Converts the float to little-endian byte array
  buffer[offset..offset + 4].copy_from_slice(&bytes);
}

/// Unpacks a float from a buffer at the specified offset using little-endian format.
pub fn unpack_float(buffer: &[u8], offset: usize) -> f32 {
  f32::from_le_bytes(buffer[offset..offset + 4].try_into().unwrap())  // Converts little-endian bytes back to a float
}

// | Decimal Places | Approximate Accuracy in Distance       |
// |----------------|----------------------------------------|
// | 0              | 111 km (69 miles)                      |
// | 1              | 11.1 km (6.9 miles)                    |
// | 2              | 1.11 km (0.69 miles)                   |
// | 3              | 111 meters (364 feet)                  |
// | 4              | 11.1 meters (36.4 feet)                |
// | 5              | 1.11 meters (3.64 feet)                |
// | 6              | 0.111 meters (11.1 cm or 4.39 inches)  |
// | 7              | 1.11 cm (0.44 inches)                  |
// | 8              | 1.11 mm (0.044 inches)                 |
// 24-bit quantization for longitude and latitude
// LONGITUDE:
// - ~0.000021457672119140625 degrees precision
// - ~2.388 meters precision
// LATITUDE:
// - ~0.000010728836059570312 degrees precision
// - ~1.194 meters precision
impl BBox {
  fn quantize(&self) -> Vec<u8> {
    let mut buffer = Vec::<u8>::with_capacity(12);

    let q_lon1 = quantize_lon(self.left);
    let q_lat1 = quantize_lat(self.bottom);
    let q_lon2 = quantize_lon(self.right);
    let q_lat2 = quantize_lat(self.top);

    pack24_bit_uint(&mut buffer, q_lon1, 0);
    pack24_bit_uint(&mut buffer, q_lat1, 3);
    pack24_bit_uint(&mut buffer, q_lon2, 6);
    pack24_bit_uint(&mut buffer, q_lat2, 9);

    buffer
  }
  fn dequantize(buf: &[u8]) -> BBox {
    let q_lon1 = unpack24_bit_uint(buf, 0);
    let q_lat1 = unpack24_bit_uint(buf, 3);
    let q_lon2 = unpack24_bit_uint(buf, 6);
    let q_lat2 = unpack24_bit_uint(buf, 9);

    BBox {
      left: dequantize_lon(q_lon1),
      bottom: dequantize_lat(q_lat1),
      right: dequantize_lon(q_lon2),
      top: dequantize_lat(q_lat2),
    }
  }
}
impl BBox3D {
  /// Quantize the BBox3D
  pub fn quantize(&self) -> Vec<u8> {
    let mut buffer = Vec::<u8>::with_capacity(20);

    let q_lon1 = quantize_lon(self.left);
    let q_lat1 = quantize_lat(self.bottom);
    let q_lon2 = quantize_lon(self.right);
    let q_lat2 = quantize_lat(self.top);

    pack24_bit_uint(&mut buffer, q_lon1, 0);
    pack24_bit_uint(&mut buffer, q_lat1, 3);
    pack24_bit_uint(&mut buffer, q_lon2, 6);
    pack24_bit_uint(&mut buffer, q_lat2, 9);

    pack_float(&mut buffer, self.near as f32, 12);
    pack_float(&mut buffer, self.far as f32, 16);

    buffer
  }

  /// Dequantize the BBox3D
  pub fn dequantize(buf: &[u8]) -> BBox3D {
    let q_lon1 = unpack24_bit_uint(buf, 0);
    let q_lat1 = unpack24_bit_uint(buf, 3);
    let q_lon2 = unpack24_bit_uint(buf, 6);
    let q_lat2 = unpack24_bit_uint(buf, 9);

    let near = unpack_float(buf, 12) as f64;
    let far = unpack_float(buf, 16) as f64;

    BBox3D {
      left: dequantize_lon(q_lon1),
      bottom: dequantize_lat(q_lat1),
      right: dequantize_lon(q_lon2),
      top: dequantize_lat(q_lat2),
      near,
      far,
    }
  }
}

impl BBOX {
  /// Quantize the BBOX
  pub fn quantize(&self) -> Vec<u8> {
    match self {
      BBOX::BBox(bbox) => bbox.quantize(),
      BBOX::BBox3D(bbox) => bbox.quantize(),
    }
  }

  /// Dequantize the BBOX
  pub fn dequantize(buf: &[u8]) -> BBOX {
    BBOX::BBox(BBox::dequantize(buf))
  }
}

impl From<&[u8]> for BBOX {
  fn from(buf: &[u8]) -> Self {
      if buf.len() == 12 {
          BBOX::BBox(BBox::dequantize(buf))
      } else {
          BBOX::BBox3D(BBox3D::dequantize(buf))
      }
  }
}