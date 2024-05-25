import { MapboxVectorLayer } from '../';
import { fromMapboxVectorFeature } from './baseVectorFeature';

import type { BaseVectorFeature } from './baseVectorFeature';

/**
 * Base Vector Layer
 * This is an intermediary for storing layer data in the Open Vector Tile format.
 */
export default class BaseVectorLayer {
  /**
   * @param version - the version of the vector tile. This is a number that tracks the OVT specification. and shouldn't be tampered with
   * @param name - the name of the layer
   * @param extent - the extent of the vector tile (only **512**, **1_024**, **2_048**, **4_096**, and **8_192** are supported)
   * @param features - the **Base Vector Feature**s stored in the layer.
   */
  constructor(
    public version: number = 1,
    public name: string = '',
    public extent: number = 4096,
    public features: BaseVectorFeature[] = [],
  ) {}

  /**
   * Add a new feature to the layer
   * @param feature - the new feature to add
   */
  addFeature(feature: BaseVectorFeature): void {
    this.features.push(feature);
  }

  /**
   * @param i - index of the feature to return
   * @returns A base vector feature at the given index
   */
  feature(i: number): BaseVectorFeature {
    if (i < 0 || i >= this.features.length) throw new Error('feature index out of bounds');
    return this.features[i];
  }

  /**
   * @returns The number of features in the layer
   */
  get length(): number {
    return this.features.length;
  }

  /**
   * @param layer - a Mapbox Vector Layer
   * @returns A Base Vector Layer
   */
  static fromMapboxVectorLayer(layer: MapboxVectorLayer): BaseVectorLayer {
    const vectorLayer = new BaseVectorLayer();
    vectorLayer.version = layer.version;
    vectorLayer.name = layer.name;
    vectorLayer.extent = layer.extent;
    for (let i = 0; i < layer.length; i++) {
      vectorLayer.features.push(fromMapboxVectorFeature(layer.feature(i)));
    }
    return vectorLayer;
  }
}
