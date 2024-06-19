import MapboxVectorLayer from '../mapbox/vectorLayer';
import { fromMapboxVectorFeature } from './vectorFeature';
import { updateShapeFromData } from '../open/shape';

import type { BaseVectorFeature } from './vectorFeature';
import type { Shape } from '../open/shape';

/**
 * Base Vector Layer
 * This is an intermediary for storing layer data in the Open Vector Tile format.
 */
export default class BaseVectorLayer {
  // if the shape was already passed in to the constructor
  #shapeDefined: boolean = false;
  // if the M-Shape was already passed in to the constructor
  #mShapeDefined: boolean = false;
  // The shape used to describe the features properties in the layer
  shape: Shape;
  /**
   * @param version - the version of the vector tile. This is a number that tracks the OVT specification. and shouldn't be tampered with
   * @param name - the name of the layer
   * @param extent - the extent of the vector tile (only **512**, **1_024**, **2_048**, **4_096**, and **8_192** are supported)
   * @param features - the **Base Vector Feature**s stored in the layer.
   * @param shape - the shape of each feature properies
   * @param mShape - the shape of each feature's M-Values
   */
  constructor(
    public version: number = 1,
    public name: string = '',
    public extent: number = 4096,
    public features: BaseVectorFeature[] = [],
    shape?: Shape,
    public mShape?: Shape,
  ) {
    if (shape !== undefined) {
      this.shape = shape;
      this.#shapeDefined = true;
    } else this.shape = {};
    if (mShape !== undefined) {
      this.mShape = mShape;
      this.#mShapeDefined = true;
    } else this.mShape = {};
  }

  /**
   * Add a new feature to the layer
   * @param feature - the new feature to add
   */
  addFeature(feature: BaseVectorFeature): void {
    this.features.push(feature);
    if (!this.#shapeDefined) updateShapeFromData(this.shape, feature.properties);
    if (!this.#mShapeDefined) {
      const mValues = feature.getMValues();
      if (mValues !== undefined) {
        if (this.mShape === undefined) this.mShape = {};
        for (const mv of mValues) updateShapeFromData(this.mShape, mv);
      }
    }
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
      const bFeature = fromMapboxVectorFeature(layer.feature(i));
      vectorLayer.addFeature(bFeature);
    }
    return vectorLayer;
  }
}
