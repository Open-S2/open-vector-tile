import { OColumnName } from '../open/columnCache';
import { encodeValue } from '../open/shape';
import { weave2D, weave3D, zigzag } from '../util';

import type { ColumnCacheWriter } from '../open/columnCache';
import type MapboxVectorFeature from '../mapbox/vectorFeature';
import type { VectorFeatures as S2JSONFeature } from 's2json-spec';
import type { Shape } from '../open/shape';
import type { BBOX, BBox, BBox3D, Properties as OProperties } from 's2json-spec';
import type {
  Point,
  Point3D,
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
    // store the mvalues indexes if they exist
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
 * Extends from @see {@link VectorFeaturePointsBase}.
 * Store either a single point or a list of points
 */
export class BaseVectorPointsFeature extends VectorFeaturePointsBase<VectorPoints, BBox> {
  type = 1;
}
/**
 * Base Vector Points 3D Feature
 * Type 4
 * Extends from @see {@link VectorFeaturePointsBase}.
 * Store either a single point or a list of points
 */
export class BaseVectorPoints3DFeature extends VectorFeaturePointsBase<VectorPoints3D, BBox3D> {
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
      // store the mvalues indexes if they exist
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
  tessellation: Point[];
  /**
   * @param geometry - the geometry of the feature
   * @param indices - the indices of the geometry
   * @param tessellation - the tessellation of the geometry
   * @param properties - the properties of the feature
   * @param id - the id of the feature
   * @param bbox - the bbox of the feature
   */
  constructor(
    public geometry: BaseVectorLine<G>[][],
    public indices: number[] = [],
    tessellation: number[] = [],
    properties: OProperties = {},
    id?: number,
    public bbox?: B,
  ) {
    super(geometry, properties, id, bbox);
    this.tessellation = this.#fixTessellation(tessellation);
  }

  /**
   * @param tessellation - the tessellation of the geometry but flattened
   * @returns - the tessellation of the geometry as a list of points
   */
  #fixTessellation(tessellation: number[]): Point[] {
    if (tessellation.length % 2 !== 0) {
      throw new Error('The input tessellation must have an even number of elements.');
    }
    return tessellation.reduce((acc, _, index, array) => {
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
        // store the mvalues indexes if they exist
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
  | BaseVectorPoints3DFeature
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
  const tessellation: number[] = [];
  feature.addTessellation(tessellation, 1 / extent);
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
      return new BaseVectorPolysFeature(baseMultPoly, indices, tessellation, properties, id);
    }
    default:
      throw new Error(`Unknown feature type: ${feature.type}`);
  }
}

/**
 * Convert an S2JSON feature to a base feature
 * @param feature - An S2JSON feature
 * @param extent - the extent of the vector layer
 * @returns - A base feature to help build a vector tile
 */
export function fromS2JSONFeature(feature: S2JSONFeature, extent: number): BaseVectorFeature {
  const { geometry, properties, id } = feature;
  const { type, is3D, coordinates, bbox, offset } = geometry;

  if (type === 'Point') {
    if (is3D)
      return new BaseVectorPoints3DFeature(
        [transformPoint3D(coordinates, extent)],
        properties,
        id,
        bbox as BBox3D,
      );
    else
      return new BaseVectorPointsFeature(
        [transformPoint(coordinates, extent)],
        properties,
        id,
        bbox as BBox,
      );
  } else if (type === 'MultiPoint') {
    if (is3D)
      return new BaseVectorPoints3DFeature(
        coordinates.map((p) => transformPoint3D(p, extent)),
        properties,
        id,
        bbox as BBox3D,
      );
    else
      return new BaseVectorPointsFeature(
        coordinates.map((p) => transformPoint(p, extent)),
        properties,
        id,
        bbox as BBox,
      );
  } else if (type === 'LineString') {
    if (is3D)
      return new BaseVectorLines3DFeature(
        [
          new BaseVectorLine(
            coordinates.map((p) => transformPoint3D(p, extent)),
            offset,
          ),
        ],
        properties,
        id,
        bbox as BBox3D,
      );
    else
      return new BaseVectorLinesFeature(
        [
          new BaseVectorLine(
            coordinates.map((p) => transformPoint(p, extent)),
            offset,
          ),
        ],
        properties,
        id,
        bbox as BBox,
      );
  } else if (type === 'MultiLineString') {
    if (is3D)
      return new BaseVectorLines3DFeature(
        coordinates.map((line, i) => {
          return new BaseVectorLine(
            line.map((p) => transformPoint3D(p, extent)),
            offset?.[i],
          );
        }),
        properties,
        id,
        bbox as BBox3D,
      );
    else
      return new BaseVectorLinesFeature(
        coordinates.map((line, i) => {
          return new BaseVectorLine(
            line.map((p) => transformPoint(p, extent)),
            offset?.[i],
          );
        }),
        properties,
        id,
        bbox as BBox,
      );
  } else if (type === 'Polygon') {
    const { indices, tessellation } = geometry;
    if (is3D)
      return new BaseVectorPolys3DFeature(
        [
          coordinates.map((line, i) => {
            return new BaseVectorLine(
              line.map((p) => transformPoint3D(p, extent)),
              offset?.[i],
            );
          }),
        ],
        indices,
        tessellation,
        properties,
        id,
        bbox as BBox3D,
      );
    else
      return new BaseVectorPolysFeature(
        [
          coordinates.map((line, i) => {
            return new BaseVectorLine(
              line.map((p) => transformPoint(p, extent)),
              offset?.[i],
            );
          }),
        ],
        indices,
        tessellation,
        properties,
        id,
        bbox as BBox,
      );
  } else if (type === 'MultiPolygon') {
    const { indices, tessellation } = geometry;
    if (is3D)
      return new BaseVectorPolys3DFeature(
        coordinates.map((poly, i) => {
          return poly.map((line, j) => {
            return new BaseVectorLine(
              line.map((p) => transformPoint3D(p, extent)),
              offset?.[i]?.[j],
            );
          });
        }),
        indices,
        tessellation,
        properties,
        id,
        bbox as BBox3D,
      );
    else
      return new BaseVectorPolysFeature(
        coordinates.map((poly, i) => {
          return poly.map((line, j) => {
            return new BaseVectorLine(
              line.map((p) => transformPoint(p, extent)),
              offset?.[i]?.[j],
            );
          });
        }),
        indices,
        tessellation,
        properties,
        id,
        bbox as BBox,
      );
  } else {
    throw new Error(`Unknown geometry type: ${type}`);
  }
}

/**
 * Transform a point in place to an extent
 * @param p - the point
 * @param extent - the extent
 * @returns - the transformed point
 */
function transformPoint(p: Point, extent: number): Point {
  const { round } = Math;
  return { x: round(p.x * extent), y: round(p.y * extent) };
}

/**
 * Transform a 3D point in place to an extent
 * @param p - the 3D point
 * @param extent - the extent
 * @returns - the transformed 3D point
 */
function transformPoint3D(p: Point | Point3D, extent: number): Point3D {
  const { round } = Math;
  return {
    x: round(p.x * extent),
    y: round(p.y * extent),
    z: round(('z' in p ? p.z : 0) * extent),
  };
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
