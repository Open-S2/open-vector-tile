import { OColumnName } from '../open/columnCache';
import { encodeValue } from '../open/shape';
import { weave2D, weave3D, zigzag } from '../util';

import type { ColumnCacheWriter } from '../open/columnCache';
import type MapboxVectorFeature from '../mapbox/vectorFeature';
import type { Shape } from '../open/shape';
import type {
  BBOX,
  BBox,
  BBox3D,
  OProperties,
  Point,
  VectorLine,
  VectorLine3D,
  VectorLines,
  VectorMultiPoly,
  VectorPoints,
  VectorPoints3D,
} from '../vectorTile.spec';

/**
 * Base Vector Feature
 * Common variables and methods shared by all vector features
 */
export class VectorFeatureBase<G, B = BBOX> {
  type = 0;
  /**
   * @param geometry - the geometry of the feature
   * @param properties - the properties of the feature
   * @param id - the id of the feature if there is one
   * @param bbox - the BBox of the feature
   */
  constructor(
    public geometry: G,
    public properties: OProperties = {},
    public id?: number,
    public bbox?: B,
  ) {}

  /** @returns - true if the feature has BBox */
  get hasBBox(): boolean {
    const bbox = this.bbox as BBOX | undefined;
    return bbox !== undefined && bbox.some((v) => v !== 0);
  }
}

//! Points & Points3D

/** Base Vector Points Feature */
export class VectorFeaturePointsBase<
  G = VectorPoints | VectorPoints3D,
  B = BBOX,
> extends VectorFeatureBase<G, B> {
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
    const geometry = this.geometry as VectorPoints | VectorPoints3D;
    return geometry.some(({ m }) => m !== undefined);
  }

  /** @returns the geometry */
  loadGeometry(): G {
    return this.geometry;
  }

  /** @returns the M-Values */
  getMValues(): undefined | OProperties[] {
    if (!this.hasMValues) return undefined;
    const geometry = this.geometry as VectorPoints | VectorPoints3D;
    return geometry.map(({ m }) => m ?? {});
  }

  /**
   * @param cache - the column cache to store the geometry
   * @param mShape - the shape of the M-values to encode the values as
   * @returns the index in the points column where the geometry is stored
   */
  addGeometryToCache(cache: ColumnCacheWriter, mShape: Shape = {}): number {
    const { hasMValues } = this;
    const geometry = this.geometry as VectorPoints | VectorPoints3D;
    const is3D = this.type === 4;
    const columnName = is3D ? OColumnName.points3D : OColumnName.points;
    if (geometry.length === 1) {
      if (is3D) {
        const { x, y, z } = (geometry as VectorPoints3D)[0];
        return weave3D(zigzag(x), zigzag(y), zigzag(z));
      } else {
        const { x, y } = geometry[0];
        return weave2D(zigzag(x), zigzag(y));
      }
    }
    // othwerise store the collection of points
    const indices: number[] = [];
    indices.push(cache.addColumnData(columnName, geometry));
    // store length of mvalues and the mvalues indexes if they exist
    if (hasMValues) {
      for (const { m } of geometry) {
        indices.push(encodeValue(m ?? {}, mShape, cache));
      }
    }
    return cache.addColumnData(OColumnName.indices, indices);
  }
}

/**
 * Base Vector Points Feature
 * Type 1
 * Extends from @see {@link VectorFeatureBase}.
 * Store either a single point or a list of points
 */
export class BaseVectorPointsFeature extends VectorFeaturePointsBase<VectorPoints, BBox> {
  type = 1;
}
/**
 * Base Vector Point 3D Feature
 */
export class BaseVectorPoint3DFeature extends VectorFeaturePointsBase<VectorPoints3D, BBox3D> {
  type = 4;
}

//! Lines & Lines3D

/**
 * Base Vector Lines Feature
 * Common variables and methods shared by all vector lines and/or polygons features
 */
export class BaseVectorLine<L = VectorLine | VectorLine3D> {
  /**
   * @param geometry - the geometry of the feature
   * @param offset - the offset of the feature
   */
  constructor(
    public geometry: L,
    public offset: number = 0,
  ) {}
}

/** Base Vector Lines Feature */
export class VectorFeatureLinesBase<
  G = VectorLine | VectorLine3D,
  B = BBOX,
> extends VectorFeatureBase<BaseVectorLine<G>[], B> {
  /** @returns - true if the feature has offsets */
  get hasOffsets(): boolean {
    const geometry = this.geometry as BaseVectorLine<G>[];
    return geometry.some(({ offset }) => offset > 0);
  }

  /**
   * @returns - true if the feature has M values
   */
  get hasMValues(): boolean {
    return this.geometry.some(({ geometry }) => {
      return (geometry as VectorLine | VectorLine3D).some(({ m }) => m !== undefined);
    });
  }

  /** @returns the flattened geometry */
  loadGeometry(): G[] {
    return this.geometry.map(({ geometry }) => geometry);
  }

  /** @returns the flattened M values */
  getMValues(): undefined | OProperties[] {
    if (!this.hasMValues) return undefined;
    return this.geometry.flatMap(({ geometry }) =>
      (geometry as VectorLine | VectorLine3D).map(({ m }) => m ?? {}),
    );
  }

  /**
   * @param cache - the column cache to store the geometry
   * @param mShape - the shape of the M-values to encode the values as
   * @returns the indexes in the points column where the geometry is stored
   */
  addGeometryToCache(cache: ColumnCacheWriter, mShape: Shape = {}): number {
    const { hasOffsets, hasMValues } = this;
    const geometry = this.geometry as BaseVectorLine<VectorLine | VectorLine3D>[];
    const columnName = this.type === 5 ? OColumnName.points3D : OColumnName.points;
    const indices: number[] = [];
    // store number of lines
    if (geometry.length !== 1) indices.push(geometry.length);
    for (const line of geometry) {
      // store offset for current line
      if (hasOffsets) indices.push(encodeOffset(line.offset));
      // store geometry data and track its index position
      indices.push(cache.addColumnData(columnName, line.geometry));
      // store length of mvalues and the mvalues indexes if they exist
      if (hasMValues) {
        for (const { m } of line.geometry) {
          indices.push(encodeValue(m ?? {}, mShape, cache));
        }
      }
    }
    return cache.addColumnData(OColumnName.indices, indices);
  }
}

/**
 * Base Vector Lines Feature
 * Type 2
 * Extends from @see {@link VectorFeatureBase}.
 * Store either a single line or a list of lines.
 */
export class BaseVectorLinesFeature extends VectorFeatureLinesBase<VectorLine, BBox> {
  type = 2;
}
/**
 * Base Vector Lines 3D Feature
 * Type 5
 * Extends from @see {@link VectorFeatureBase}.
 * Store either a single 3D line or a list of 3D lines
 */
export class BaseVectorLines3DFeature extends VectorFeatureLinesBase<VectorLine3D, BBox3D> {
  type = 5;
}

//! Polys & Polys3D

/** Base Vector Polys Feature */
export class VectorFeaturePolysBase<
  G = VectorLine | VectorLine3D,
  B = BBOX,
> extends VectorFeatureBase<BaseVectorLine<G>[][], B> {
  tesselation: Point[];
  /**
   * @param geometry - the geometry of the feature
   * @param indices - the indices of the geometry
   * @param tesselation - the tesselation of the geometry
   * @param properties - the properties of the feature
   * @param id - the id of the feature
   * @param bbox - the bbox of the feature
   */
  constructor(
    public geometry: BaseVectorLine<G>[][],
    public indices: number[] = [],
    tesselation: number[] = [],
    properties: OProperties = {},
    id?: number,
    public bbox?: B,
  ) {
    super(geometry, properties, id, bbox);
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
    return this.geometry.some((poly) => poly.some(({ offset }) => offset > 0));
  }

  /**
   * @returns - true if the feature has M values
   */
  get hasMValues(): boolean {
    return this.geometry.some((poly) =>
      poly.some(({ geometry }) => {
        return (geometry as VectorLine | VectorLine3D).some(({ m }) => m !== undefined);
      }),
    );
  }

  /**
   * @returns the flattened geometry
   */
  loadGeometry(): G[][] {
    return this.geometry.map((poly) => poly.map((line) => line.geometry));
  }

  /**
   * @returns the flattened M-values
   */
  getMValues(): undefined | OProperties[] {
    if (!this.hasMValues) return undefined;
    return this.geometry.flatMap((poly) => {
      return poly.flatMap(({ geometry }) => {
        return (geometry as VectorLine | VectorLine3D).map((point) => point.m ?? {});
      });
    });
  }

  /**
   * @param cache - the column cache to store the geometry
   * @param mShape - the shape of the M-values to encode the values as
   * @returns the indexes in the points column where the geometry is stored
   */
  addGeometryToCache(cache: ColumnCacheWriter, mShape: Shape = {}): number {
    const { hasOffsets, hasMValues } = this;
    const geometry = this.geometry as BaseVectorLine<G>[][];
    const columnName = this.type === 6 ? OColumnName.points3D : OColumnName.points;
    const indices: number[] = [];
    // store number of polygons
    if (this.geometry.length > 1) indices.push(geometry.length);
    for (const poly of geometry) {
      // store number of lines in the polygon
      indices.push(poly.length);
      // store each line
      for (const line of poly) {
        // store offset for current line
        if (hasOffsets) indices.push(encodeOffset(line.offset));
        // store geometry data and track its index position
        indices.push(cache.addColumnData(columnName, line.geometry));
        // store length of mvalues and the mvalues indexes if they exist
        if (hasMValues) {
          for (const { m } of line.geometry as VectorLine | VectorLine3D) {
            indices.push(encodeValue(m ?? {}, mShape, cache));
          }
        }
      }
    }
    return cache.addColumnData(OColumnName.indices, indices);
  }
}

/**
 * Base Vector Polys Feature
 * Type 3
 * Extends from @see {@link VectorFeatureBase}.
 * Store either a single polygon or a list of polygons
 */
export class BaseVectorPolysFeature extends VectorFeaturePolysBase<VectorLine, BBox> {
  type = 3;
}

/**
 * Base Vector Polys 3D Feature
 * Type 6
 * Extends from @see {@link VectorFeatureBase}.
 * Store either a single 3D poly or a list of 3D polys
 */
export class BaseVectorPolys3DFeature extends VectorFeaturePolysBase<VectorLine3D, BBox3D> {
  type = 6;
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
  const { id, properties, extent } = feature;
  const geometry = feature.loadGeometry();
  const indices = feature.readIndices();
  const tesselation: number[] = [];
  feature.addTesselation(tesselation, 1 / extent);
  switch (feature.type) {
    case 1:
      return new BaseVectorPointsFeature(geometry as VectorPoints, properties, id);
    case 2: {
      const geo = geometry as VectorLines;
      const baseLines: BaseVectorLine<VectorLine>[] = [];
      for (const line of geo) {
        baseLines.push(new BaseVectorLine(line));
      }
      return new BaseVectorLinesFeature(baseLines, properties, id);
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
      return new BaseVectorPolysFeature(baseMultPoly, indices, tesselation, properties, id);
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
