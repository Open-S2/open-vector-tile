import { MapboxVectorLayer } from '../';
import { fromMapboxVectorFeature } from './baseVectorFeature';

import type { BaseVectorFeature } from './baseVectorFeature';

/**
 *
 */
export default class BaseVectorLayer {
  /**
   * @param version
   * @param name
   * @param extent
   * @param features
   */
  constructor(
    public version: number = 1,
    public name: string = '',
    public extent: number = 4096,
    public features: BaseVectorFeature[] = [],
  ) {}

  /**
   * @param i - index of the feature to return
   * @returns A base vector feature at the given index
   */
  feature(i: number): BaseVectorFeature {
    if (i < 0 || i >= this.features.length) throw new Error('feature index out of bounds');
    return this.features[i];
  }

  /**
   * @param layer
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

  // TODO: implement
  // static fromJSON(): BaseVectorLayer {}
}
