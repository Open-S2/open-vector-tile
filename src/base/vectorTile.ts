import BaseVectorLayer from './vectorLayer';
import MapboxVectorLayer from '../mapbox/vectorLayer';
import { VectorTile } from '../vectorTile';

/**
 * Base Vector Tile
 * This is an intermediary for storing feature data in the Open Vector Tile format.
 * Convert from either a Mapbox vector tile or GeoJSON data.
 */
export default class BaseVectorTile {
  /**
   * @param layers - the layers in the tile
   */
  constructor(public layers: Record<string, BaseVectorLayer> = {}) {}

  /**
   * @param tile - the tile data to convert. Only Mapobx vector tiles are supported
   * @returns - The converted Base Vector Tile
   */
  static fromVectorTile(tile: VectorTile): BaseVectorTile {
    const vectorTile = new BaseVectorTile();
    for (const layerName in tile.layers) {
      const layer = tile.layers[layerName];
      if (!(layer instanceof MapboxVectorLayer)) throw Error('Unsupported vector tile type');
      vectorTile.layers[layerName] = BaseVectorLayer.fromMapboxVectorLayer(layer);
    }

    return vectorTile;
  }
}
