use crate::base::BaseVectorLayer;
use crate::{VectorLayer, VectorTile};

use alloc::collections::BTreeMap;
use alloc::string::String;

/// Base Vector Tile
/// This is an intermediary for storing feature data in the Open Vector Tile format.
/// Convert from either a Mapbox vector tile or GeoJSON data.
pub struct BaseVectorTile {
    /// the layers in the tile that hold features
    pub layers: BTreeMap<String, BaseVectorLayer>,
}
impl From<VectorTile> for BaseVectorTile {
    /// Convert from Mapbox vector tile
    fn from(vector_tile: VectorTile) -> Self {
        let mut tile = BaseVectorTile {
            layers: BTreeMap::new(),
        };
        for (name, layer) in vector_tile.layers {
            if let VectorLayer::Mapbox(layer) = layer {
                tile.layers.insert(name, layer.into());
            }
        }
        tile
    }
}
