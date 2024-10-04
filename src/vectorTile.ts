import { MapboxVectorLayer } from './mapbox';
import { Pbf as Protobuf } from 's2-tools';
import { BaseVectorLayer, BaseVectorTile } from './base';
import {
  ColumnCacheReader,
  ColumnCacheWriter,
  ElevationData,
  ImageData,
  OVectorLayer,
  writeElevationData,
  writeImageData,
  writeOVLayer,
} from './open';

import type { ElevationInput, ImageDataInput } from './open';

/**
 * Layers are a storage structure for the vector tile.
 * It may contain either the old Mapbox layers or the new OpenVectorTile layers
 */
type Layers = Record<string, MapboxVectorLayer | OVectorLayer>;

/**
 * A Vector Tile may parse either Mapbox or OpenVector Tile Layers
 * The input is a Uint8Array that has encoded protobuffer messages.
 * @see {@link Protobuf}.
 *
 * Example:
 *
 * ```ts
 * import { VectorTile } from 'open-vector-tile';
 *
 * const vectorTile = new VectorTile(data);
 * const { landuse } = vectorTile.layers;
 * const firstFeature = landuse.features(0);
 * ```
 */
export class VectorTile {
  #columns!: ColumnCacheReader;
  readonly layers: Layers = {};
  #layerIndexes: number[] = [];
  imageData?: ImageData;
  elevationData?: ElevationData;
  /**
   * @param data - the input data to parse
   * @param end - the size of the data, leave blank to parse the entire data
   */
  constructor(data: Uint8Array, end = 0) {
    const pbf = new Protobuf(data);
    pbf.readFields(this.#readTile, this, end);
    this.#readLayers(pbf);
  }

  /**
   * Read the elevation data if it exists
   * @returns - the elevation data
   */
  readElevationData(): number[] | undefined {
    if (this.elevationData === undefined || this.elevationData.data.length === 0) return;
    return this.elevationData.data;
  }

  /**
   * Read in the tile data
   * @param tag - the tag to read
   * @param vectorTile - the vector tile to mutate
   * @param pbf - the Protobuf to pull the appropriate data from
   */
  #readTile(tag: number, vectorTile: VectorTile, pbf: Protobuf): void {
    if (tag === 1 || tag === 3) {
      const layer = new MapboxVectorLayer(pbf, pbf.readVarint() + pbf.pos, tag === 1);
      if (layer.length !== 0) vectorTile.layers[layer.name] = layer;
    } else if (tag === 4) {
      // store the position of each layer for later retrieval.
      // Columns must be prepped before reading the layer.
      vectorTile.#layerIndexes.push(pbf.pos);
    } else if (tag === 5) {
      vectorTile.#columns = new ColumnCacheReader(pbf, pbf.readVarint() + pbf.pos);
    } else if (tag === 6) {
      const elevationData = new ElevationData();
      pbf.readMessage(elevationData._read, elevationData);
      vectorTile.elevationData = elevationData;
    } else if (tag === 7) {
      const imageData = new ImageData();
      pbf.readMessage(imageData._read, imageData);
      vectorTile.imageData = imageData;
    }
  }

  /**
   * @param pbf - the pbf to read from
   */
  #readLayers(pbf: Protobuf): void {
    for (const pos of this.#layerIndexes) {
      pbf.pos = pos;
      const layer = new OVectorLayer(pbf, pbf.readVarint() + pbf.pos, this.#columns);
      this.layers[layer.name] = layer;
    }
  }
}

/**
 * Write a tile to a Protobuf. and return a buffer
 * @param tile - the tile may be a base vector tile or a S2/Mapbox vector tile
 * @param image - if provided, the tile will include an image
 * @param verbose - whether to print debug messages
 * @returns - a protobuffer encoded buffer using the Open Vector Tile Spec
 */
export function writeOVTile(
  tile: BaseVectorTile | VectorTile = new BaseVectorTile(),
  image?: ImageDataInput,
  verbose = false,
): Uint8Array {
  const pbf = new Protobuf();
  const cache = new ColumnCacheWriter();

  // first write layers
  for (const key in tile.layers) {
    const layer = tile.layers[key];
    if (layer instanceof OVectorLayer) continue;
    const baseLayer =
      layer instanceof MapboxVectorLayer ? BaseVectorLayer.fromMapboxVectorLayer(layer) : layer;
    if (verbose === true) console.info('writing layer', baseLayer.name);
    pbf.writeMessage(4, writeOVLayer, { layer: baseLayer, cache, verbose });
  }
  // now we can write columns
  pbf.writeMessage(5, ColumnCacheWriter.write, cache);
  // write the image if applicable
  if (image !== undefined) {
    const imageTile = writeImageData(image);
    pbf.writeBytesField(
      7,
      Buffer.from(imageTile.buffer, imageTile.byteOffset, imageTile.byteLength),
    );
  }

  return pbf.commit();
}

/**
 * @param elevationData - the elevation data to encode with specs on how to encode
 * @returns - the encoded data
 */
export function writeElevationTile(elevationData: ElevationInput): Uint8Array {
  const pbf = new Protobuf();

  const data = writeElevationData(elevationData);
  pbf.writeBytesField(6, Buffer.from(data.buffer, data.byteOffset, data.byteLength));
  return pbf.commit();
}
