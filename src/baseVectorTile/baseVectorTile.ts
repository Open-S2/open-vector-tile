import { VectorTile } from "../";
import BaseVectorLayer from "./baseVectorLayer";
// TODO: parseOpenVectorTile
// TODO: parseGeoJSON

export default class BaseVectorTile {
  constructor(public layers: Record<string, BaseVectorLayer> = {}) {}

  static fromVectorTile(tile: VectorTile): BaseVectorTile {
    const vectorTile = new BaseVectorTile();
    for (const layer in tile.layers) {
      vectorTile.layers[layer] = BaseVectorLayer.fromVectorLayer(tile.layers[layer]);
    }

    return vectorTile;
  }
}
