use pbf::{ProtoRead, Protobuf};

use crate::base::BaseVectorLayer;
use crate::open::{
    decode_shape, encode_shape, read_feature, write_feature, ColumnCacheReader, ColumnCacheWriter,
    Extent, OpenVectorFeature, Shape,
};
use crate::VectorLayerMethods;

use core::cell::RefCell;

use alloc::rc::Rc;
use alloc::string::String;
use alloc::vec::Vec;

/// The Open Vector Layer class represents a layer in an Open Vector Tile.
/// Contains an extent, name, version, and features.
/// The features will utilize the layer extent to decode geometry.
#[derive(Debug)]
pub struct OpenVectorLayer {
    /// the version of the vector tile
    pub version: u16,
    /// the name of the layer
    pub name: String,
    /// the extent of the vector layer
    pub extent: Extent,
    /// the features in the layer
    pub features: Vec<OpenVectorFeature>,
    shape: Option<Shape>,
    m_shape: Option<Shape>,
    cache: Rc<RefCell<ColumnCacheReader>>,
}
impl OpenVectorLayer {
    /// Create a new OpenVectorLayer
    pub fn new(cache: Rc<RefCell<ColumnCacheReader>>) -> OpenVectorLayer {
        OpenVectorLayer {
            version: 1,
            name: String::new(),
            extent: Extent::default(),
            shape: None,
            m_shape: None,
            features: Vec::new(),
            cache,
        }
    }
}
impl VectorLayerMethods for OpenVectorLayer {
    fn version(&self) -> u16 {
        self.version
    }
    fn name(&self) -> String {
        self.name.clone()
    }
    fn extent(&self) -> usize {
        self.extent.into()
    }
    fn len(&self) -> usize {
        self.features.len()
    }
    fn is_empty(&self) -> bool {
        self.features.is_empty()
    }
    fn feature(&mut self, i: usize) -> Option<&mut dyn crate::VectorFeatureMethods> {
        self.features
            .get_mut(i)
            .map(|f| f as &mut dyn crate::VectorFeatureMethods)
    }
}
impl ProtoRead for OpenVectorLayer {
    fn read(&mut self, tag: u64, pb: &mut Protobuf) {
        match tag {
            1 => self.version = pb.read_varint::<u16>(),
            2 => {
                self.name = {
                    let mut cache = self.cache.borrow_mut();
                    cache.get_string(pb.read_varint())
                }
            }
            3 => self.extent = pb.read_varint::<Extent>(),
            4 => self.features.push(read_feature(
                pb.read_bytes(),
                self.extent,
                self.cache.clone(),
                &self.shape.clone().unwrap_or_default(),
                self.m_shape.clone().unwrap_or_default(),
            )),
            5 => {
                self.shape = {
                    let mut cache = self.cache.borrow_mut();
                    Some(decode_shape(pb.read_varint(), &mut cache))
                }
            }
            6 => {
                self.m_shape = {
                    let mut cache: core::cell::RefMut<ColumnCacheReader> = self.cache.borrow_mut();
                    Some(decode_shape(pb.read_varint(), &mut cache))
                }
            }
            _ => panic!("unknown tag: {}", tag),
        }
    }
}

/// Write the layer to a protobuf
pub fn write_layer(layer: &mut BaseVectorLayer, cache: &mut ColumnCacheWriter) -> Vec<u8> {
    let mut pbf = Protobuf::new();

    pbf.write_varint_field(1, layer.version);
    pbf.write_varint_field(2, cache.add_string(layer.name.clone()));
    pbf.write_varint_field(3, layer.extent);
    pbf.write_varint_field(5, encode_shape(&layer.shape, cache));
    if let Some(ref m_shape) = layer.m_shape {
        pbf.write_varint_field(6, encode_shape(m_shape, cache));
    }

    // sort by feature type
    layer.features.sort_by_key(|a| a.get_type());

    for feature in &layer.features {
        pbf.write_bytes_field(
            4,
            &write_feature(feature, &layer.shape, layer.m_shape.as_ref(), cache),
        );
    }

    pbf.take()
}
