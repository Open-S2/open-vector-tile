use crate::{
    base::BaseVectorTile,
    mapbox::{MapboxVectorLayer, write_layer},
};
use alloc::{collections::BTreeMap, rc::Rc, string::String, vec::Vec};
use core::cell::RefCell;
use pbf::{ProtoRead, Protobuf};

/// The vector tile struct that covers both "open" and "mapbox" specifications
#[derive(Debug)]
pub struct MapboxVectorTile {
    /// the layers in the vector tile
    pub layers: BTreeMap<String, MapboxVectorLayer>,
    /// the protobuf for the vector tile
    pbf: Rc<RefCell<Protobuf>>,
}
impl MapboxVectorTile {
    /// Create a new vector tile
    pub fn new(data: Vec<u8>, end: Option<usize>) -> Self {
        let pbf = Rc::new(RefCell::new(data.into()));
        let mut vt = MapboxVectorTile { pbf: pbf.clone(), layers: BTreeMap::new() };

        let mut tmp_pbf = pbf.borrow_mut();
        tmp_pbf.read_fields(&mut vt, end);

        vt
    }

    /// Get a layer given the name
    pub fn layer(&mut self, name: &str) -> Option<&mut MapboxVectorLayer> {
        self.layers.get_mut(name)
    }
}
impl ProtoRead for MapboxVectorTile {
    fn read(&mut self, tag: u64, pb: &mut Protobuf) {
        match tag {
            1 | 3 => {
                let mut layer = MapboxVectorLayer::new(self.pbf.clone(), tag == 1);
                pb.read_message(&mut layer);
                self.layers.insert(layer.name.clone(), layer);
            }
            #[tarpaulin::skip]
            _ => panic!("unknown tag: {}", tag),
        }
    }
}

/// writer for converting a BaseVectorTile to encoded bytes of the Open Vector Flat Tile format or Mapbox Vector Tile
pub fn write_tile(tile: &mut BaseVectorTile, mapbox_support: bool) -> Vec<u8> {
    let mut pbf = Protobuf::new();

    // first write layers
    for layer in tile.layers.values() {
        pbf.write_bytes_field(
            if mapbox_support { 3 } else { 1 },
            &write_layer(layer, mapbox_support),
        );
    }

    pbf.take()
}
