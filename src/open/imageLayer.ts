import { PbfReader, Pbf as Protobuf } from 'pbf-ts';

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
  /** RAW Image */
  RAW = 7,
  /** Unknown image type */
  UNKNOWN = 8,
}
/** String version of ImageType */
export type ImageTypeString =
  | 'raw'
  | 'png'
  | 'jpg'
  | 'webp'
  | 'gif'
  | 'avif'
  | 'svg'
  | 'bmp'
  | 'unknown';

/** Elevation object to read from */
export class ImageData {
  #pbf: PbfReader;
  name: string = 'default';
  private imagePos: number = 0;
  type: ImageTypeString = 'png';
  width: number = 512;
  height: number = 512;
  /**
   * @param pbf - the pbf protocol we are reading from
   * @param end - the position to stop at
   */
  constructor(pbf: PbfReader, end: number) {
    this.#pbf = pbf;
    pbf.readFields(this.#readImage, this, end);
  }

  /**
   * Reads the image data
   * @returns - the image data
   */
  image(): Uint8Array {
    this.#pbf.pos = this.imagePos;
    return this.#pbf.readBytes();
  }

  /**
   * @param tag - the tag to read
   * @param imageData - the image data to mutate
   * @param pbf - the Protobuf to pull the appropriate data from
   */
  #readImage(tag: number, imageData: ImageData, pbf: PbfReader): void {
    if (tag === 1) imageData.type = fromImageType(pbf.readVarint() as ImageType);
    else if (tag === 2) imageData.width = pbf.readVarint();
    else if (tag === 3) imageData.height = pbf.readVarint();
    else if (tag === 4) imageData.imagePos = pbf.pos;
    else if (tag === 5) imageData.name = pbf.readString();
  }
}

/** Necessary data to encode an image */
export interface ImageDataInput {
  /** The name of the image */
  name: string;
  /** The image type */
  type: ImageTypeString;
  /** The width of the image */
  width: number;
  /** The height of the image */
  height: number;
  /** The raw image data */
  image: Buffer | Uint8Array | ArrayBuffer;
}

/**
 * @param input - the image data & metadata to encode
 * @returns - the encoded tile data
 */
export function writeImageData(input: ImageDataInput): Uint8Array {
  const pbf = new Protobuf();
  const { type, width, height, image } = input;
  pbf.writeVarintField(1, toImageType(type));
  pbf.writeVarintField(2, width);
  pbf.writeVarintField(3, height);
  pbf.writeBytesField(4, image);
  pbf.writeStringField(5, input.name);

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
  else if (imageType === ImageType.RAW) return 'raw';
  else if (imageType === ImageType.UNKNOWN) return 'unknown';
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
  else if (imageType === 'raw') return ImageType.RAW;
  else if (imageType === 'unknown') return ImageType.UNKNOWN;
  throw new Error('Invalid image type');
}
