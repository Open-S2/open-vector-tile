import VectorFeature from './vectorFeature';

import type { Extents } from '../open';
import type { Pbf as Protobuf } from '../pbf';
import type { Value } from '../vectorTile.spec';

/**
 * A MapboxVectorLayer is a storage structure for the vector tile.
 * It may contain either the old Mapbox layers or the new S2 layers.
 * Parses extent, keys, values, and features. Features will utilize the extent, keys, and values.
 */
export default class MapboxVectorLayer {
  version = 5;
  name = 'default';
  extent: Extents = 4_096;
  length = 0;
  isS2: boolean;
  #pbf: Protobuf;
  #keys: string[] = [];
  #values: Value[] = [];
  #featuresPos: number[] = [];
  #features = new Map<number, VectorFeature>();
  /**
   * @param pbf - The Protobuf object to read from
   * @param end - The end position of the message in the buffer
   * @param isS2 - Whether the layer is an S2 layer or Mapbox layer
   */
  constructor(pbf: Protobuf, end: number, isS2 = false) {
    this.#pbf = pbf;
    this.isS2 = isS2;
    pbf.readFields(this.#readLayer, this, end);
    this.length = this.#featuresPos.length;
  }

  /**
   * @param tag - The tag of the message
   * @param layer - The layer to mutate
   * @param pbf - The Protobuf object to read from
   */
  #readLayer(tag: number, layer: MapboxVectorLayer, pbf: Protobuf): void {
    if (tag === 15) layer.version = pbf.readVarint();
    else if (tag === 1) layer.name = pbf.readString();
    else if (tag === 2) layer.#featuresPos.push(pbf.pos);
    else if (tag === 3) layer.#keys.push(pbf.readString());
    else if (tag === 4) layer.#values.push(layer.#readValueMessage(pbf));
    else if (tag === 5) layer.extent = pbf.readVarint() as Extents;
  }

  /**
   * @param i - The index of the feature
   * @returns - A feature at the given index
   */
  feature(i: number): VectorFeature {
    if (i < 0 || i >= this.#featuresPos.length) throw new Error('feature index out of bounds');
    let vtf = this.#features.get(i);
    if (vtf !== undefined) return vtf;

    this.#pbf.pos = this.#featuresPos[i];
    const end = this.#pbf.readVarint() + this.#pbf.pos;
    vtf = new VectorFeature(
      this.#pbf,
      end,
      this.isS2,
      this.extent,
      this.version,
      this.#keys,
      this.#values,
    );

    this.#features.set(i, vtf);

    return vtf;
  }

  /**
   * @param pbf - The Protobuffer object to read from
   * @returns - A parsed Value
   */
  #readValueMessage(pbf: Protobuf): Value {
    let value: Value = null;

    const end = pbf.readVarint() + pbf.pos;

    while (pbf.pos < end) {
      const tag = pbf.readVarint() >> 3;

      if (tag === 1) value = pbf.readString();
      else if (tag === 2) value = pbf.readFloat();
      else if (tag === 3) value = pbf.readDouble();
      else if (tag === 4) value = pbf.readVarint64();
      else if (tag === 5) value = pbf.readVarint();
      else if (tag === 6) value = pbf.readSVarint();
      else if (tag === 7) value = pbf.readBoolean();
      else value = null;
    }

    return value;
  }
}
