import sharp from 'sharp';
import {
  VectorTile,
  convertMapboxElevationData,
  convertTerrariumElevationData,
  writeOVTile,
} from '../../src';
import { expect, test } from 'bun:test';

import type { ElevationInput } from '../../src/open/elevationData';

test('Elevation Tile', async () => {
  const data = await convertImageToHeightMap(__dirname + '/terrarium_ex.webp');
  const inputData: ElevationInput = { size: 512, data, extent: 8_192 };
  const tileData = writeOVTile(undefined, undefined, inputData);
  // encode - decode
  const vectorTile = new VectorTile(tileData);
  const decodedData = vectorTile.readElevationData();
  for (let i = 0; i < data.length; i++) {
    expect(data[i]).toBeCloseTo(decodedData![i], 0);
  }
});

test('convertMapboxElevationData', () => {
  expect(convertMapboxElevationData(0, 0, 0)).toBe(-10000);
  expect(convertMapboxElevationData(255, 255, 255)).toBe(1667721.5);
  expect(convertMapboxElevationData(0, 0, 255)).toBe(-9974.5);
  expect(convertMapboxElevationData(255, 0, 0)).toBe(1661168);
  expect(convertMapboxElevationData(0, 255, 0)).toBe(-3472);
});

/**
 * @param imagePath - input path
 * @returns - an array of heights
 */
async function convertImageToHeightMap(imagePath: string): Promise<number[]> {
  // Load the image using Sharp
  const image = sharp(imagePath);

  // Get the image metadata to determine its dimensions
  const metadata = await image.metadata();

  // Ensure the image is in RGB format
  const { width, height } = metadata;
  const raw = await image.raw().ensureAlpha().toBuffer();

  const heights: number[] = [];

  for (let y = 0; y < height!; y++) {
    for (let x = 0; x < width!; x++) {
      const idx = (y * width! + x) * 4; // 4 because RGBA
      const r = raw[idx];
      const g = raw[idx + 1];
      const b = raw[idx + 2];

      // Apply the formula
      const heightValue = convertTerrariumElevationData(r, g, b);
      heights.push(heightValue);
    }
  }

  return heights;
}
