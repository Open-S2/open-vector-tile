import { Pbf as Protobuf } from 'pbf-ts';
import { deltaDecodeArray, deltaEncodeArray } from '../util';

import type { Extents } from '.';

/** Grid object to read from */
export class GridData {
  #pbf: Protobuf;
  name: string = 'default';
  private dataPos = 0;
  extent: Extents = 8_192;
  size: number = 0;
  min: number = 0;
  max: number = 0;

  /**
   * @param pbf - the pbf protocol we are reading from
   * @param end - the position to stop at
   */
  constructor(pbf: Protobuf, end: number) {
    this.#pbf = pbf;
    pbf.readFields(this.#readGrid, this, end);
  }

  /**
   * Get the raw gridded data. Reads much like a raw image.
   * @returns - the decomposed gridded data
   */
  data(): number[] {
    this.#pbf.pos = this.dataPos;
    return deltaDecodeArray(this.#pbf.readPackedVarint()).map((v) =>
      unmapValue(v, this.min, this.max, this.extent),
    );
  }

  /**
   * @param tag - the tag to read
   * @param grid - the elevation data to mutate
   * @param pbf - the Protobuf to pull the appropriate data from
   */
  #readGrid(tag: number, grid: GridData, pbf: Protobuf): void {
    if (tag === 0) grid.extent = pbf.readVarint() as Extents;
    else if (tag === 1) grid.size = pbf.readVarint();
    else if (tag === 2) grid.min = pbf.readFloat();
    else if (tag === 3) grid.max = pbf.readFloat();
    else if (tag === 4) grid.dataPos = pbf.pos;
    else if (tag === 5) grid.name = pbf.readString();
  }
}

/**
 * Gridded data input. It is assumed data is the actual grid data of each point in the tile
 */
export interface GridInput {
  /** The name of the grid data */
  name: string;
  /** The size of the square tile. The length and width MUST be the same size */
  size: number;
  /**
   * The actual grid data assumed to be floating point (32-bit) precise.
   * It is assumed to find data you can use: `index = y * size + x`
   */
  data: number[];
  /** The extent defines the 0->extent range to remap the data to  */
  extent: Extents;
}

/**
 * @param input - the data to encode
 * @returns - the encoded data
 */
export function writeGridData(input: GridInput): Uint8Array {
  const pbf = new Protobuf();

  const { name, data, size, extent } = input;
  const max = data.reduce((a, b) => Math.max(a, b), 0);
  const min = data.reduce((a, b) => Math.min(a, b), 0);
  const reMapped = data.map((v) => remapValue(v, min, max, extent));
  const d_coded = deltaEncodeArray(reMapped);

  pbf.writeVarintField(0, extent);
  pbf.writeVarintField(1, size);
  pbf.writeFloatField(2, min);
  pbf.writeFloatField(3, max);
  pbf.writePackedVarint(4, d_coded);
  pbf.writeStringField(5, name);

  return pbf.commit();
}

/**
 * @param value - input value to remap
 * @param min - min value
 * @param max - max value
 * @param extent - extent defines the 0->extent range to remap to
 * @returns - remapped value
 */
function remapValue(value: number, min: number, max: number, extent: number): number {
  return Math.round(((value - min) * extent) / (max - min));
}

/**
 * @param value - input value to unmap
 * @param min - min value
 * @param max - max value
 * @param extent - extent defines the 0->extent range to remap from
 * @returns - unremapped value
 */
function unmapValue(value: number, min: number, max: number, extent: number): number {
  return (value * (max - min)) / extent + min;
}

/**
 * @param r - red
 * @param g - green
 * @param b - blue
 * @returns - elevation
 */
export function convertTerrariumElevationData(r: number, g: number, b: number): number {
  return r * 256.0 + g + b / 256.0 - 32768.0;
}

/**
 * @param r - red
 * @param g - green
 * @param b - blue
 * @returns - elevation
 */
export function convertMapboxElevationData(r: number, g: number, b: number): number {
  return -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
}
