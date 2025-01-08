import { Pbf as Protobuf } from 'pbf-ts';

/** Image type */
export const enum ImageType {
  /** PNG Image */
  PNG = 0,
  /** JPEG Image */
  JPG = 1,
  /** WEBP Image */
  WEBP = 2,
  /** GIF Image */
  GIF = 3,
  /** AVIF Image */
  AVIF = 4,
  /** SVG Image */
  SVG = 5,
  /** BMP Image */
  BMP = 6,
}
/** String version of ImageType */
export type ImageTypeString = 'png' | 'jpg' | 'webp' | 'gif' | 'avif' | 'svg' | 'bmp';

/** Elevation object to read from */
export class ImageData {
  type: ImageTypeString = 'png';
  width: number = 512;
  height: number = 512;
  image: Uint8Array = new Uint8Array();

  /**
   * @param tag - the tag to read
   * @param elevationData - the elevation data to mutate
   * @param pbf - the Protobuf to pull the appropriate data from
   * @internal
   */
  _read(tag: number, elevationData: ImageData, pbf: Protobuf): void {
    if (tag === 0) elevationData.type = fromImageType(pbf.readVarint() as ImageType);
    else if (tag === 1) elevationData.width = pbf.readVarint();
    else if (tag === 2) elevationData.height = pbf.readVarint();
    else if (tag === 3) elevationData.image = pbf.readBytes();
  }
}

/** Necessary data to encode an image */
export interface ImageDataInput {
  /** The image type */
  type: ImageTypeString;
  /** The width of the image */
  width: number;
  /** The height of the image */
  height: number;
  /** The raw image data */
  image: Buffer;
}

/**
 * @param input - the image data & metadata to encode
 * @returns - the encoded tile data
 */
export function writeImageData(input: ImageDataInput): Uint8Array {
  const pbf = new Protobuf();
  const { type, width, height, image } = input;
  pbf.writeVarintField(0, toImageType(type));
  pbf.writeVarintField(1, width);
  pbf.writeVarintField(2, height);
  pbf.writeBytesField(3, image);

  return pbf.commit();
}

/**
 * @param imageType - the enum to convert
 * @returns - the string
 */
export function fromImageType(imageType: ImageType): ImageTypeString {
  if (imageType === ImageType.PNG) return 'png';
  else if (imageType === ImageType.JPG) return 'jpg';
  else if (imageType === ImageType.WEBP) return 'webp';
  else if (imageType === ImageType.GIF) return 'gif';
  else if (imageType === ImageType.AVIF) return 'avif';
  else if (imageType === ImageType.SVG) return 'svg';
  else if (imageType === ImageType.BMP) return 'bmp';
  throw new Error('Invalid image type');
}

/**
 * @param imageType - the string to convert
 * @returns - the enum
 */
export function toImageType(imageType: ImageTypeString): ImageType {
  if (imageType === 'png') return ImageType.PNG;
  else if (imageType === 'jpg') return ImageType.JPG;
  else if (imageType === 'webp') return ImageType.WEBP;
  else if (imageType === 'gif') return ImageType.GIF;
  else if (imageType === 'avif') return ImageType.AVIF;
  else if (imageType === 'svg') return ImageType.SVG;
  else if (imageType === 'bmp') return ImageType.BMP;
  throw new Error('Invalid image type');
}
