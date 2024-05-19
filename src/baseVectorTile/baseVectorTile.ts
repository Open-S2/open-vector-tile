import BaseVectorLayer from './baseVectorLayer';
import { MapboxVectorLayer, VectorTile } from '../';
// TODO: parseOpenVectorTile
// TODO: parseGeoJSON

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
      if (!(layer instanceof MapboxVectorLayer)) continue;
      vectorTile.layers[layerName] = BaseVectorLayer.fromMapboxVectorLayer(layer);
    }

    return vectorTile;
  }

  // TODO: implement
  // static fromJSON(): BaseVectorTile {}
}
