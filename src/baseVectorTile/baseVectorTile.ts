import BaseVectorLayer from './baseVectorLayer';
import { MapboxVectorLayer, VectorTile } from '../';
// TODO: parseOpenVectorTile
// TODO: parseGeoJSON

/**
 *
 */
export default class BaseVectorTile {
  /**
   * @param layers
   */
  constructor(public layers: Record<string, BaseVectorLayer> = {}) {}

  /**
   * @param tile
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
