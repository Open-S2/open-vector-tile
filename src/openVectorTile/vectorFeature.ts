import { OColumnName } from './columnCache';
import { Pbf as Protobuf } from '..';
import { encodeShape, readShape } from './vectorValue';

import type { BaseVectorFeature } from '../baseVectorTile';
import type { Extents } from './vectorLayer';
import type {
  BBox,
  OProperties,
  Point,
  VectorFeatureType,
  VectorPoints,
  VectorPoints3D,
} from '../vectorTile.spec';
import type { ColumnCacheReader, ColumnCacheWriter } from './columnCache';
import { weave2D, zigzag } from 'open-vector-tile/util';

/**
 * Vector Feature Base
 * Common variables and functions shared by all vector features
 */
export class OVectorFeatureBase {
  /**
   * @param cache - the column cache for future retrieval
   * @param id - the id of the feature
   * @param properties - the properties of the feature
   * @param extent - the extent of the feature
   */
  constructor(
    readonly cache: ColumnCacheReader,
    public id: number | undefined,
    public properties: OProperties,
    public extent: Extents,
  ) {}
}

/**
 * Vector Feature Line Base
 * Extends from @see {@link OVectorFeatureBase}.
 * Common variables and functions shared by all line and poly vector features
 */
export class OVectorFeatureLineBase extends OVectorFeatureBase {
  /**
   * @param cache - the column cache for future retrieval
   * @param id - the id of the feature
   * @param properties - the properties of the feature
   * @param extent - the extent of the feature
   * @param geometryIndices - the indices of the geometry in the cache
   * @param bboxIndices - the indices of the bbox in the cache
   * @param mValuesIndex - the index of the mValues in the cache
   */
  constructor(
    cache: ColumnCacheReader,
    id: number | undefined,
    properties: OProperties,
    extent: Extents,
    readonly geometryIndices: number[],
    readonly bboxIndices?: BBox,
    readonly mValuesIndex?: number,
  ) {
    super(cache, id, properties, extent);
  }

  /**
   * @returns true if the feature has M values
   */
  hasMValues(): boolean {
    return this.mValuesIndex !== -1;
  }

  /**
   * @returns the M values
   */
  mValues(): null | OProperties[] {
    if (!this.hasMValues() || !this.mValuesIndex) return null;
    return this.cache.getColumn(OColumnName.values, this.mValuesIndex);
  }
}

/**
 * Points Vector Feature
 * Type 1
 * Extends from @see {@link OVectorFeatureBase}.
 * store either a single point or a list of points
 */
export class OVectorPointsFeature extends OVectorFeatureBase {
  type: VectorFeatureType = 1;
  geometry?: VectorPoints;
  /**
   * @param cache - the column cache for future retrieval
   * @param id - the id of the feature
   * @param properties - the properties of the feature
   * @param extent - the extent of the feature
   * @param geometryIndex - the index of the geometry in the cache
   */
  constructor(
    cache: ColumnCacheReader,
    id: number | undefined,
    properties: OProperties,
    extent: Extents,
    readonly geometryIndex: number,
  ) {
    super(cache, id, properties, extent);
  }

  /**
   * @returns the geometry as an array of points
   */
  loadGeometry(): VectorPoints {
    if (!this.geometry)
      this.geometry = this.cache.getColumn(OColumnName.points, this.geometryIndex) as VectorPoints;
    return this.geometry;
  }
}

/**
 * Lines Vector Feature
 * Type 2
 * Extends from @see {@link OVectorFeatureLineBase}.
 * Store either a single line or a list of lines
 */
export class OVectorLinesFeature extends OVectorFeatureLineBase {
  type: VectorFeatureType = 2;
  /**
   * @param cache - the column cache for future retrieval
   * @param id - the id of the feature
   * @param properties - the properties of the feature
   * @param extent - the extent of the feature
   * @param geometryIndices - the indices of the geometry in the cache
   * @param mValuesIndex - the index of the mValues in the cache
   * @param bboxIndices - the indices of the bbox in the cache
   */
  constructor(
    cache: ColumnCacheReader,
    id: number | undefined,
    properties: OProperties,
    extent: Extents,
    geometryIndices: number[],
    mValuesIndex?: number,
    bboxIndices?: BBox,
  ) {
    super(cache, id, properties, extent, geometryIndices, bboxIndices, mValuesIndex);
  }

  /**
   * @returns the BBox if it exists
   */
  bbox(): BBox | null {
    if (!this.bboxIndices) return null;
    return this.bboxIndices.map((index) => {
      return this.cache.getColumn(OColumnName.double, index);
    }) as BBox;
  }

  // TODO:
  // loadLines: (withMValues?: boolean) => VectorLinesWithOffset;
  // loadGeometry: (withMValues?: boolean) => VectorGeometry;
}

/**
 * Polys Vector Feature
 * Type 3
 * Extends from @see {@link OVectorFeatureLineBase}.
 * Stores either one or multiple polygons. Polygons are an abstraction to polylines, and
 * each polyline can contain an offset.
 */
export class OVectorPolysFeature extends OVectorFeatureLineBase {
  type: VectorFeatureType = 3;
  /**
   * @param cache - the column cache for future retrieval
   * @param id - the id of the feature
   * @param properties - the properties of the feature
   * @param extent - the extent of the feature
   * @param geometryIndices - the location of indices of the geometry in the cache
   * @param mValuesIndex - the location of the M values in the cache
   * @param bboxIndices - the location of the bbox in the cache
   */
  constructor(
    cache: ColumnCacheReader,
    id: number | undefined,
    properties: OProperties,
    extent: Extents,
    geometryIndices: number[],
    mValuesIndex?: number,
    bboxIndices?: BBox,
  ) {
    super(cache, id, properties, extent, geometryIndices, bboxIndices, mValuesIndex);
  }

  // TODO:
  // loadLines: (withMValues?: boolean) => VectorLinesWithOffset;
  // loadGeometry: (withMValues: boolean) => VectorGeometry;
  // loadGeometryFlat: () => [number[], number[]]; // Adds the tesselation automatically
  // readIndices: () => number[];
}

/**
 * 3D Point Vector Feature
 * Type 4.
 * Extends from @see {@link OVectorFeatureBase}.
 * Store either a single 3D point or a list of 3D points.
 */
export class OVectorPoints3DFeature extends OVectorFeatureBase {
  type: VectorFeatureType = 4;
  geometry?: VectorPoints3D;
  /**
   * @param cache - the column cache for future retrieval
   * @param id - the id of the feature
   * @param properties - the properties of the feature
   * @param extent - the extent of the feature
   * @param geometryIndex - the index of the 3D Point Geometry in the cache
   */
  constructor(
    cache: ColumnCacheReader,
    id: number | undefined,
    properties: OProperties,
    extent: Extents,
    readonly geometryIndex: number,
  ) {
    super(cache, id, properties, extent);
  }

  /**
   * Read in the 3D Point Geometry. Can be more than one point.
   * @returns the 3D Point Geometry
   */
  loadGeometry(): VectorPoints {
    if (!this.geometry)
      this.geometry = this.cache.getColumn(
        OColumnName.points3D,
        this.geometryIndex,
      ) as VectorPoints3D;
    return this.geometry;
  }
}
/**
 * TODO: 3D Lines Vector Feature
 * Type 5
 * Extends from @see {@link OVectorFeatureBase}.
 * Store either a single 3D line or a list of 3D lines.
 */
export class OVectorLines3DFeature extends OVectorFeatureBase {
  type: VectorFeatureType = 5;
}
/**
 * TODO: 3D Polygons Vector Feature
 * Type 6
 * Extends from @see {@link OVectorFeatureBase}.
 * Store either a single 3D polygon or a list of 3D polygons.
 */
export class OVectorPolys3DFeature extends OVectorFeatureBase {
  type: VectorFeatureType = 6;
}

/**
 * All feature class types. Points, Lines, and Polys for both 2D and 3D
 */
export type OVectorFeature =
  | OVectorPointsFeature
  | OVectorLinesFeature
  | OVectorPolysFeature
  | OVectorPoints3DFeature
  | OVectorLines3DFeature
  | OVectorPolys3DFeature;

/**
 * @param bytes - the bytes to read from
 * @param extent - the extent of the vector layer to help decode the geometry
 * @param cache - the column cache to read from
 * @returns - the decoded feature
 */
export function readFeature(
  bytes: Uint8Array,
  extent: Extents,
  cache: ColumnCacheReader,
): OVectorFeature {
  const pbf = new Protobuf(bytes);
  // pull in the type
  const type = pbf.readVarint();
  // next the flags
  const flags = pbf.readVarint();
  // const hasOffsets = flags & (1 << 3);
  // read the id if it exists
  const id = flags & 1 ? pbf.readVarint() : undefined;
  // read the properties
  const shapeIndex = pbf.readVarint();
  const valueIndex = pbf.readVarint();
  const properties = readShape(shapeIndex, valueIndex, cache);
  // TODO: mValuesIndex, BBOXIndices, and tesselationIndex/indices if applicable
  // const bbox =
  // if type is 1 or 4, read geometry as a single index, otherwise as an array
  if (type === 1 || type === 4) {
    const geometryIndex = pbf.readVarint();
    if (type === 1) return new OVectorPointsFeature(cache, id, properties, extent, geometryIndex);
    else return new OVectorPoints3DFeature(cache, id, properties, extent, geometryIndex);
  } else {
    const geometryIndices = [...pbf.readBytes()];
    if (type === 2)
      return new OVectorLinesFeature(
        cache,
        id,
        properties,
        extent,
        geometryIndices,
        undefined,
        undefined,
      );
    else if (type === 3)
      return new OVectorPolysFeature(
        cache,
        id,
        properties,
        extent,
        geometryIndices,
        undefined,
        undefined,
      );
    // TODO: 3D lines and polygons
    else throw new Error('Type is not supported yet.');
  }
}

/**
 * @param feature - BaseVectorFeature to build a buffer from
 * @param cache - where to store all feature data to in columns
 * @returns - Compressed indexes for the feature
 */
export function writeFeature(feature: BaseVectorFeature, cache: ColumnCacheWriter): Buffer {
  // write id, type, properties, bbox, geometry, indices, tesselation, mValues
  const pbf = new Protobuf();
  // type is just stored as a varint
  pbf.writeVarint(feature.type);
  // store flags if each one exists or not into a single byte
  const hasOffsets = feature.hasOffsets();
  const hasBBox = feature.hasBBox();
  const hasMValues = feature.hasMValues();
  const singlePoint = feature.type === 1 && feature.geometry.length === 1;
  let flags = 0;
  if ('id' in feature) flags += 1 << 1;
  if (hasBBox) flags += 1 << 2;
  if (hasOffsets) flags += 1 << 3;
  if ('indices' in feature && feature.indices.length) flags += 1 << 4;
  if ('tesselation' in feature && feature.tesselation.length) flags += 1 << 5;
  if (hasMValues) flags += 1 << 6;
  if (singlePoint) flags += 1 << 7;
  pbf.writeVarint(flags); // just 1 byte
  // id is stored in unsigned column
  if (feature.id) pbf.writeVarint(feature.id);
  // index to values column
  const [shapeIndex, valueIndex] = encodeShape(cache, feature.properties);
  pbf.writeVarint(shapeIndex);
  pbf.writeVarint(valueIndex);
  // bbox is stored in double column.
  // if ('bbox' in feature) pbf.writeVarint(cache.addColumnData(OColumnName.double, feature.bbox));
  // offset is stored in signed column offset is a float, so we need to convert it to a
  // signed integer by multiplying by 1000 and then simplifying to an integer
  // if ('offset' in feature)
  //   pbf.writeVarint(cache.addColumnData(OColumnName.signed, encodeOffset(feature.offset)));
  // geometry
  // if ('geometry' in feature) pbf.writeVarint(feature.addGeometryToCache(cache));
  if (singlePoint) {
    const { x, y } = feature.geometry[0] as Point;
    pbf.writeVarint(weave2D(zigzag(x), zigzag(y)));
  } else {
    const indexOrIndexes = feature.addGeometryToCache(cache);
    if (Array.isArray(indexOrIndexes)) {
      pbf.writeVarint(cache.addColumnData(OColumnName.indices, indexOrIndexes));
    } else {
      pbf.writeVarint(indexOrIndexes);
    }
  }
  // indices
  // if ('indices' in feature)
  //   pbf.writeVarint(cache.addColumnData(OColumnName.indices, feature.indices));
  // // tesselation
  // if ('tesselation' in feature)
  //   pbf.writeVarint(cache.addColumnData(OColumnName.points, feature.tesselation));
  // mValues will be written as Shapes. The feature will write each shape in, build an index list
  // that index list will be stored in in the indices column, and the index to the indices column
  // is returned.
  // if ('mValues' in feature) {
  //   pbf.writeVarint(1);
  //   pbf.writeVarint(feature.addMvaluesToCache(cache));
  // } else {
  //   pbf.writeVarint(0);
  // }

  return Buffer.from(pbf.commit());
}
// export function writeFeature(feature: BaseVectorFeature, cache: ColumnCacheWriter): number {
//   const res: ColumnValue[] = [];
//   // type is just stored as a varint
//   res.push(feature.type);
//   // store flags if each one exists or not into a single byte
//   const hasOffsets = feature.hasOffsets();
//   const hasBBox = feature.hasBBox();
//   const hasMValues = feature.hasMValues();
//   const singlePoint = feature.type === 1 && feature.geometry.length === 1;
//   let flags = 0;
//   if ('id' in feature) flags += 1 << 1;
//   if (hasBBox) flags += 1 << 2;
//   if (hasOffsets) flags += 1 << 3;
//   if ('indices' in feature && feature.indices.length) flags += 1 << 4;
//   if ('tesselation' in feature && feature.tesselation.length) flags += 1 << 5;
//   if (hasMValues) flags += 1 << 6;
//   res.push(flags); // just 1 byte
//   // id
//   if (feature.id) res.push(cache.addNumber(feature.id));
//   // keys indices index and values indices index
//   const shapeValue = encodeShape(cache, feature.properties);
//   res.push(shapeValue.length, ...shapeValue);
//   // a set of 4 or 6 encoded varints
//   if ('bbox' in feature && hasBBox) feature.bbox.forEach((n) => res.push(cache.addNumber(n)));
//   // TODO: store offsets for each line if applicable (the first section of a points feature will be the offset)
//   const indexOrIndexes = feature.addGeometryToCache(cache);
//   if (singlePoint) {
//     const { x, y } = feature.geometry[0] as Point;
//     res.push(weave2D(zigzag(x), zigzag(y)));
//   } else {
//     if (Array.isArray(indexOrIndexes)) {
//       res.push(cache.addColumnData(OColumnName.indices, indexOrIndexes));
//     } else {
//       res.push(indexOrIndexes);
//     }
//   }
//   // TODO: indices, tesselation, and mValues

//   return cache.addColumnData(OColumnName.values, res);
// }

/**
 * Encode offset values into a signed integer to reduce byte cost without too much loss
 * @param offset - float or double value to be compressed
 * @returns - a signed integer that saves 3 decimal places
 */
export function encodeOffset(offset: number): number {
  return Math.floor(offset * 1_000);
}

/**
 * Decode offset from a signed integer into a float or double
 * @param offset - the signed integer to be decompressed
 * @returns - a float or double that restores 3 decimal places
 */
export function decodeOffset(offset: number): number {
  return offset / 1_000;
}
