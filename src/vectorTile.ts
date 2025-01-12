import { MapboxVectorLayer } from './mapbox';
import { Pbf as Protobuf } from 'pbf-ts';
import { BaseVectorLayer, BaseVectorTile } from './base';
import {
  ColumnCacheReader,
  ColumnCacheWriter,
  GridData,
  ImageData,
  OVectorLayer,
  writeGridData,
  writeImageData,
  writeOVLayer,
} from './open';

import type { GridInput, ImageDataInput } from './open';

/**
 * Layers are a storage structure for the vector tile.
 * It may contain either the old Mapbox layers or the new OpenVectorTile layers
 */
type Layers = Record<string, MapboxVectorLayer | OVectorLayer>;

/**
 * # Open Vector Tile
 *
 * ## Description
 * A Vector Tile may parse either Mapbox or OpenVector Tile Layers
 * The input is a Uint8Array that has encoded protobuffer messages.
 * @see {@link Protobuf}.
 *
 * Types of layers include:
 * - Vector data - vector points, lines, and polygons with 3D coordinates, properties, and/or m-values
 * - Image data - raster data that is RGB(A) encoded
 * - Grid data: data that has a max-min range, works much like an image but has floating/double
 * precision point values for each point on the grid
 *
 * ## Usage
 *
 * ```ts
 * const fs = from 'fs';
 * import { VectorTile } from 'open-vector-tile';
 *
 * // assume you can read (.pbf | .mvt | .ovt)
 * const fixture = fs.readFileSync('./x-y-z.vector.pbf');
 * // Or load with bun:
 * const fixture = await Bun.file('./x-y-z.vector.pbf').arrayBuffer();
 * // load the protobuf parsing it directly
 * const tile = new VectorTile(fixture);
 *
 * // VECTOR API:
 *
 * // example layer
 * const { landuse } = tile.layers;
 *
 * // grab the first feature
 * const firstFeature = landuse.feature(0);
 * // grab the geometry
 * const geometry = firstFeature.loadGeometry();
 * // OR specifically ask for a geometry type
 * const points = firstFeature.loadPoints();
 * const lines = firstFeature.loadLines();
 * const polys = firstFeature.loadPolys();
 *
 * // If you want to take advantage of the pre-tessellated and indexed geometries
 * // and you're loading the data for a renderer, you can grab the pre-tessellated geometry
 * const [flatGeometry, indices] = firstFeature.loadGeometryFlat();
 *
 * // IMAGE API
 *
 * // example layer
 * const { satellite } = tile.images;
 * // grab the image data
 * const data = satellite.image(); // Uint8Array
 *
 * // GRIDDED API
 *
 * // example layer
 * const { elevation } = tile.grids;
 * // grab the grid data
 * const data = elevation.grid(); // number[]
 * ```
 */
export class VectorTile {
  #columns!: ColumnCacheReader;
  readonly layers: Layers = {};
  #layerIndexes: number[] = [];
  images: Record<string, ImageData> = {};
  grids: Record<string, GridData> = {};
  /**
   * @param data - the input data to parse
   * @param end - the size of the data, leave blank to parse the entire data
   */
  constructor(data: ArrayBuffer | Uint8Array, end = 0) {
    const pbf = new Protobuf(data);
    pbf.readFields(this.#readTile, this, end);
    this.#readLayers(pbf);
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
      const gridData = new GridData(pbf, pbf.readVarint() + pbf.pos);
      vectorTile.grids[gridData.name] = gridData;
    } else if (tag === 7) {
      const imageData = new ImageData(pbf, pbf.readVarint() + pbf.pos);
      vectorTile.images[imageData.name] = imageData;
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
 * You have the option to store:
 * - Vector data - vector points, lines, and polygons with 3D coordinates, properties, and/or m-values
 * - Image data - raster data that is RGB(A) encoded
 * - Grid data: data that has a max-min range, works much like an image but has floating/double
 * precision point values for each point on the grid
 * @param tile - the tile may be a base vector tile or a S2/Mapbox vector tile
 * @param images - if provided, the tile will include image(s)
 * @param griddedData - if provodied, the grid based data to encode with specs on how to encode
 * @param verbose - whether to print debug messages
 * @returns - a protobuffer encoded buffer using the Open Vector Tile Spec
 */
export function writeOVTile(
  tile?: BaseVectorTile | VectorTile,
  images?: ImageDataInput[],
  griddedData?: GridInput[],
  verbose = false,
): Uint8Array {
  const pbf = new Protobuf();
  const cache = new ColumnCacheWriter();

  // first write layers
  if (tile !== undefined) {
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
  }
  // write the image if applicable
  if (images !== undefined) {
    for (const image of images) {
      pbf.writeBytesField(7, writeImageData(image));
    }
  }
  // write the grid data if provided
  if (griddedData !== undefined) {
    for (const gridData of griddedData) {
      pbf.writeBytesField(6, writeGridData(gridData));
    }
    return pbf.commit();
  }

  return pbf.commit();
}
