import { OColumnName } from './columnCache';
import { OVectorFeature, readFeature, writeOVFeature } from './vectorFeature';
import { PbfReader, Pbf as Protobuf } from 'pbf-ts';
import { decodeShape, encodeShape } from './shape';

import type { BaseVectorLayer } from '../base';
import type { Shape } from './shape';
import type { ColumnCacheReader, ColumnCacheWriter } from './columnCache';

/** Extents are the tile size limits of what a user can use to encode a geometry. */
export type Extents = 16_384 | 8_192 | 4_096 | 2_048 | 1_024 | 512;

/**
 * The Open Vector Layer class represents a layer in an Open Vector Tile.
 * Contains an extent, name, version, and features.
 * The features will utilize the layer extent to decode geometry.
 */
export class OVectorLayer {
  version: number = 1;
  name: string = '';
  extent: Extents = 4_096;
  #shapeIndex: number = -1;
  #mShapeIndex: number = -1;
  #features = new Map<number, OVectorFeature>();
  #pbf: PbfReader;
  #cache: ColumnCacheReader;
  #featuresPos: number[] = [];
  /**
   * @param pbf - the pbf protocol we are reading from
   * @param end - the position to stop at
   * @param cache - the cache where all data is stored in a column format
   */
  constructor(pbf: PbfReader, end: number, cache: ColumnCacheReader) {
    this.#pbf = pbf;
    this.#cache = cache;
    pbf.readFields(this.#readLayer, this, end);
  }

  /**
   * @param tag - the tag to know what kind of data to read
   * @param layer - the layer to mutate
   * @param pbf - the pbf to read from
   */
  #readLayer(tag: number, layer: OVectorLayer, pbf: PbfReader): void {
    // lets convert from switch to if statements
    if (tag === 1) layer.version = pbf.readVarint();
    else if (tag === 2) layer.name = layer.#cache.getColumn(OColumnName.string, pbf.readVarint());
    else if (tag === 3) layer.extent = decodeExtent(pbf.readVarint());
    else if (tag === 4) layer.#featuresPos.push(pbf.pos);
    else if (tag === 5) layer.#shapeIndex = pbf.readVarint();
    else if (tag === 6) layer.#mShapeIndex = pbf.readVarint();
  }

  /** @returns - The number of features in the layer */
  get length(): number {
    return this.#featuresPos.length;
  }

  /** @returns - The shape of the features properties */
  get shape(): Shape {
    return decodeShape(this.#shapeIndex, this.#cache);
  }

  /** @returns - The shape of the M-Values */
  get mShape(): Shape | undefined {
    if (this.#mShapeIndex === -1) return undefined;
    return decodeShape(this.#mShapeIndex, this.#cache);
  }

  /**
   * should return OVectorFeature which is a type combining all 6 feature types
   * @param i - The index of the feature
   * @returns - A feature at the given index
   */
  feature(i: number): OVectorFeature {
    if (i < 0 || i >= this.#featuresPos.length) throw new Error('feature index out of bounds');
    let feature = this.#features.get(i);
    if (feature !== undefined) return feature;

    this.#pbf.pos = this.#featuresPos[i];
    feature = readFeature(this.#pbf.readBytes(), this.extent, this.#cache, this.shape, this.mShape);

    this.#features.set(i, feature);
    return feature;
  }
}

/**
 * @param extent - number are in 512, 1024, 2048, 4096, 8192
 * @returns - remap to smaller values: 0 -> 512, 1 -> 1024, 2 -> 2048, 3 -> 4096, 4 -> 8192
 */
export function encodeExtent(extent: Extents): number {
  if (extent === 16_384) return 5;
  else if (extent === 8_192) return 4;
  else if (extent === 4_096) return 3;
  else if (extent === 2_048) return 2;
  else if (extent === 1_024) return 1;
  else if (extent === 512) return 0;
  else throw new Error('invalid extent, must be 512, 1_024, 2_048, 4_096, 8_192, or 16_384');
}

/**
 * @param encExtent - number are in 0, 1, 2, 3, 4
 * @returns - remap to smaller values: 0 -> 512, 1 -> 1024, 2 -> 2048, 3 -> 4096, 4 -> 8192
 */
export function decodeExtent(encExtent: number): Extents {
  if (encExtent === 5) return 16_384;
  else if (encExtent === 4) return 8_192;
  else if (encExtent === 3) return 4_096;
  else if (encExtent === 2) return 2_048;
  else if (encExtent === 1) return 1_024;
  else if (encExtent === 0) return 512;
  else throw new Error('invalid encoded extent, must be 0, 1, 2, 3, 4, or 5');
}

/**
 * Because of the Column Cache, a layer will contain:
 * - version 1 byte
 * - extent (1 byte) - 1 -> 1024, 2 -> 2048, 3 -> 4096, 4 -> 8192
 * - name (varint) - index into the string columns table
 * - features (writeMessage) - for each feature
 * @param layerCache - object containing the layer and the cache
 * @param layerCache.layer - the layer to encode into the Protobuffer
 * @param layerCache.cache - the cache where all column level data is stored
 * @param layerCache.verbose - set to true to print out write information
 * @param pbf - the pbf protocol we are writing to
 */
export function writeOVLayer(
  layerCache: { layer: BaseVectorLayer; cache: ColumnCacheWriter; verbose: boolean },
  pbf: Protobuf,
): void {
  const { layer, cache, verbose } = layerCache;
  pbf.writeVarintField(1, layer.version);
  pbf.writeVarintField(2, cache.addColumnData(OColumnName.string, layer.name));
  pbf.writeVarintField(3, encodeExtent(layer.extent));
  pbf.writeVarintField(5, encodeShape(cache, layer.shape));
  if (layer.mShape !== undefined) pbf.writeVarintField(6, encodeShape(cache, layer.mShape));

  // sort by feature type
  layer.features = layer.features.sort((a, b) => a.type - b.type);

  for (const feature of layer.features)
    pbf.writeBytesField(4, writeOVFeature(feature, layer.shape, layer.mShape, cache));

  if (verbose) {
    const totals = { points: 0, lines: 0, polys: 0, points3D: 0, lines3D: 0, polys3D: 0, all: 0 };
    for (const feature of layer.features) {
      if (feature.type === 1) totals.points += 1;
      else if (feature.type === 2) totals.lines += 1;
      else if (feature.type === 3) totals.polys += 1;
      else if (feature.type === 4) totals.points3D += 1;
      else if (feature.type === 5) totals.lines3D += 1;
      else if (feature.type === 6) totals.polys3D += 1;
      totals.all += 1;
    }
    console.info(totals);
    console.info(
      `wrote "${layer.name}" with extent "${layer.extent}" and version "${layer.version}"\n`,
    );
  }
}
