use pbf::{Protobuf, ProtoRead};

use crate::base::BaseVectorLayer;
use crate::open::{encode_shape, decode_shape, read_feature, write_feature, Extent, OpenVectorFeature, ColumnCacheReader, ColumnCacheWriter, Shape};
use crate::VectorLayerMethods;

use core::cell::RefCell;

use alloc::rc::Rc;
use alloc::vec::Vec;
use alloc::string::String;

/// The Open Vector Layer class represents a layer in an Open Vector Tile.
/// Contains an extent, name, version, and features.
/// The features will utilize the layer extent to decode geometry.
pub struct OpenVectorLayer {
    pub version: u16,
    pub name: String,
    pub extent: Extent,
    pub features: Vec<OpenVectorFeature>,
    shape: Option<Shape>,
    m_shape: Option<Shape>,
    cache: Rc<RefCell<ColumnCacheReader>>,
}
impl OpenVectorLayer {
    pub fn new(
        pbf: Rc<RefCell<Protobuf>>,
        cache: Rc<RefCell<ColumnCacheReader>>,
    ) -> OpenVectorLayer {
        let mut ol = OpenVectorLayer {
            version: 1,
            name: String::new(),
            extent: Extent::default(),
            shape: None,
            m_shape: None,
            features: Vec::new(),
            cache,
        };

        let mut tmp_pbf = pbf.borrow_mut();
        tmp_pbf.read_message::<OpenVectorLayer>(&mut ol);

        ol
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
}
impl ProtoRead for OpenVectorLayer {
    fn read(&mut self, tag: u64, pb: &mut Protobuf) {
        match tag {
            1 => self.version = pb.read_varint::<u16>(),
            2 => self.name = {
                let mut cache = self.cache.borrow_mut();
                cache.get_string(pb.read_varint())
            },
            3 => self.extent = pb.read_varint::<Extent>(),
            4 => {
                read_feature(
                    pb.read_bytes(),
                    self.extent,
                    self.cache.clone(),
                    &self.shape.clone().unwrap_or_default(),
                    self.m_shape.clone().unwrap_or_default(),
                );
            },
            5 => self.shape = {
                let mut cache = self.cache.borrow_mut();
                Some(decode_shape(pb.read_varint(), &mut cache))
            },
            6 => self.m_shape = {
                let mut cache: core::cell::RefMut<ColumnCacheReader> = self.cache.borrow_mut();
                Some(decode_shape(pb.read_varint(), &mut cache))
            },
            _ => panic!("unknown tag: {}", tag),
        }
    }
}

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
        pbf.write_bytes_field(4, &write_feature(feature, &layer.shape, &layer.m_shape, cache));
    }

    pbf.take()
}
