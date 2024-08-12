use crate::base::BaseVectorLayer;
use crate::mapbox::{write_feature, MapboxVectorFeature, Value};
use crate::VectorLayerMethods;

use pbf::{ProtoRead, Protobuf};

use core::cell::RefCell;

use alloc::collections::BTreeMap;
use alloc::rc::Rc;
use alloc::string::String;
use alloc::vec::Vec;

/// Mapbox specification for a Layer
pub struct MapboxVectorLayer {
    /// the version of the vector tile layer.
    pub version: u16,
    /// the name of the layer
    pub name: String,
    /// the extent of the vector layer
    pub extent: usize,
    /// the features in the layer
    pub features: Vec<MapboxVectorFeature>,
    /// whether or not the layer is an s2 layer. This is an extension to the Mapbox spec and not used
    /// in production by most tools
    is_s2: bool,
    /// a reference to the pbf
    pbf: Rc<RefCell<Protobuf>>,
    /// key store used by features
    keys: Rc<RefCell<Vec<String>>>,
    /// value store used by features
    values: Rc<RefCell<Vec<Value>>>,
}
impl MapboxVectorLayer {
    /// Create a new MapboxVectorLayer
    pub fn new(pbf: Rc<RefCell<Protobuf>>, end: usize, is_s2: bool) -> MapboxVectorLayer {
        let pbf_clone = pbf.clone();
        let mut mvl = MapboxVectorLayer {
            version: 5,
            name: String::new(),
            extent: 4_096,
            is_s2,
            pbf,
            keys: Rc::new(RefCell::new(Vec::new())),
            values: Rc::new(RefCell::new(Vec::new())),
            features: Vec::new(),
        };

        let mut tmp_pbf = pbf_clone.borrow_mut();
        tmp_pbf.read_fields::<MapboxVectorLayer>(&mut mvl, Some(end));

        mvl
    }
}
impl VectorLayerMethods for MapboxVectorLayer {
    fn version(&self) -> u16 {
        self.version
    }
    fn name(&self) -> String {
        self.name.clone()
    }
    fn extent(&self) -> usize {
        self.extent
    }
}
impl ProtoRead for MapboxVectorLayer {
    fn read(&mut self, tag: u64, pb: &mut Protobuf) {
        match tag {
            15 => self.version = pb.read_varint::<u16>(),
            1 => self.name = pb.read_string(),
            2 => {
                let mut feature = MapboxVectorFeature::new(
                    self.pbf.clone(),
                    self.is_s2,
                    self.extent,
                    self.version,
                    self.keys.clone(),
                    self.values.clone(),
                );
                pb.read_message(&mut feature);
                self.features.push(feature);
            }
            3 => {
                self.keys.borrow_mut().push(pb.read_string());
            }
            4 => {
                let mut value = Value::Null;
                pb.read_message(&mut value);
                self.values.borrow_mut().push(value);
            }
            5 => self.extent = pb.read_varint::<usize>(),
            _ => panic!("unknown tag: {}", tag),
        }
    }
}

/// Write a layer to a protobuffer using the S2 Specification
pub fn write_layer(layer: &BaseVectorLayer) -> Vec<u8> {
    let mut pbf = Protobuf::new();
    let mut keys: BTreeMap<String, usize> = BTreeMap::new();
    let mut values: BTreeMap<Value, usize> = BTreeMap::new();

    pbf.write_varint_field(15, layer.version as u64);
    pbf.write_string_field(1, &layer.name);
    for feature in layer.features.iter() {
        pbf.write_bytes_field(2, &write_feature(feature, &mut keys, &mut values));
    }
    // keys and values
    for key in keys.keys() {
        pbf.write_string_field(3, key);
    }
    for value in values.keys() {
        pbf.write_message(4, value);
    }
    pbf.write_varint_field(5, layer.extent);

    pbf.take()
}
