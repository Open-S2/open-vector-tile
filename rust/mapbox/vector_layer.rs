use crate::VectorLayerMethods;
use crate::mapbox::{Value, vector_feature::MapboxVectorFeature};

use pbf::{ProtoRead, Protobuf};

use core::cell::RefCell;

use alloc::rc::Rc;
use alloc::vec::Vec;
use alloc::string::String;

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
    pub fn new(
        pbf: Rc<RefCell<Protobuf>>,
        end: usize,
        is_s2: bool,
    ) -> MapboxVectorLayer {
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
                    self.values.clone()
                );
                pb.read_message(&mut feature);
                self.features.push(feature);
            },
            3 => {
                self.keys.borrow_mut().push(pb.read_string());
            },
            4 => {
                let mut value = Value::Null;
                pb.read_message(&mut value);
                self.values.borrow_mut().push(value);
            },
            5 => self.extent = pb.read_varint::<usize>(),
            _ => panic!("unknown tag: {}", tag),
        }
    }
}
