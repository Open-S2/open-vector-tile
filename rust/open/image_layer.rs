use alloc::{fmt, str::FromStr, string::String, vec::Vec};

use pbf::{BitCast, ProtoRead, ProtoWrite, Protobuf};

// TODO: This could be faster if we don't read in the grid data on parsing but only if the user needs it

/// Track the image type
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, PartialOrd, Ord)]
pub enum ImageType {
    /// PNG
    #[default]
    PNG = 0,
    /// JPEG
    JPG = 1,
    /// WebP
    WEBP = 2,
    /// GIF
    GIF = 3,
    /// AVIF
    AVIF = 4,
    /// SVG
    SVG = 5,
    /// BMP
    BMP = 6,
    /// RAW
    RAW = 7,
    /// Unknown
    UNKNOWN = 8,
}
impl BitCast for ImageType {
    fn to_u64(&self) -> u64 {
        (*self) as u64
    }
    fn from_u64(value: u64) -> Self {
        match value {
            0 => ImageType::PNG,
            1 => ImageType::JPG,
            2 => ImageType::WEBP,
            3 => ImageType::GIF,
            4 => ImageType::AVIF,
            5 => ImageType::SVG,
            6 => ImageType::BMP,
            7 => ImageType::RAW,
            8 => ImageType::UNKNOWN,
            _ => panic!("unknown value: {}", value),
        }
    }
}
impl FromStr for ImageType {
    type Err = &'static str;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "PNG" => Ok(ImageType::PNG),
            "JPG" | "JPEG" => Ok(ImageType::JPG),
            "WEBP" => Ok(ImageType::WEBP),
            "GIF" => Ok(ImageType::GIF),
            "AVIF" => Ok(ImageType::AVIF),
            "SVG" => Ok(ImageType::SVG),
            "BMP" => Ok(ImageType::BMP),
            "RAW" => Ok(ImageType::RAW),
            "UNKNOWN" => Ok(ImageType::UNKNOWN),
            #[tarpaulin::skip]
            _ => Err("Unknown image type"),
        }
    }
}
impl From<&str> for ImageType {
    fn from(s: &str) -> Self {
        ImageType::from_str(s.to_uppercase().as_str()).unwrap_or(ImageType::PNG)
    }
}
impl fmt::Display for ImageType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let name = match self {
            ImageType::PNG => "PNG",
            ImageType::JPG => "JPG",
            ImageType::WEBP => "WEBP",
            ImageType::GIF => "GIF",
            ImageType::AVIF => "AVIF",
            ImageType::SVG => "SVG",
            ImageType::BMP => "BMP",
            ImageType::RAW => "RAW",
            ImageType::UNKNOWN => "UNKNOWN",
        };
        write!(f, "{}", name)
    }
}

/// Elevation object to read from
#[derive(Debug, Default, Clone, PartialEq)]
pub struct ImageData {
    /// The name of the image
    pub name: String,
    /// The image type
    pub image_type: ImageType,
    /// The image width
    pub width: u32,
    /// The image height
    pub height: u32,
    /// The image data
    pub image: Vec<u8>,
}
impl ImageData {
    /// Create a new ImageData
    pub fn new(
        name: String,
        image_type: ImageType,
        width: u32,
        height: u32,
        image: Vec<u8>,
    ) -> Self {
        Self { name, image_type, width, height, image }
    }
}
impl ProtoRead for ImageData {
    fn read(&mut self, tag: u64, pb: &mut Protobuf) {
        match tag {
            0 => self.image_type = pb.read_varint::<ImageType>(),
            1 => self.width = pb.read_varint(),
            2 => self.height = pb.read_varint(),
            3 => self.image = pb.read_bytes(),
            4 => self.name = pb.read_string(),
            #[tarpaulin::skip]
            _ => panic!("unknown tag: {}", tag),
        }
    }
}
impl ProtoWrite for ImageData {
    fn write(&self, pb: &mut Protobuf) {
        pb.write_varint_field(0, self.image_type);
        pb.write_varint_field(1, self.width);
        pb.write_varint_field(2, self.height);
        pb.write_bytes_field(3, &self.image);
        pb.write_string_field(4, &self.name);
    }
}
