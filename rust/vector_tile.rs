use pbf::{ProtoRead, Protobuf};

use alloc::vec::Vec;
use alloc::string::String;
use alloc::collections::BTreeMap;
use alloc::rc::Rc;

use core::cell::RefCell;

use crate::base::BaseVectorTile;
use crate::mapbox::MapboxVectorLayer;
use crate::open::{write_layer, ColumnCacheReader, ColumnCacheWriter, OpenVectorLayer};

/// Methods that all vector layers should have
pub trait VectorLayerMethods {
    /// the version of the vector tile layer.
    fn version(&self) -> u16;
    /// the name of the layer
    fn name(&self) -> String;
    /// the extent of the vector tile (only **512**, **1_024**, **2_048**, **4_096**, and **8_192**
    /// are supported for the open spec)
    fn extent(&self) -> usize;
}

/// Layer container supporting both mapbox and open vector layers
pub enum VectorLayer {
    /// Mapbox vector layer
    Mapbox(MapboxVectorLayer),
    /// Open vector layer
    Open(OpenVectorLayer),
}
impl VectorLayerMethods for VectorLayer {
    fn version(&self) -> u16 {
        match self {
            VectorLayer::Mapbox(layer) => layer.version(),
            VectorLayer::Open(layer) => layer.version(),
        }
    }

    fn name(&self) -> String {
        match self {
            VectorLayer::Mapbox(layer) => layer.name(),
            VectorLayer::Open(layer) => layer.name(),
        }
    }

    fn extent(&self) -> usize {
        match self {
            VectorLayer::Mapbox(layer) => layer.extent(),
            VectorLayer::Open(layer) => layer.extent(),
        }
    }
}

/// The vector tile struct that covers both "open" and "mapbox" specifications
pub struct VectorTile {
    /// the layers in the vector tile
    pub layers: BTreeMap<String, VectorLayer>,
    /// indexes to track the layers. Needed for the open spec because we need the cache before we can
    /// parse layers and features
    layer_indexes: Vec<usize>,
    /// the protobuf for the vector tile
    pbf: Rc<RefCell<Protobuf>>,
    /// the column cache
    columns: Option<Rc<RefCell<ColumnCacheReader>>>,
}
impl VectorTile {
    /// Create a new vector tile
    pub fn new(data: RefCell<Vec<u8>>, end: Option<usize>) -> Self {
        let pbf = Rc::new(RefCell::new(Protobuf::from_input(data)));
        let pbf_clone = pbf.clone();
        let mut vt = VectorTile {
            pbf,
            columns: None,
            layer_indexes: Vec::new(),
            layers: BTreeMap::new()
        };

        let mut tmp_pbf = pbf_clone.borrow_mut();
        tmp_pbf.read_fields(&mut vt, end);

        vt.read_layers();

        vt
    }

    /// Read the layers
    pub fn read_layers(&mut self) -> Option<()> {
        let layer_indexes = self.layer_indexes.clone();
        let pbf_clone = self.pbf.clone();
        let mut tmp_pbf = pbf_clone.borrow_mut();
        let cache = self.columns.as_ref()?.clone();

        for pos in layer_indexes {
          tmp_pbf.set_pos(pos);
          let layer = OpenVectorLayer::new(
            self.pbf.clone(),
            cache.clone()
          );
          self.layers.insert(layer.name.clone(), VectorLayer::Open(layer));
        }

        Some(())
    }
}
impl ProtoRead for VectorTile {
    fn read(&mut self, tag: u64, pb: &mut Protobuf) {
        match tag {
            1 | 3 => {
                let layer = VectorLayer::Mapbox(MapboxVectorLayer::new(
                    self.pbf.clone(),
                    pb.read_varint::<usize>() + pb.get_pos(),
                    tag == 3
                ));
                self.layers.insert(pb.read_string(), layer);
            },
            4 => {
                // store the position of each layer for later retrieval.
                // Columns must be prepped before reading the layer.
                self.layer_indexes.push(pb.get_pos());
            },
            5 => {
                // vectorTile.#columns = new ColumnCacheReader(pbf, pbf.readVarint() + pbf.pos);
                self.columns = Some(Rc::new(RefCell::new(ColumnCacheReader::new(
                    self.pbf.clone(),
                    pb.read_varint::<usize>() + pb.get_pos()
                ))));
            },
            _ => panic!("unknown tag: {}", tag),
        }
    }
}

/// writer for converting a BaseVectorTile to encoded bytes of the Open Vector Tile format
pub fn write_tile(tile: &mut BaseVectorTile) -> Vec<u8> {
    let mut pbf = Protobuf::new();
    let mut cache = ColumnCacheWriter::default();

    // first write layers
    for layer in tile.layers.values_mut() {
        pbf.write_bytes_field(4, &write_layer(layer, &mut cache));
    }
    // now we can write columns
    pbf.write_message(5, &cache);

    pbf.take()
}
