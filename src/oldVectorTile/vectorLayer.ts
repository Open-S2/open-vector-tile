import VectorFeature from "./vectorFeature";

import type Protobuf from "../pbf";
import type { Value } from "../vectorTile.spec";

export default class VectorLayer {
  version = 5;
  name = "default";
  extent = 4_096;
  length = 0;
  isS2: boolean;
  #pbf: Protobuf;
  #keys: string[] = [];
  #values: Value[] = [];
  #featuresPos: number[] = [];
  features: VectorFeature[] = [];
  constructor(pbf: Protobuf, end: number, isS2 = false) {
    this.#pbf = pbf;
    this.isS2 = isS2;
    pbf.readFields(this.readLayer, this, end);
    this.length = this.#featuresPos.length;
  }

  readLayer(tag: number, layer: VectorLayer, pbf: Protobuf): void {
    if (tag === 15) layer.version = pbf.readVarint();
    else if (tag === 1) layer.name = pbf.readString();
    else if (tag === 2) layer.#featuresPos.push(pbf.pos);
    else if (tag === 3) layer.#keys.push(pbf.readString());
    else if (tag === 4) layer.#values.push(layer.readValueMessage(pbf));
    else if (tag === 5) layer.extent = pbf.readVarint();
  }

  feature(i: number): VectorFeature {
    if (i < 0 || i >= this.#featuresPos.length) throw new Error("feature index out of bounds");
    if (this.features[i] !== undefined) return this.features[i];

    this.#pbf.pos = this.#featuresPos[i];
    const end = this.#pbf.readVarint() + this.#pbf.pos;
    const vtf = (this.features[i] = new VectorFeature(
      this.#pbf,
      end,
      this.isS2,
      this.extent,
      this.version,
      this.#keys,
      this.#values,
    ));

    return vtf;
  }

  readValueMessage(pbf: Protobuf): Value {
    let value: Value = null;

    const end = pbf.readVarint() + pbf.pos;

    while (pbf.pos < end) {
      const tag = pbf.readVarint() >> 3;

      switch (tag) {
        case 1:
          value = pbf.readString();
          break;
        case 2:
          value = pbf.readFloat();
          break;
        case 3:
          value = pbf.readDouble();
          break;
        case 4:
          value = pbf.readVarint64();
          break;
        case 5:
          value = pbf.readVarint();
          break;
        case 6:
          value = pbf.readSVarint();
          break;
        case 7:
          value = pbf.readBoolean();
          break;
        default:
          value = null;
      }
    }

    return value;
  }
}
