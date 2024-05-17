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
 *
 */
export class VectorFeatureBase {
  /**
   * @param properties
   * @param id
   */
  constructor(
    public properties: OProperties = {},
    public id?: number,
  ) {}

  /**
   *
   */
  hasOffsets(): boolean {
    return false;
  }

  /**
   *
   */
  hasMValues(): boolean {
    return false;
  }

  /**
   *
   */
  hasBBox(): boolean {
    return false;
  }

  /**
   * @param cache
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addOffsetsToCache(cache: ColumnCacheWriter): ColumnValue[] {
    return [];
  }
}

/**
 *
 */
export class BaseVectorPointsFeature extends VectorFeatureBase {
  type = 1;
  /**
   * @param geometry
   * @param properties
   * @param id
   */
  constructor(
    public geometry: VectorPoints,
    properties?: OProperties,
    id?: number,
  ) {
    super(properties, id);
  }

  /**
   * @param cache
   */
  addGeometryToCache(cache: ColumnCacheWriter): number {
    return cache.addColumnData(OColumnName.points, this.geometry);
  }
}

/**
 *
 */
export class BaseVectorLine {
  /**
   * @param geometry
   * @param mvalues
   * @param offset
   */
  constructor(
    public geometry: VectorLine,
    public mvalues?: OProperties[],
    public offset: number = 0,
  ) {}
}

/**
 *
 */
export class BaseVectorLinesFeature extends VectorFeatureBase {
  type = 2;
  /**
   * @param geometry
   * @param bbox
   * @param properties
   * @param id
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
   *
   */
  hasOffsets(): boolean {
    return this.geometry.some((line) => line.offset > 0);
  }

  /**
   *
   */
  hasBBox(): boolean {
    return this.bbox.some((v) => v !== 0);
  }

  /**
   * @param cache
   */
  addOffsetsToCache(cache: ColumnCacheWriter): ColumnValue[] {
    return this.geometry.map((line) => {
      return cache.addColumnData(OColumnName.signed, encodeOffset(line.offset));
    });
  }

  /**
   * @param cache
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
 *
 */
export class BaseVectorPolysFeature extends VectorFeatureBase {
  type = 3;
  /**
   * @param geometry
   * @param indices
   * @param tesselation
   * @param bbox
   * @param properties
   * @param id
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
   *
   */
  hasOffsets(): boolean {
    return this.geometry.some((poly) => poly.some((line) => line.offset > 0));
  }

  /**
   *
   */
  hasBBox(): boolean {
    return this.bbox.some((v) => v !== 0);
  }

  /**
   * @param cache
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
   * @param cache
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
 *
 */
export class BaseVectorPoint3DFeature extends VectorFeatureBase {
  type = 4;
  /**
   * @param geometry
   * @param properties
   * @param id
   */
  constructor(
    public geometry: VectorPoints3D,
    properties?: OProperties,
    id?: number,
  ) {
    super(properties, id);
  }

  /**
   * @param cache
   */
  addGeometryToCache(cache: ColumnCacheWriter): number {
    return cache.addColumnData(OColumnName.points3D, this.geometry);
  }
}

/**
 *
 */
export class BaseVectorLine3D {
  /**
   * @param geometry
   * @param mvalues
   * @param offset
   */
  constructor(
    public geometry: VectorLine3D,
    public mvalues?: OProperties[],
    public offset: number = 0,
  ) {}
}

/**
 *
 */
export class BaseVectorLines3DFeature extends VectorFeatureBase {
  type = 5;
  /**
   * @param geometry
   * @param bbox
   * @param properties
   * @param id
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
   *
   */
  hasOffsets(): boolean {
    return this.geometry.some((line) => line.offset > 0);
  }

  /**
   *
   */
  hasBBox(): boolean {
    return this.bbox.some((v) => v !== 0);
  }

  /**
   * @param cache
   */
  addOffsetsToCache(cache: ColumnCacheWriter): ColumnValue[] {
    return this.geometry.map((line) => {
      return cache.addNumber(encodeOffset(line.offset));
    });
  }

  /**
   * @param cache
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
 *
 */
export class BaseVectorPolys3DFeature extends VectorFeatureBase {
  type = 6;
  geometry: BaseVectorLine3D[][];
  indices: number[];
  tesselation: number[];
  bbox: BBox3D;

  /**
   * @param geometry
   * @param indices
   * @param tesselation
   * @param bbox
   * @param properties
   * @param id
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
   *
   */
  hasBBox(): boolean {
    return this.bbox.some((v) => v !== 0);
  }

  /**
   *
   */
  hasOffsets(): boolean {
    return this.geometry.some((poly) => poly.some((line) => line.offset > 0));
  }

  /**
   * @param cache
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
   * @param cache
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
 *
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
