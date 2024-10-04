import { BaseVectorLayer } from './vectorLayer';
import MapboxVectorLayer from '../mapbox/vectorLayer';
import { VectorTile } from '../vectorTile';

import type { S2JSONLayerMap } from './vectorLayer';
import type { Tile as S2JSONTile } from 's2-tools';

/**
 * Base Vector Tile
 * This is an intermediary for storing feature data in the Open Vector Tile format.
 * Convert from either a Mapbox vector tile or GeoJSON data.
 */
export class BaseVectorTile {
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

  /**
   * @param tile - tile S2JSON data to convert
   * @param layerMap - guide on how to convert the layers
   * @returns - The converted Base Vector Tile
   */
  static fromS2JSONTile(tile: S2JSONTile, layerMap: S2JSONLayerMap): BaseVectorTile {
    const vectorTile = new BaseVectorTile();

    if (!tile.transformed) throw Error('The vector tile must be transformed first');

    for (const [layerName, layer] of Object.entries(tile.layers)) {
      vectorTile.layers[layerName] = BaseVectorLayer.fromS2JSONLayer(layer, layerMap[layerName]);
    }

    return vectorTile;
  }
}
