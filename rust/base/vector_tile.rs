use crate::{
    base::BaseVectorLayer, mapbox::vector_tile::MapboxVectorTile, VectorLayer, VectorTile,
};
use alloc::{collections::BTreeMap, string::String};

/// Base Vector Tile
/// This is an intermediary for storing feature data in the Open Vector Tile format.
/// Convert from either a Mapbox vector tile or GeoJSON data.
#[derive(Debug, Default)]
pub struct BaseVectorTile {
    /// the layers in the tile that hold features
    pub layers: BTreeMap<String, BaseVectorLayer>,
}
impl BaseVectorTile {
    /// Add a new layer to the tile
    pub fn add_layer(&mut self, layer: BaseVectorLayer) {
        self.layers.insert(layer.name.clone(), layer);
    }
}
impl From<&mut VectorTile> for BaseVectorTile {
    /// Convert from Mapbox vector tile
    fn from(vector_tile: &mut VectorTile) -> Self {
        let mut tile = BaseVectorTile { layers: BTreeMap::new() };
        for (name, layer) in vector_tile.layers.iter_mut() {
            if let VectorLayer::Mapbox(layer) = layer {
                tile.layers.insert(name.clone(), layer.into());
            }
        }
        tile
    }
}
impl From<&mut MapboxVectorTile> for BaseVectorTile {
    /// Convert from Mapbox vector layer
    fn from(vector_tile: &mut MapboxVectorTile) -> Self {
        let mut tile = BaseVectorTile { layers: BTreeMap::new() };
        for (name, layer) in vector_tile.layers.iter_mut() {
            tile.layers.insert(name.clone(), layer.into());
        }
        tile
    }
}
