import { OColumnName } from "./columnCache";
import { writeFeature, OVectorFeature } from "./vectorFeature";
import Protobuf from "../pbf";

import type { ColumnCacheReader, ColumnCacheWriter } from "./columnCache";
import type { BaseVectorLayer } from "../baseVectorTile";

export type Extents = 8_192 | 4_096 | 2_048 | 1_024;

export class OVectorLayer {
  version: number = 1;
  name: string = "";
  extent: Extents = 4096;
  features: OVectorFeature[] = [];
  #pbf: Protobuf;
  #cache: ColumnCacheReader;
  #featuresPos: number[] = [];
  constructor(pbf: Protobuf, end: number, cache: ColumnCacheReader) {
    this.#pbf = pbf;
    this.#cache = cache;
    pbf.readFields(this.#readLayer, this, end);
  }

  #readLayer(tag: number, layer: OVectorLayer, pbf: Protobuf): void {
    // lets convert from switch to if statements
    if (tag === 1) layer.name = layer.#cache.getColumn(OColumnName.string, pbf.readVarint());
    else if (tag === 2) layer.version = pbf.readVarint();
    else if (tag === 3) layer.extent = decodeExtent(pbf.readVarint());
    else if (tag === 4) layer.#featuresPos.push(pbf.pos);
  }

  feature(i: number): OVectorFeature {
    if (i < 0 || i >= this.#featuresPos.length) throw new Error("feature index out of bounds");
    if (this.features[i] !== undefined) return this.features[i];

    this.#pbf.pos = this.#featuresPos[i];
    // readFeature should return OVectorFeature which is a type combining all 6 feature types
    return (this.features[i] = readFeature(this.#pbf.readBytes(), this.extent, this.#cache));
  }
}

/**
 * Because of the Column Cache, a layer will contain:
 * - version 1 byte
 * - extent (1 byte) - 1 -> 1024, 2 -> 2048, 3 -> 4096, 4 -> 8192
 * - name (varint) - index into the string columns table
 * - features (writeMessage) - for each feature
 */
export function writeLayer(
  { layer, cache }: { layer: BaseVectorLayer; cache: ColumnCacheWriter },
  pbf: Protobuf,
): void {
  pbf.writeVarintField(1, layer.version);
  pbf.writeVarintField(2, cache.addColumnData(OColumnName.string, layer.name));
  pbf.writeVarintField(3, encodeExtent(layer.extent as Extents));
  // first write size
  for (const feature of layer.features) pbf.writeBytesField(4, writeFeature(feature, cache));
}

function encodeExtent(extent: Extents): number {
  switch (extent) {
    case 8192:
      return 4;
    case 4096:
      return 3;
    case 2048:
      return 2;
    case 1024:
      return 1;
    default:
      throw new Error("invalid extent, must be 1024, 2048, 4096, or 8192");
  }
}

function decodeExtent(extent: number): Extents {
  switch (extent) {
    case 4:
      return 8192;
    case 3:
      return 4096;
    case 2:
      return 2048;
    case 1:
      return 1024;
    default:
      throw new Error("invalid extent, must be 1024, 2048, 4096, or 8192");
  }
}
