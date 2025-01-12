import { OColumnName } from './columnCache';
import { Pbf as Protobuf } from 'pbf-ts';
import { decodeOffset } from '../base';
import { decodeValue, encodeValue } from './shape';
import { unweave2D, unweave3D, zagzig } from '../util';

import type { BaseVectorFeature } from '../base';
import type { Extents } from './vectorLayer';
import type { Shape } from './shape';
import type {
  BBox,
  BBox3D,
  OProperties,
  Point,
  Point3D,
  VectorFeatureType,
  VectorLine,
  VectorLine3D,
  VectorLines,
  VectorLines3D,
  VectorLines3DWithOffset,
  VectorLinesWithOffset,
  VectorMultiPoly,
  VectorMultiPoly3D,
  VectorPoints,
  VectorPoints3D,
} from '../vectorTile.spec';
import type { ColumnCacheReader, ColumnCacheWriter } from './columnCache';

/**
 * Vector Feature Base
 * Common variables and functions shared by all vector features
 */
export class OVectorFeatureBase {
  type = 0;
  /**
   * @param cache - the column cache for future retrieval
   * @param id - the id of the feature
   * @param properties - the properties of the feature
   * @param mShape - the shape of the feature's mValues if they exist
   * @param extent - the extent of the feature
   * @param geometryIndices - the indices of the geometry in the cache
   * @param single - if true, you know the initial length is 1
   * @param bboxIndex - index to the values column where the BBox is stored
   * @param hasOffsets - if true, the geometryIndices has offsets encoded into it
   * @param hasMValues - if true, the feature has M values
   * @param indicesIndex - if greater than 0, the feature has indices to parse
   * @param tesselationIndex - if greater than 0, the feature has tesselation
   */
  constructor(
    readonly cache: ColumnCacheReader,
    readonly id: number | undefined,
    readonly properties: OProperties,
    readonly mShape: Shape,
    readonly extent: Extents,
    readonly geometryIndices: number[],
    readonly single: boolean,
    readonly bboxIndex: number, // -1 if there is no bbox
    readonly hasOffsets: boolean,
    readonly hasMValues: boolean,
    readonly indicesIndex: number, // -1 if there are no indices
    readonly tesselationIndex: number, // -1 if there is no tesselation
  ) {}

  /** @returns - true if the type of the feature is points */
  isPoints(): boolean {
    return this.type === 1;
  }

  /** @returns - true if the type of the feature is lines */
  isLines(): boolean {
    return this.type === 2;
  }

  /** @returns - true if the type of the feature is polygons */
  isPolygons(): boolean {
    return this.type === 3;
  }

  /** @returns - true if the type of the feature is points 3D */
  isPoints3D(): boolean {
    return this.type === 4;
  }

  /** @returns - true if the type of the feature is lines 3D */
  isLines3D(): boolean {
    return this.type === 5;
  }

  /** @returns - true if the type of the feature is polygons 3D */
  isPolygons3D(): boolean {
    return this.type === 6;
  }

  /**
   * adds the tesselation to the geometry
   * @param geometry - the input geometry to add to
   * @param multiplier - the multiplier to multiply the geometry by
   */
  // we need to disable the eslint rule here so that the docs register the parameters correctly
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addTesselation(geometry: number[], multiplier: number): void {}

  /**
   * @returns an empty geometry
   */
  loadGeometryFlat(): [geometry: number[], indices: number[]] {
    return [[], []];
  }

  /**
   * @returns the indices for the feature
   */
  readIndices(): number[] {
    return [];
  }
}

/**
 * Vector Feature Base 2D.
 * Extends from @see {@link OVectorFeatureBase}.
 */
export class OVectorFeatureBase2D extends OVectorFeatureBase {
  /** @returns the BBox of the feature (in lon-lat space) */
  bbox(): BBox {
    if (this.bboxIndex === -1) return [0, 0, 0, 0];
    return this.cache.getColumn<BBox>(OColumnName.bbox, this.bboxIndex);
  }
}

/**
 * Vector Feature Base 3D.
 * Extends from @see {@link OVectorFeatureBase}.
 */
export class OVectorFeatureBase3D extends OVectorFeatureBase {
  /** @returns the BBox3D of the feature (in lon-lat space) */
  bbox(): BBox3D {
    if (this.bboxIndex === -1) return [0, 0, 0, 0, 0, 0];
    return this.cache.getColumn<BBox3D>(OColumnName.bbox, this.bboxIndex);
  }
}

/**
 * Points Vector Feature
 * Type 1
 * Extends from @see {@link OVectorFeatureBase}.
 * store either a single point or a list of points
 */
export class OVectorPointsFeature extends OVectorFeatureBase2D {
  type: VectorFeatureType = 1;
  geometry?: VectorPoints;

  /** @returns the geometry as an array of points */
  loadPoints(): Point[] {
    return this.loadGeometry();
  }

  /** @returns the geometry as an array of lines */
  loadLines(): VectorLinesWithOffset {
    return [];
  }

  /** @returns the geometry as an array of points */
  loadGeometry(): VectorPoints {
    const { cache, hasMValues, single, geometryIndices: indices } = this;
    let indexPos = 0;
    const geometryIndex = indices[indexPos++];
    if (this.geometry === undefined) {
      if (single) {
        const { a, b } = unweave2D(geometryIndex);
        this.geometry = [{ x: zagzig(a), y: zagzig(b) }];
      } else {
        this.geometry = cache.getColumn<VectorPoints>(OColumnName.points, geometryIndex);
        // load m values if they exist
        if (hasMValues) {
          const length = this.geometry.length;
          for (let j = 0; j < length; j++) {
            const valueIndex = indices[indexPos++];
            this.geometry[j].m = decodeValue(valueIndex, this.mShape, cache);
          }
        }
      }
    }

    return this.geometry;
  }
}

/**
 * Lines Vector Feature
 * Type 2
 * Extends from @see {@link OVectorFeatureBase2D}.
 * Store either a single line or a list of lines
 */
export class OVectorLinesFeature extends OVectorFeatureBase2D {
  type: VectorFeatureType = 2;
  geometry?: VectorLinesWithOffset;

  /** @returns the geometry as a flattened array of points */
  loadPoints(): Point[] {
    return this.loadGeometry().flatMap((line) => line);
  }

  /** @returns the geometry as an array of lines objects that include offsets */
  loadLines(): VectorLinesWithOffset {
    if (this.geometry !== undefined) return this.geometry;
    // prepare variables
    const { hasOffsets, hasMValues, geometryIndices: indices, cache, single } = this;
    const lines: VectorLinesWithOffset = [];
    let indexPos = 0;
    const lineCount = single ? 1 : indices[indexPos++];
    for (let i = 0; i < lineCount; i++) {
      // get offset if it exists
      const offset = hasOffsets ? decodeOffset(indices[indexPos++]) : 0;
      // get geometry
      const geometry: VectorLine = cache.getColumn(OColumnName.points, indices[indexPos++]);
      // inject m values if they exist
      if (hasMValues) {
        const length = geometry.length;
        for (let j = 0; j < length; j++) {
          const valueIndex = indices[indexPos++];
          geometry[j].m = decodeValue(valueIndex, this.mShape, cache);
        }
      }
      lines.push({ offset, geometry });
    }

    this.geometry = lines;
    return lines;
  }

  /** @returns the geometry as an array of flattened line geometry */
  loadGeometry(): VectorLines {
    return this.loadLines().map((line) => line.geometry);
  }
}

/**
 * Polys Vector Feature
 * Type 3
 * Extends from @see {@link OVectorFeatureBase2D}.
 * Stores either one or multiple polygons. Polygons are an abstraction to polylines, and
 * each polyline can contain an offset.
 */
export class OVectorPolysFeature extends OVectorFeatureBase2D {
  type: VectorFeatureType = 3;
  geometry?: VectorLinesWithOffset[];

  /**
   * Stores the geometry incase it's used again
   * @returns the geometry as an array of lines objects that include offsets
   */
  #loadLinesWithOffsets(): VectorLinesWithOffset[] {
    if (this.geometry !== undefined) return this.geometry;

    // prepare variables
    const { hasOffsets, hasMValues, geometryIndices: indices, cache, single } = this;
    const polys: VectorLinesWithOffset[] = [];
    let indexPos = 0;
    const polyCount = single ? 1 : indices[indexPos++];
    for (let i = 0; i < polyCount; i++) {
      const lineCount = indices[indexPos++];
      const lines: VectorLinesWithOffset = [];
      for (let j = 0; j < lineCount; j++) {
        // get offset if it exists
        const offset = hasOffsets ? decodeOffset(indices[indexPos++]) : 0;
        // get geometry
        const geometry: VectorLine = cache.getColumn(OColumnName.points, indices[indexPos++]);
        // inject m values if they exist
        if (hasMValues) {
          const length = geometry.length;
          for (let j = 0; j < length; j++) {
            const valueIndex = indices[indexPos++];
            geometry[j].m = decodeValue(valueIndex, this.mShape, cache);
          }
        }
        lines.push({ offset, geometry });
      }
      polys.push(lines);
    }

    this.geometry = polys;
    return polys;
  }

  /** @returns the geometry as a flattened array of points */
  loadPoints(): Point[] {
    return this.loadGeometry().flatMap((poly) => {
      return poly.flatMap((line) => line);
    });
  }

  /** @returns the geometry flattened into an array with offsets */
  loadLines(): VectorLinesWithOffset {
    const lines = this.#loadLinesWithOffsets();
    // flatten
    return lines.flatMap((line) => line);
  }

  /**
   * @returns the geometry as an array of raw poly geometry
   */
  loadGeometry(): VectorMultiPoly {
    return this.#loadLinesWithOffsets().map((poly) => {
      return poly.map((line) => line.geometry);
    });
  }

  /**
   * Automatically adds the tesselation to the geometry if the tesselationIndex exists
   * @returns the geometry as an array of totally flattend poly geometry with indices
   */
  loadGeometryFlat(): [geometry: number[], indices: number[]] {
    const geo = this.#loadLinesWithOffsets();
    const multiplier = 1 / this.extent;
    const geometry: number[] = [];

    for (const poly of geo) {
      for (const line of poly) {
        for (const point of line.geometry) {
          geometry.push(point.x * multiplier, point.y * multiplier);
        }
      }
    }

    this.addTesselation(geometry, multiplier);

    return [geometry, this.readIndices()];
  }

  /** @returns the indices of the geometry */
  readIndices(): number[] {
    if (this.indicesIndex === -1) return [];
    return this.cache.getColumn<number[]>(OColumnName.indices, this.indicesIndex);
  }

  /**
   * adds the tesselation to the geometry
   * @param geometry - the geometry of the feature
   * @param multiplier - the multiplier to apply the extent shift
   */
  addTesselation(geometry: number[], multiplier: number): void {
    if (this.tesselationIndex === -1) return;
    const data = this.cache.getColumn<Point[]>(OColumnName.points, this.tesselationIndex);
    for (const point of data) {
      geometry.push(point.x * multiplier, point.y * multiplier);
    }
  }
}

/**
 * 3D Point Vector Feature
 * Type 4.
 * Extends from @see {@link OVectorFeatureBase3D}.
 * Store either a single 3D point or a list of 3D points.
 */
export class OVectorPoints3DFeature extends OVectorFeatureBase3D {
  type: VectorFeatureType = 4;
  geometry?: VectorPoints3D;

  /** @returns the geometry as a flattened array of points */
  loadPoints(): Point3D[] {
    return this.loadGeometry();
  }

  /** @returns the geometry as an array of lines */
  loadLines(): VectorLines3DWithOffset {
    return [];
  }

  /**
   * Read in the 3D Point Geometry. Can be more than one point.
   * @returns the 3D Point Geometry
   */
  loadGeometry(): VectorPoints3D {
    const { cache, hasMValues, single, geometryIndices: indices } = this;
    let indexPos = 0;
    const geometryIndex = indices[indexPos++];
    if (this.geometry === undefined) {
      if (single) {
        const { a, b, c } = unweave3D(geometryIndex);
        this.geometry = [{ x: zagzig(a), y: zagzig(b), z: zagzig(c) }];
      } else {
        this.geometry = cache.getColumn<VectorPoints3D>(OColumnName.points3D, geometryIndex);
        // load m values if they exist
        if (hasMValues) {
          const length = this.geometry.length;
          for (let j = 0; j < length; j++) {
            const valueIndex = indices[indexPos++];
            this.geometry[j].m = decodeValue(valueIndex, this.mShape, cache);
          }
        }
      }
    }

    return this.geometry;
  }
}
/**
 * 3D Lines Vector Feature
 * Type 5
 * Extends from @see {@link OVectorFeatureBase3D}.
 * Store either a single 3D line or a list of 3D lines.
 */
export class OVectorLines3DFeature extends OVectorFeatureBase3D {
  type: VectorFeatureType = 5;
  geometry?: VectorLines3DWithOffset;

  /** @returns the geometry as a flattened array of points */
  loadPoints(): Point3D[] {
    return this.loadGeometry().flatMap((line) => line);
  }

  /** @returns the geometry as an array of lines objects that include offsets */
  loadLines(): VectorLines3DWithOffset {
    if (this.geometry !== undefined) return this.geometry;
    // prepare variables
    const { hasOffsets, hasMValues, geometryIndices: indices, cache, single } = this;
    const lines: VectorLines3DWithOffset = [];
    let indexPos = 0;
    const lineCount = single ? 1 : indices[indexPos++];
    for (let i = 0; i < lineCount; i++) {
      // get offset if it exists
      const offset = hasOffsets ? decodeOffset(indices[indexPos++]) : 0;
      // get geometry
      const geometry: VectorLine3D = cache.getColumn(OColumnName.points3D, indices[indexPos++]);
      // inject m values if they exist
      if (hasMValues) {
        const length = geometry.length;
        for (let j = 0; j < length; j++) {
          const valueIndex = indices[indexPos++];
          geometry[j].m = decodeValue(valueIndex, this.mShape, cache);
        }
      }
      lines.push({ offset, geometry });
    }

    this.geometry = lines;
    return lines;
  }

  /** @returns the geometry as an array of flattened line geometry */
  loadGeometry(): VectorLines3D {
    return this.loadLines().map((line) => line.geometry);
  }
}
/**
 * 3D Polygons Vector Feature
 * Type 6
 * Extends from @see {@link OVectorFeatureBase3D}.
 * Store either a single 3D polygon or a list of 3D polygons.
 */
export class OVectorPolys3DFeature extends OVectorFeatureBase3D {
  type: VectorFeatureType = 6;
  geometry?: VectorLines3DWithOffset[];

  /**
   * Stores the geometry incase it's used again
   * @returns the geometry as an array of lines objects that include offsets
   */
  #loadLinesWithOffsets(): VectorLines3DWithOffset[] {
    if (this.geometry !== undefined) return this.geometry;

    // prepare variables
    const { hasOffsets, hasMValues, geometryIndices: indices, cache, single } = this;
    const polys: VectorLines3DWithOffset[] = [];
    let indexPos = 0;
    const polyCount = single ? 1 : indices[indexPos++];
    for (let i = 0; i < polyCount; i++) {
      const lineCount = indices[indexPos++];
      const lines: VectorLines3DWithOffset = [];
      for (let j = 0; j < lineCount; j++) {
        // get offset if it exists
        const offset = hasOffsets ? decodeOffset(indices[indexPos++]) : 0;
        // get geometry
        const geometry: VectorLine3D = cache.getColumn(OColumnName.points3D, indices[indexPos++]);
        // inject m values if they exist
        if (hasMValues) {
          const length = geometry.length;
          for (let j = 0; j < length; j++) {
            const valueIndex = indices[indexPos++];
            geometry[j].m = decodeValue(valueIndex, this.mShape, cache);
          }
        }
        lines.push({ offset, geometry });
      }
      polys.push(lines);
    }

    this.geometry = polys;
    return polys;
  }

  /** @returns the geometry as a flattened array of points */
  loadPoints(): Point3D[] {
    return this.loadGeometry().flatMap((poly) => {
      return poly.flatMap((line) => line);
    });
  }

  /** @returns the geometry flattened into an array with offsets */
  loadLines(): VectorLines3DWithOffset {
    const lines = this.#loadLinesWithOffsets();
    // flatten
    return lines.flatMap((line) => line);
  }

  /** @returns the geometry as an array of raw poly geometry */
  loadGeometry(): VectorMultiPoly3D {
    return this.#loadLinesWithOffsets().map((poly) => {
      return poly.map((line) => line.geometry);
    });
  }

  /**
   * Automatically adds the tesselation to the geometry if the tesselationIndex exists
   * @returns the geometry as an array of totally flattend poly geometry with indices
   */
  loadGeometryFlat(): [geometry: number[], indices: number[]] {
    const geo = this.#loadLinesWithOffsets();
    const multiplier = 1 / this.extent;
    const geometry: number[] = [];

    for (const poly of geo) {
      for (const line of poly) {
        for (const point of line.geometry) {
          geometry.push(point.x * multiplier, point.y * multiplier);
        }
      }
    }

    this.addTesselation(geometry, multiplier);

    return [geometry, this.readIndices()];
  }

  /** @returns the indices of the geometry */
  readIndices(): number[] {
    if (this.indicesIndex === -1) return [];
    return this.cache.getColumn<number[]>(OColumnName.indices, this.indicesIndex);
  }

  /**
   * adds the tesselation to the geometry
   * @param geometry - the geometry of the feature
   * @param multiplier - the multiplier to apply the extent shift
   */
  addTesselation(geometry: number[], multiplier: number): void {
    if (this.tesselationIndex === -1) return;
    const data = this.cache.getColumn<Point3D[]>(OColumnName.points3D, this.tesselationIndex);
    for (const point of data) {
      geometry.push(point.x * multiplier, point.y * multiplier, point.z * multiplier);
    }
  }
}

/** All feature class types. Points, Lines, and Polys for both 2D and 3D */
export type OVectorFeature =
  | OVectorPointsFeature
  | OVectorLinesFeature
  | OVectorPolysFeature
  | OVectorPoints3DFeature
  | OVectorLines3DFeature
  | OVectorPolys3DFeature;

/**
 * @param T - the feature type
 * @param cache - the column cache to read from
 * @param id - the id of the feature
 * @param properties - the properties of the feature
 * @param mShape - the shape of the feature's m-values if they exist
 * @param extent - the extent of the vector layer to help decode the geometry
 * @param geometryIndices - the indices of the geometry
 * @param single - whether the geometry is a single point
 * @param bboxIndex - the index of the bbox
 * @param hasOffsets - whether the geometry has offsets
 * @param hasMValues - whether the geometry has m values
 * @returns - the feature type
 */
type Constructor<T> = new (
  cache: ColumnCacheReader,
  id: number | undefined,
  properties: OProperties,
  mShape: Shape,
  extent: Extents,
  geometryIndices: number[],
  single: boolean,
  bboxIndex: number,
  hasOffsets: boolean,
  hasMValues: boolean,
  indicesIndex: number,
  tesselationIndex: number,
) => T;

/**
 * @param bytes - the bytes to read from
 * @param extent - the extent of the vector layer to help decode the geometry
 * @param cache - the column cache to read from
 * @param shape - the shape of the feature's properties data
 * @param mShape - the shape of the feature's m-values if they exist
 * @returns - the decoded feature
 */
export function readFeature(
  bytes: Uint8Array,
  extent: Extents,
  cache: ColumnCacheReader,
  shape: Shape,
  mShape: Shape = {},
): OVectorFeature {
  const pbf = new Protobuf(bytes);
  // pull in the type
  const type = pbf.readVarint();
  // next the flags
  const flags = pbf.readVarint();
  // read the id if it exists
  const id = (flags & 1) > 0 ? pbf.readVarint() : undefined;
  const hashBBOX = (flags & (1 << 1)) > 0;
  const hasOffsets = (flags & (1 << 2)) > 0;
  const hasIndices = (flags & (1 << 3)) > 0;
  const hasTessellation = (flags & (1 << 4)) > 0;
  const hasMValues = (flags & (1 << 5)) > 0;
  const single: boolean = (flags & (1 << 6)) !== 0;
  // read the properties
  const valueIndex = pbf.readVarint();
  const properties = decodeValue(valueIndex, shape, cache);
  // if type is 1 or 4, read geometry as a single index, otherwise as an array
  let Constructor: Constructor<OVectorFeature>;
  let geometryIndices: number[];
  let indices = -1;
  let tesselationIndex = -1;
  if (type === 1 || type === 4) {
    if (single) geometryIndices = [pbf.readVarint()];
    else geometryIndices = cache.getColumn(OColumnName.indices, pbf.readVarint());
    if (type === 1) Constructor = OVectorPointsFeature;
    else Constructor = OVectorPoints3DFeature;
  } else {
    geometryIndices = cache.getColumn(OColumnName.indices, pbf.readVarint());
    if (type === 2) Constructor = OVectorLinesFeature;
    else if (type === 3) Constructor = OVectorPolysFeature;
    else if (type === 5) Constructor = OVectorLines3DFeature;
    else if (type === 6) Constructor = OVectorPolys3DFeature;
    else throw new Error('Type is not supported.');
  }
  // read indices and tesselation if they exist
  if (type === 3 || type === 6) {
    if (hasIndices) indices = pbf.readVarint();
    if (hasTessellation) tesselationIndex = pbf.readVarint();
  }
  const bboxIndex = hashBBOX ? pbf.readVarint() : -1;

  return new Constructor(
    cache,
    id,
    properties,
    mShape,
    extent,
    geometryIndices,
    single,
    bboxIndex,
    hasOffsets,
    hasMValues,
    indices,
    tesselationIndex,
  );
}

/**
 * @param feature - BaseVectorFeature to build a buffer from
 * @param shape - The shape of the feature's properties data
 * @param mShape - The shape of the feature's m-values if they exist
 * @param cache - where to store all feature data to in columns
 * @returns - Compressed indexes for the feature
 */
export function writeOVFeature(
  feature: BaseVectorFeature,
  shape: Shape,
  mShape: Shape = {},
  cache: ColumnCacheWriter,
): Uint8Array {
  // write id, type, properties, bbox, geometry, indices, tesselation, mValues
  const pbf = new Protobuf();
  // type is just stored as a varint
  pbf.writeVarint(feature.type);
  // store flags if each one exists or not into a single byte
  const hasID: boolean = feature.id !== undefined;
  const hasIndices: boolean = 'indices' in feature && feature.indices.length !== 0;
  const hasTessellation: boolean = 'tesselation' in feature && feature.tesselation.length !== 0;
  const hasOffsets: boolean = feature.hasOffsets;
  const hasBBox = 'bbox' in feature && feature.hasBBox;
  const hasMValues = feature.hasMValues;
  const single = feature.geometry.length === 1;
  let flags = 0;
  if (hasID) flags += 1;
  if (hasBBox) flags += 1 << 1;
  if (hasOffsets) flags += 1 << 2;
  if (hasIndices) flags += 1 << 3;
  if (hasTessellation) flags += 1 << 4;
  if (hasMValues) flags += 1 << 5;
  if (single) flags += 1 << 6;
  pbf.writeVarint(flags); // just 1 byte
  // id is stored in unsigned column
  if (hasID) pbf.writeVarint(feature.id ?? 0);
  // index to values column
  const valueIndex = encodeValue(feature.properties, shape, cache);
  pbf.writeVarint(valueIndex);
  // geometry
  const storedGeo = feature.addGeometryToCache(cache, mShape);
  pbf.writeVarint(storedGeo);
  // indices
  if ('indices' in feature && hasIndices)
    pbf.writeVarint(cache.addColumnData(OColumnName.indices, feature.indices));
  // tesselation
  if ('tesselation' in feature && hasTessellation)
    pbf.writeVarint(cache.addColumnData(OColumnName.points, feature.tesselation));
  // bbox is stored in double column.
  if (hasBBox) pbf.writeVarint(cache.addColumnData(OColumnName.bbox, feature.bbox));

  return pbf.commit();
}
