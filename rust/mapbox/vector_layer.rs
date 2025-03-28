use crate::{
    base::BaseVectorLayer,
    mapbox::{write_feature, MapboxVectorFeature},
    VectorFeatureMethods, VectorLayerMethods,
};
use alloc::{
    collections::{btree_map::Entry, BTreeMap},
    rc::Rc,
    string::String,
    vec::Vec,
};
use core::cell::RefCell;
use pbf::{ProtoRead, Protobuf};
use s2json::PrimitiveValue;

/// Mapbox specification for a Layer
#[derive(Debug)]
pub struct MapboxVectorLayer {
    /// the version of the vector tile layer.
    pub version: u16,
    /// the name of the layer
    pub name: String,
    /// the extent of the vector layer
    pub extent: usize,
    /// the features in the layer
    pub features: BTreeMap<usize, MapboxVectorFeature>,
    /// track the positions of the features
    pub feature_positions: Vec<usize>,
    /// whether or not the layer is an s2 layer. This is an extension to the Mapbox spec and not used
    /// in production by most tools
    is_s2: bool,
    /// a reference to the pbf
    pbf: Rc<RefCell<Protobuf>>,
    /// key store used by features
    keys: Rc<RefCell<Vec<String>>>,
    /// value store used by features
    values: Rc<RefCell<Vec<PrimitiveValue>>>,
}
impl MapboxVectorLayer {
    /// Create a new MapboxVectorLayer
    pub fn new(pbf: Rc<RefCell<Protobuf>>, is_s2: bool) -> MapboxVectorLayer {
        MapboxVectorLayer {
            version: 5,
            name: String::new(),
            extent: 4_096,
            is_s2,
            pbf: pbf.clone(),
            keys: Rc::new(RefCell::new(Vec::new())),
            values: Rc::new(RefCell::new(Vec::new())),
            features: BTreeMap::new(),
            feature_positions: Vec::new(),
        }
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

    /// the number of features in the layer
    fn len(&self) -> usize {
        self.feature_positions.len()
    }

    /// Check if the layer is empty
    fn is_empty(&self) -> bool {
        self.feature_positions.is_empty()
    }

    fn feature(&mut self, i: usize) -> Option<&mut dyn VectorFeatureMethods> {
        // First check if self.features already has the feature
        if let Entry::Vacant(e) = self.features.entry(i) {
            // Read the feature
            let mut feature = MapboxVectorFeature::new(
                self.pbf.clone(),
                self.is_s2,
                self.extent,
                self.version,
                self.keys.clone(),
                self.values.clone(),
            );
            let mut pbf = self.pbf.borrow_mut();
            pbf.set_pos(self.feature_positions[i]);
            pbf.read_message(&mut feature);
            e.insert(feature);

            // Now safely retrieve the inserted feature
            Some(self.features.get_mut(&i).unwrap() as &mut dyn VectorFeatureMethods)
        } else {
            // Safe to unwrap since we just checked the key exists
            Some(self.features.get_mut(&i).unwrap() as &mut dyn VectorFeatureMethods)
        }
    }
}
impl ProtoRead for MapboxVectorLayer {
    fn read(&mut self, tag: u64, pb: &mut Protobuf) {
        match tag {
            15 => self.version = pb.read_varint::<u16>(),
            1 => self.name = pb.read_string(),
            2 => self.feature_positions.push(pb.get_pos()),
            3 => {
                self.keys.borrow_mut().push(pb.read_string());
            }
            4 => {
                let mut value = PrimitiveValue::Null;
                pb.read_message(&mut value);
                self.values.borrow_mut().push(value);
            }
            5 => self.extent = pb.read_varint::<usize>(),
            #[tarpaulin::skip]
            _ => panic!("Unknown layer type"),
        }
    }
}

/// Write a layer to a protobuffer using the S2 Specification
pub fn write_layer(layer: &BaseVectorLayer, mapbox_support: bool) -> Vec<u8> {
    let mut pbf = Protobuf::new();
    let mut keys: BTreeMap<String, usize> = BTreeMap::new();
    let mut values: BTreeMap<PrimitiveValue, usize> = BTreeMap::new();

    pbf.write_varint_field(15, if mapbox_support { 1 } else { 5 });
    pbf.write_string_field(1, &layer.name);
    for feature in layer.features.iter() {
        pbf.write_bytes_field(2, &write_feature(feature, &mut keys, &mut values, mapbox_support));
    }
    let mut keys: Vec<(String, usize)> = keys.into_iter().collect();
    keys.sort_by(|a, b| a.1.cmp(&b.1));
    // keys and values
    for (key, _) in keys.iter() {
        pbf.write_string_field(3, key);
    }
    let mut values: Vec<(PrimitiveValue, usize)> = values.into_iter().collect();
    values.sort_by(|a, b| a.1.cmp(&b.1));
    for (value, _) in values.iter() {
        pbf.write_message(4, value);
    }
    pbf.write_varint_field(5, layer.extent as usize);

    pbf.take()
}
