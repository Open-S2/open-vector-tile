import { Pbf as Protobuf } from 's2-tools';
import { deltaDecodeArray, deltaEncodeArray } from '../util';

import type { Extents } from '.';

/** Elevation object to read from */
export class ElevationData {
  data: number[] = [];
  extent: Extents = 8_192;
  size: number = 0;
  min: number = 0;
  max: number = 0;

  /**
   * @param tag - the tag to read
   * @param elevationData - the elevation data to mutate
   * @param pbf - the Protobuf to pull the appropriate data from
   * @internal
   */
  _read(tag: number, elevationData: ElevationData, pbf: Protobuf): void {
    if (tag === 0) elevationData.extent = pbf.readVarint() as Extents;
    else if (tag === 1) elevationData.size = pbf.readVarint();
    else if (tag === 2) elevationData.min = pbf.readFloat();
    else if (tag === 3) elevationData.max = pbf.readFloat();
    else if (tag === 4) {
      elevationData.data = deltaDecodeArray(pbf.readPackedVarint()).map((v) =>
        unmapValue(v, elevationData.min, elevationData.max, elevationData.extent),
      );
    }
  }
}

/**
 * Elevation data input. It is assumed data is the actual elevation data of each point in the tile
 */
export interface ElevationInput {
  /** The size of the square tile. The length and width are the same size */
  size: number;
  /**
   * The actual elevation data assumed to be floating point (32-bit) precise.
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
export function writeElevationData(input: ElevationInput): Uint8Array {
  const pbf = new Protobuf();

  const { data, size, extent } = input;
  const max = data.reduce((a, b) => Math.max(a, b), 0);
  const min = data.reduce((a, b) => Math.min(a, b), 0);
  const re_mapped = data.map((v) => remapValue(v, min, max, extent));
  const d_coded = deltaEncodeArray(re_mapped);

  pbf.writeVarintField(0, extent);
  pbf.writeVarintField(1, size);
  pbf.writeFloatField(2, min);
  pbf.writeFloatField(3, max);
  pbf.writePackedVarint(4, d_coded);

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
