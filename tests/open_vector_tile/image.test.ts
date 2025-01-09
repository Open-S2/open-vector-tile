import sharp from 'sharp';
import { ImageType, VectorTile, fromImageType, toImageType, writeOVTile } from '../../src';
import { expect, test } from 'bun:test';

import type { ImageDataInput, ImageTypeString } from '../../src/open';

test('Elevation Tile', async () => {
  const sharpInput = sharp(`${__dirname}/terrarium_ex.webp`);
  const imageBuf = await sharpInput.toBuffer({ resolveWithObject: true });
  const { data: image, info } = imageBuf;
  const { format, width, height } = info;
  // encode
  const imageData: ImageDataInput = {
    name: 'terrarium',
    type: format as ImageTypeString,
    image,
    width,
    height,
  };
  const tileData = writeOVTile(undefined, [imageData]);
  // decode
  const vectorTile = new VectorTile(tileData);
  const decodedImage = vectorTile.images.terrarium;
  expect(decodedImage.name).toEqual('terrarium');
  expect(decodedImage.type).toEqual('webp');
  expect(decodedImage.image()).toEqual(image);
  expect(decodedImage.width).toEqual(width);
  expect(decodedImage.height).toEqual(height);
});

test('fromImageType and toImageType', () => {
  expect(fromImageType(ImageType.PNG)).toEqual('png');
  expect(fromImageType(ImageType.JPG)).toEqual('jpg');
  expect(fromImageType(ImageType.WEBP)).toEqual('webp');
  expect(fromImageType(ImageType.GIF)).toEqual('gif');
  expect(fromImageType(ImageType.AVIF)).toEqual('avif');
  expect(fromImageType(ImageType.SVG)).toEqual('svg');
  expect(fromImageType(ImageType.BMP)).toEqual('bmp');
  expect(() => fromImageType(22 as unknown as ImageType)).toThrowError('Invalid image type');

  expect(toImageType('png')).toEqual(ImageType.PNG);
  expect(toImageType('jpg')).toEqual(ImageType.JPG);
  expect(toImageType('webp')).toEqual(ImageType.WEBP);
  expect(toImageType('gif')).toEqual(ImageType.GIF);
  expect(toImageType('avif')).toEqual(ImageType.AVIF);
  expect(toImageType('svg')).toEqual(ImageType.SVG);
  expect(toImageType('bmp')).toEqual(ImageType.BMP);
  expect(() => toImageType('test' as unknown as ImageTypeString)).toThrowError(
    'Invalid image type',
  );
});
