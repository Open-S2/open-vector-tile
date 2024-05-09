import { VectorLayer } from "../index";
import { fromVectorFeature } from "./baseVectorFeature";

import type { BaseVectorFeature } from "./baseVectorFeature";

export default class BaseVectorLayer {
  constructor(
    public version: number = 1,
    public name: string = "",
    public extent: number = 4096,
    public features: BaseVectorFeature[] = [],
  ) {}

  feature(i: number): BaseVectorFeature {
    if (i < 0 || i >= this.features.length) throw new Error("feature index out of bounds");
    return this.features[i];
  }

  static fromVectorLayer(layer: VectorLayer): BaseVectorLayer {
    const vectorLayer = new BaseVectorLayer();
    vectorLayer.version = layer.version;
    vectorLayer.name = layer.name;
    vectorLayer.extent = layer.extent;
    for (let i = 0; i < layer.length; i++) {
      vectorLayer.features.push(fromVectorFeature(layer.feature(i)));
    }
    return vectorLayer;
  }
}
