use pbf::{ProtoRead, Protobuf};

use alloc::collections::BTreeMap;
use alloc::rc::Rc;
use alloc::string::String;
use alloc::vec::Vec;

use core::cell::RefCell;

use crate::base::BaseVectorTile;
use crate::mapbox::{write_layer, MapboxVectorLayer};

/// The vector tile struct that covers both "open" and "mapbox" specifications
pub struct VectorTile {
    /// the layers in the vector tile
    pub layers: BTreeMap<String, MapboxVectorLayer>,
    /// the protobuf for the vector tile
    pbf: Rc<RefCell<Protobuf>>,
}
impl VectorTile {
    /// Create a new vector tile
    pub fn new(data: Vec<u8>, end: Option<usize>) -> Self {
        let pbf = Rc::new(RefCell::new(data.into()));
        let pbf_clone = pbf.clone();
        let mut vt = VectorTile {
            pbf,
            layers: BTreeMap::new(),
        };

        let mut tmp_pbf = pbf_clone.borrow_mut();
        tmp_pbf.read_fields(&mut vt, end);

        vt
    }
}
impl ProtoRead for VectorTile {
    fn read(&mut self, tag: u64, pb: &mut Protobuf) {
        match tag {
            1 | 3 => {
                let layer = MapboxVectorLayer::new(
                    self.pbf.clone(),
                    pb.read_varint::<usize>() + pb.get_pos(),
                    tag == 3,
                );
                self.layers.insert(pb.read_string(), layer);
            }
            _ => panic!("unknown tag: {}", tag),
        }
    }
}

/// writer for converting a BaseVectorTile to encoded bytes of the Open Vector Tile format
pub fn write_tile(tile: &mut BaseVectorTile) -> Vec<u8> {
    let mut pbf = Protobuf::new();

    // first write layers
    for layer in tile.layers.values() {
        pbf.write_bytes_field(3, &write_layer(layer));
    }

    pbf.take()
}
