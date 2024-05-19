import { OColumnName, encodeOffset } from '../';

import type {
  BBox,
  BBox3D,
  ColumnCacheWriter,
  ColumnValue,
  MapboxVectorFeature,
  OProperties,
  VectorLine,
  VectorLine3D,
  VectorLines,
  VectorMultiPoly,
  VectorPoints,
  VectorPoints3D,
  VectorPoly,
} from '../';

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

  /**
   * @returns true if the feature has offsets
   */
  hasOffsets(): boolean {
    return false;
  }

  /**
   * @returns true if the feature has M values
   */
  hasMValues(): boolean {
    return false;
  }

  /**
   * @returns true if the feature has BBox
   */
  hasBBox(): boolean {
    return false;
  }

  /**
   * @param cache - the column cache to store the offsets in
   * @returns the column values for the feature
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addOffsetsToCache(cache: ColumnCacheWriter): ColumnValue[] {
    return [];
  }
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
   */
  constructor(
    public geometry: VectorPoints,
    properties?: OProperties,
    id?: number,
  ) {
    super(properties, id);
  }

  /**
   * @param cache - the column cache to store the geometry
   * @returns the index in the points column where the geometry is stored
   */
  addGeometryToCache(cache: ColumnCacheWriter): number {
    return cache.addColumnData(OColumnName.points, this.geometry);
  }
}

/**
 * Base Vector Lines Feature
 * Common variables and methods shared by all vector lines and/or polygons features
 */
export class BaseVectorLine {
  /**
   * @param geometry - the geometry of the feature
   * @param mvalues - the M values of the feature
   * @param offset - the offset of the feature
   */
  constructor(
    public geometry: VectorLine,
    public mvalues?: OProperties[],
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
    properties?: OProperties,
    id?: number,
  ) {
    super(properties, id);
  }

  /**
   * @returns - true if the feature has offsets
   */
  hasOffsets(): boolean {
    return this.geometry.some((line) => line.offset > 0);
  }

  /**
   * @returns - true if the feature has BBox
   */
  hasBBox(): boolean {
    return this.bbox.some((v) => v !== 0);
  }

  /**
   * @param cache - the column cache to store the offsets
   * @returns the indexes in the signed column where the offsets are stored
   */
  addOffsetsToCache(cache: ColumnCacheWriter): ColumnValue[] {
    return this.geometry.map((line) => {
      return cache.addColumnData(OColumnName.signed, encodeOffset(line.offset));
    });
  }

  /**
   * @param cache - the column cache to store the geometry
   * @returns the indexes in the points column where the geometry is stored
   */
  addGeometryToCache(cache: ColumnCacheWriter): number[] {
    const indices: number[] = [];
    indices.push(this.geometry.length);
    for (const line of this.geometry) {
      indices.push(cache.addColumnData(OColumnName.points, line.geometry));
    }
    return indices;
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
    public tesselation: number[] = [],
    public bbox: BBox = [0, 0, 0, 0],
    properties?: OProperties,
    id?: number,
  ) {
    super(properties, id);
  }

  /**
   * @returns true if the feature has offsets
   */
  hasOffsets(): boolean {
    return this.geometry.some((poly) => poly.some((line) => line.offset > 0));
  }

  /**
   * @returns true if the feature has BBox
   */
  hasBBox(): boolean {
    return this.bbox.some((v) => v !== 0);
  }

  /**
   * @param cache - the column cache to store the offsets
   * @returns the indexes in the signed column where the offsets are stored
   */
  addOffsetsToCache(cache: ColumnCacheWriter): ColumnValue[] {
    return this.geometry.flatMap((poly) => {
      return [
        poly.length,
        ...poly.map((line) => {
          return cache.addColumnData(OColumnName.signed, encodeOffset(line.offset));
        }),
      ];
    });
  }

  /**
   * @param cache - the column cache to store the geometry
   * @returns the indexes in the points column where the geometry is stored
   */
  addGeometryToCache(cache: ColumnCacheWriter): number[] {
    const indices: number[] = [];
    indices.push(this.geometry.length);
    for (const poly of this.geometry) {
      indices.push(poly.length);
      for (const line of poly) {
        indices.push(cache.addColumnData(OColumnName.points, line.geometry));
      }
    }
    return indices;
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
   */
  constructor(
    public geometry: VectorPoints3D,
    properties?: OProperties,
    id?: number,
  ) {
    super(properties, id);
  }

  /**
   * @param cache - the column cache to store the geometry
   * @returns the index in the points column where the geometry is stored
   */
  addGeometryToCache(cache: ColumnCacheWriter): number {
    return cache.addColumnData(OColumnName.points3D, this.geometry);
  }
}

/**
 * Base Vector Line 3D
 * Common variables and methods shared by all 3D vector lines
 */
export class BaseVectorLine3D {
  /**
   * @param geometry - the geometry of the feature
   * @param mvalues - the M values of the feature
   * @param offset - the offset of the feature
   */
  constructor(
    public geometry: VectorLine3D,
    public mvalues?: OProperties[],
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
    properties?: OProperties,
    id?: number,
  ) {
    super(properties, id);
  }

  /**
   * @returns true if the feature has offsets
   */
  hasOffsets(): boolean {
    return this.geometry.some((line) => line.offset > 0);
  }

  /**
   * @returns true if the feature has BBox
   */
  hasBBox(): boolean {
    return this.bbox.some((v) => v !== 0);
  }

  /**
   * @param cache - the column cache to store the offsets
   * @returns the indexes in the signed column where the offsets are stored
   */
  addOffsetsToCache(cache: ColumnCacheWriter): ColumnValue[] {
    return this.geometry.map((line) => {
      return cache.addNumber(encodeOffset(line.offset));
    });
  }

  /**
   * @param cache - the column cache to store the geometry
   * @returns the indexes in the points column where the geometry is stored
   */
  addGeometryToCache(cache: ColumnCacheWriter): number[] {
    const indices: number[] = [];
    indices.push(this.geometry.length);
    for (const line of this.geometry) {
      indices.push(cache.addColumnData(OColumnName.points3D, line.geometry));
    }
    return indices;
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
  geometry: BaseVectorLine3D[][];
  indices: number[];
  tesselation: number[];
  bbox: BBox3D;

  /**
   * @param geometry - the geometry of the feature
   * @param indices - the indices of the geometry
   * @param tesselation - the tesselation of the geometry
   * @param bbox - the bbox of the feature
   * @param properties - the properties of the feature
   * @param id - the id of the feature
   */
  constructor(
    geometry: BaseVectorLine3D[][],
    indices: number[] = [],
    tesselation: number[] = [],
    bbox: BBox3D = [0, 0, 0, 0, 0, 0],
    properties?: OProperties,
    id?: number,
  ) {
    super(properties, id);
    this.geometry = geometry;
    this.indices = indices;
    this.tesselation = tesselation;
    this.bbox = bbox;
  }

  /**
   * @returns true if the feature has BBox
   */
  hasBBox(): boolean {
    return this.bbox.some((v) => v !== 0);
  }

  /**
   * @returns true if the feature has offsets
   */
  hasOffsets(): boolean {
    return this.geometry.some((poly) => poly.some((line) => line.offset > 0));
  }

  /**
   * @param cache - the column cache to store the offsets
   * @returns the indexes in the signed column where the offsets are stored
   */
  addOffsetsToCache(cache: ColumnCacheWriter): ColumnValue[] {
    return this.geometry.flatMap((poly) => {
      return [
        poly.length,
        ...poly.map((line) => {
          return cache.addColumnData(OColumnName.signed, encodeOffset(line.offset));
        }),
      ];
    });
  }

  /**
   * @param cache - the column cache to store the geometry
   * @returns the indexes in the points column where the geometry is stored
   */
  addGeometryToCache(cache: ColumnCacheWriter): number[] {
    const indices: number[] = [];
    // store number of polys
    indices.push(this.geometry.length);
    for (const poly of this.geometry) {
      // store number of lines in the poly
      indices.push(poly.length);
      for (const line of poly) {
        // store location of each line in the points3D column
        indices.push(cache.addColumnData(OColumnName.points3D, line.geometry));
      }
    }
    return indices;
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
  // const indices = feature.readIndices();
  const indices: number[] = [];
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
    case 3: {
      const geo = geometry as VectorPoly;
      const baseLines: BaseVectorLine[] = [];
      for (const line of geo) {
        baseLines.push(new BaseVectorLine(line));
      }
      return new BaseVectorPolysFeature(
        [baseLines],
        indices,
        tesselation,
        undefined,
        properties,
        id,
      );
    }
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
