import { OColumnName } from '../openVectorTile/columnCache';
import { encodeShape } from '../openVectorTile/vectorValue';

import type {
  BBox,
  BBox3D,
  ColumnCacheWriter,
  MapboxVectorFeature,
  OProperties,
  Point,
  Point3D,
  VectorLine,
  VectorLine3D,
  VectorLines,
  VectorLines3D,
  VectorMultiPoly,
  VectorMultiPoly3D,
  VectorPoints,
  VectorPoints3D,
} from '../';
import { weave2D, weave3D, zigzag } from 'open-vector-tile/util';

/**
 * Base Vector Feature
 * Common variables and methods shared by all vector features
 */
export class VectorFeatureBase {
  /**
   * @param properties - the properties of the feature
   * @param id - the id of the feature if there is one
   */
  constructor(
    public properties: OProperties = {},
    public id?: number,
  ) {}
}

/**
 * Base Vector Points Feature
 * Type 1
 * Extends from @see {@link VectorFeatureBase}.
 * Store either a single point or a list of points
 */
export class BaseVectorPointsFeature extends VectorFeatureBase {
  type = 1;
  /**
   * @param geometry - the geometry of the feature
   * @param properties - the properties of the feature
   * @param id - the id of the feature
   * @param bbox - the BBox of the feature
   */
  constructor(
    public geometry: VectorPoints,
    properties: OProperties = {},
    id?: number,
    public bbox: BBox = [0, 0, 0, 0],
  ) {
    super(properties, id);
  }

  /**
   * Points do not have this feature, so return false
   * @returns false always
   */
  get hasOffsets(): boolean {
    return false;
  }

  /**
   * Points do not have this feature, so return false
   * @returns false always
   */
  get hasMValues(): boolean {
    return false;
  }

  /**
   * @returns - true if the feature has BBox
   */
  get hasBBox(): boolean {
    return this.bbox.some((v) => v !== 0);
  }

  /**
   * @param cache - the column cache to store the geometry
   * @returns the index in the points column where the geometry is stored
   */
  addGeometryToCache(cache: ColumnCacheWriter): number {
    if (this.geometry.length === 1) {
      const { x, y } = this.geometry[0];
      return weave2D(zigzag(x), zigzag(y));
    }
    return cache.addColumnData(OColumnName.points, this.geometry);
  }

  /**
   * @returns the geometry
   */
  loadGeometry(): VectorPoints {
    return this.geometry;
  }
}

/**
 * Base Vector Lines Feature
 * Common variables and methods shared by all vector lines and/or polygons features
 */
export class BaseVectorLine {
  /**
   * @param geometry - the geometry of the feature
   * @param offset - the offset of the feature
   */
  constructor(
    public geometry: VectorLine,
    public offset: number = 0,
  ) {}
}

/**
 * Base Vector Lines Feature
 * Type 2
 * Extends from @see {@link VectorFeatureBase}.
 * Store either a single line or a list of lines.
 */
export class BaseVectorLinesFeature extends VectorFeatureBase {
  type = 2;
  /**
   * @param geometry - the geometry of the feature
   * @param bbox - the bbox of the feature if not provided will be [0, 0, 0, 0]
   * @param properties - the properties of the feature
   * @param id - the id of the feature if there is one
   */
  constructor(
    public geometry: BaseVectorLine[],
    public bbox: BBox = [0, 0, 0, 0],
    properties: OProperties = {},
    id?: number,
  ) {
    super(properties, id);
  }

  /**
   * @returns - true if the feature has offsets
   */
  get hasOffsets(): boolean {
    return this.geometry.some((line) => line.offset > 0);
  }

  /**
   * @returns - true if the feature has BBox
   */
  get hasBBox(): boolean {
    return this.bbox.some((v) => v !== 0);
  }

  /**
   * @returns - true if the feature has M values
   */
  get hasMValues(): boolean {
    return this.geometry.some((line) => {
      return line.geometry.some((point) => point.m !== undefined);
    });
  }

  /**
   * @param cache - the column cache to store the geometry
   * @returns the indexes in the points column where the geometry is stored
   */
  addGeometryToCache(cache: ColumnCacheWriter): number {
    const indices: number[] = [];
    // store number of lines
    if (this.geometry.length !== 1) indices.push(this.geometry.length);
    for (const line of this.geometry) {
      // store offset for current line
      if (this.hasOffsets) indices.push(encodeOffset(line.offset));
      // store geometry data and track its index position
      indices.push(cache.addColumnData(OColumnName.points, line.geometry));
      // store length of mvalues and the mvalues indexes if they exist
      if (this.hasMValues) {
        indices.push(line.geometry.length);
        for (const point of line.geometry) {
          indices.push(...encodeShape(cache, point.m ?? {}));
        }
      }
    }
    return cache.addColumnData(OColumnName.indices, indices);
  }

  /**
   * @returns the flattened geometry
   */
  loadGeometry(): VectorLines {
    return this.geometry.map((line) => line.geometry);
  }
}

/**
 * Base Vector Polys Feature
 * Type 3
 * Extends from @see {@link VectorFeatureBase}.
 * Store either a single polygon or a list of polygons
 */
export class BaseVectorPolysFeature extends VectorFeatureBase {
  type = 3;
  tesselation: Point[];
  /**
   * @param geometry - the geometry of the feature
   * @param indices - the indices of the geometry
   * @param tesselation - the tesselation of the geometry
   * @param bbox - the bbox of the feature
   * @param properties - the properties of the feature
   * @param id - the id of the feature
   */
  constructor(
    public geometry: BaseVectorLine[][],
    public indices: number[] = [],
    tesselation: number[] = [],
    public bbox: BBox = [0, 0, 0, 0],
    properties: OProperties = {},
    id?: number,
  ) {
    super(properties, id);
    this.tesselation = this.#fixTesselation(tesselation);
  }

  /**
   * @param tesselation - the tesselation of the geometry but flattened
   * @returns - the tesselation of the geometry as a list of points
   */
  #fixTesselation(tesselation: number[]): Point[] {
    if (tesselation.length % 2 !== 0) {
      throw new Error('The input tesselation must have an even number of elements.');
    }
    return tesselation.reduce((acc, _, index, array) => {
      if (index % 2 === 0) {
        acc.push({ x: array[index], y: array[index + 1] });
      }
      return acc;
    }, [] as Point[]);
  }

  /**
   * @returns true if the feature has offsets
   */
  get hasOffsets(): boolean {
    return this.geometry.some((poly) => poly.some((line) => line.offset > 0));
  }

  /**
   * @returns true if the feature has BBox
   */
  get hasBBox(): boolean {
    return this.bbox.some((v) => v !== 0);
  }

  /**
   * @returns - true if the feature has M values
   */
  get hasMValues(): boolean {
    return this.geometry.some((poly) =>
      poly.some((line) => {
        return line.geometry.some((point) => point.m !== undefined);
      }),
    );
  }

  /**
   * @param cache - the column cache to store the geometry
   * @returns the indexes in the points column where the geometry is stored
   */
  addGeometryToCache(cache: ColumnCacheWriter): number {
    const indices: number[] = [];
    // store number of polygons
    if (this.geometry.length > 1) indices.push(this.geometry.length);
    for (const poly of this.geometry) {
      // store number of lines in the polygon
      indices.push(poly.length);
      // store each line
      for (const line of poly) {
        // store offset for current line
        if (this.hasOffsets) indices.push(encodeOffset(line.offset));
        // store geometry data and track its index position
        indices.push(cache.addColumnData(OColumnName.points, line.geometry));
        // store length of mvalues and the mvalues indexes if they exist
        if (this.hasMValues) {
          indices.push(line.geometry.length);
          for (const point of line.geometry) {
            indices.push(...encodeShape(cache, point.m ?? {}));
          }
        }
      }
    }
    return cache.addColumnData(OColumnName.indices, indices);
  }

  /**
   * @returns the flattened geometry
   */
  loadGeometry(): VectorMultiPoly {
    return this.geometry.map((poly) => poly.map((line) => line.geometry));
  }
}

/**
 * Base Vector Point 3D Feature
 */
export class BaseVectorPoint3DFeature extends VectorFeatureBase {
  type = 4;
  /**
   * @param geometry - the geometry of the feature
   * @param properties - the properties of the feature
   * @param id - the id of the feature
   * @param bbox - the bbox of the feature
   */
  constructor(
    public geometry: VectorPoints3D,
    properties: OProperties = {},
    id?: number,
    public bbox: BBox3D = [0, 0, 0, 0, 0, 0],
  ) {
    super(properties, id);
  }

  /**
   * Points do not have this feature, so return false
   * @returns false always
   */
  get hasOffsets(): boolean {
    return false;
  }

  /**
   * Points do not have this feature, so return false
   * @returns false always
   */
  get hasMValues(): boolean {
    return false;
  }

  /**
   * @returns true if the feature has BBox
   */
  get hasBBox(): boolean {
    return this.bbox.some((v) => v !== 0);
  }

  /**
   * @param cache - the column cache to store the geometry
   * @returns the index in the points column where the geometry is stored
   */
  addGeometryToCache(cache: ColumnCacheWriter): number {
    if (this.geometry.length === 1) {
      const { x, y, z } = this.geometry[0];
      return weave3D(zigzag(x), zigzag(y), zigzag(z));
    }
    return cache.addColumnData(OColumnName.points3D, this.geometry);
  }

  /**
   * @returns the geometry
   */
  loadGeometry(): VectorPoints3D {
    return this.geometry;
  }
}

/**
 * Base Vector Line 3D
 * Common variables and methods shared by all 3D vector lines
 */
export class BaseVectorLine3D {
  /**
   * @param geometry - the geometry of the feature
   * @param offset - the offset of the feature
   */
  constructor(
    public geometry: VectorLine3D,
    public offset: number = 0,
  ) {}
}

/**
 * Base Vector Lines 3D Feature
 * Type 5
 * Extends from @see {@link VectorFeatureBase}.
 * Store either a single 3D line or a list of 3D lines
 */
export class BaseVectorLines3DFeature extends VectorFeatureBase {
  type = 5;
  /**
   * @param geometry - the geometry of the feature
   * @param bbox - the bbox of the feature
   * @param properties - the properties of the feature
   * @param id - the id of the feature
   */
  constructor(
    public geometry: BaseVectorLine3D[],
    public bbox: BBox3D = [0, 0, 0, 0, 0, 0],
    properties: OProperties = {},
    id?: number,
  ) {
    super(properties, id);
  }

  /**
   * @returns true if the feature has offsets
   */
  get hasOffsets(): boolean {
    return this.geometry.some((line) => line.offset > 0);
  }

  /**
   * @returns true if the feature has BBox
   */
  get hasBBox(): boolean {
    return this.bbox.some((v) => v !== 0);
  }

  /**
   * @returns - true if the feature has M values
   */
  get hasMValues(): boolean {
    return this.geometry.some((line) => {
      return line.geometry.some((point) => point.m !== undefined);
    });
  }

  /**
   * @param cache - the column cache to store the geometry
   * @returns the indexes in the points column where the geometry is stored
   */
  addGeometryToCache(cache: ColumnCacheWriter): number {
    const indices: number[] = [];
    // store number of lines
    if (this.geometry.length > 1) indices.push(this.geometry.length);
    for (const line of this.geometry) {
      // store offset for current line
      if (this.hasOffsets) indices.push(encodeOffset(line.offset));
      // store geometry data and track its index position
      indices.push(cache.addColumnData(OColumnName.points3D, line.geometry));
      // store length of mvalues and the mvalues indexes if they exist
      if (this.hasMValues) {
        indices.push(line.geometry.length);
        for (const point of line.geometry) {
          indices.push(...encodeShape(cache, point.m ?? {}));
        }
      }
    }
    return cache.addColumnData(OColumnName.indices, indices);
  }

  /**
   * @returns the flattened geometry
   */
  loadGeometry(): VectorLines3D {
    return this.geometry.map((line) => line.geometry);
  }
}

/**
 * Base Vector Polys 3D Feature
 * Type 6
 * Extends from @see {@link VectorFeatureBase}.
 * Store either a single 3D poly or a list of 3D polys
 */
export class BaseVectorPolys3DFeature extends VectorFeatureBase {
  type = 6;
  tesselation: Point3D[];

  /**
   * @param geometry - the geometry of the feature
   * @param indices - the indices of the geometry
   * @param tesselation - the tesselation of the geometry
   * @param bbox - the bbox of the feature
   * @param properties - the properties of the feature
   * @param id - the id of the feature
   */
  constructor(
    public geometry: BaseVectorLine3D[][],
    public indices: number[] = [],
    tesselation: number[] = [],
    public bbox: BBox3D = [0, 0, 0, 0, 0, 0],
    properties: OProperties = {},
    id?: number,
  ) {
    super(properties, id);
    this.tesselation = this.#fixTesselation(tesselation);
  }

  /**
   * @param tesselation - the tesselation of the geometry but flattened
   * @returns - the tesselation of the geometry as a list of points
   */
  #fixTesselation(tesselation: number[]): Point3D[] {
    if (tesselation.length % 3 !== 0) {
      throw new Error('The input tesselation must have an even number of elements.');
    }
    return tesselation.reduce((acc, _, index, array) => {
      if (index % 3 === 0) {
        acc.push({ x: array[index], y: array[index + 1], z: array[index + 2] });
      }
      return acc;
    }, [] as Point3D[]);
  }

  /**
   * @returns true if the feature has BBox
   */
  get hasBBox(): boolean {
    return this.bbox.some((v) => v !== 0);
  }

  /**
   * @returns true if the feature has offsets
   */
  get hasOffsets(): boolean {
    return this.geometry.some((poly) => poly.some((line) => line.offset > 0));
  }

  /**
   * @returns - true if the feature has M values
   */
  get hasMValues(): boolean {
    return this.geometry.some((poly) =>
      poly.some((line) => {
        return line.geometry.some((point) => point.m !== undefined);
      }),
    );
  }

  /**
   * @param cache - the column cache to store the geometry
   * @returns the indexes in the points column where the geometry is stored
   */
  addGeometryToCache(cache: ColumnCacheWriter): number {
    const indices: number[] = [];
    // store number of polygons
    if (this.geometry.length > 1) indices.push(this.geometry.length);
    for (const poly of this.geometry) {
      // store number of lines in the polygon
      indices.push(poly.length);
      // store each line
      for (const line of poly) {
        // store offset for current line
        if (this.hasOffsets) indices.push(encodeOffset(line.offset));
        // store geometry data and track its index position
        indices.push(cache.addColumnData(OColumnName.points3D, line.geometry));
        // store length of mvalues and the mvalues indexes if they exist
        if (this.hasMValues) {
          indices.push(line.geometry.length);
          for (const point of line.geometry) {
            indices.push(...encodeShape(cache, point.m ?? {}));
          }
        }
      }
    }
    return cache.addColumnData(OColumnName.indices, indices);
  }

  /**
   * @returns the flattened geometry
   */
  loadGeometry(): VectorMultiPoly3D {
    return this.geometry.map((poly) => poly.map((line) => line.geometry));
  }
}

/**
 * A type that encompasses all vector tile feature types
 */
export type BaseVectorFeature =
  | BaseVectorPointsFeature
  | BaseVectorLinesFeature
  | BaseVectorPolysFeature
  | BaseVectorPoint3DFeature
  | BaseVectorLines3DFeature
  | BaseVectorPolys3DFeature;

/**
 * @param feature - A mapbox vector feature that's been parsed from protobuf data
 * @returns - A base feature to help build a vector tile
 */
export function fromMapboxVectorFeature(feature: MapboxVectorFeature): BaseVectorFeature {
  const { id, properties } = feature;
  const geometry = feature.loadGeometry();
  const indices = feature.readIndices();
  const tesselation: number[] = [];
  feature.addTesselation(tesselation, 1 / feature.extent);
  switch (feature.type) {
    case 1:
      return new BaseVectorPointsFeature(geometry as VectorPoints, properties, id);
    case 2: {
      const geo = geometry as VectorLines;
      const baseLines: BaseVectorLine[] = [];
      for (const line of geo) {
        baseLines.push(new BaseVectorLine(line));
      }
      return new BaseVectorLinesFeature(baseLines, undefined, properties, id);
    }
    case 3:
    case 4: {
      const geo = geometry as VectorMultiPoly;
      const baseMultPoly: BaseVectorLine[][] = [];
      for (const poly of geo) {
        const baseLines: BaseVectorLine[] = [];
        for (const line of poly) {
          baseLines.push(new BaseVectorLine(line));
        }
        baseMultPoly.push(baseLines);
      }
      return new BaseVectorPolysFeature(
        baseMultPoly,
        indices,
        tesselation,
        undefined,
        properties,
        id,
      );
    }
    default:
      throw new Error(`Unknown feature type: ${feature.type}`);
  }
}

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
