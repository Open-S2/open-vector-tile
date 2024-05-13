import Protobuf from "../pbf";
import { encodeValue } from "./vectorValue";

import type {
  BBox,
  BBox3D,
  OProperties,
  VectorFeatureType,
  VectorGeometry,
  VectorLine,
  VectorLine3D,
  VectorLines3D,
  VectorMultiPoly,
  VectorMultiPoly3D,
  VectorPoints,
  VectorPoints3D,
} from "../vectorTile.spec";
import {
  OColumnName,
  columnEncode,
  type ColumnCacheReader,
  type ColumnCacheWriter,
} from "./columnCache";
import type { BaseVectorFeature } from "../baseVectorTile";
import type { Extents } from "./vectorLayer";

export class OVectorFeatureBase {
  /** @internal */
  _cache: ColumnCacheReader;
  /** @internal */
  _geometryIndex: number;
  constructor(
    cache: ColumnCacheReader,
    public id: number,
    public properties: OProperties,
    public extent: number,
    geometryIndex: number,
  ) {
    this._cache = cache;
    this._geometryIndex = geometryIndex;
  }

  // mValues: () => null | OProperties[];
  // loadLines: () => Array<{ offset: number; line: VectorLine }>;
  // loadGeometry: () => VectorGeometry;
  // loadGeometryFlat: () => [number[], number[]];
  // readIndices: () => number[];
  // addTesselation: (geometry: number[], multiplier: number) => void;
}

export class VectorPointsFeature extends OVectorFeatureBase {
  type = 1;
  constructor(
    cache: ColumnCacheReader,
    id: number,
    properties: OProperties,
    extent: number,
    geometryIndex: number,
  ) {
    super(cache, id, properties, extent, geometryIndex);
  }

  // TODO:
  loadGeometry(): VectorPoints {}
}

export class VectorLinesFeature extends OVectorFeatureBase {
  #bboxIndices: BBox;
  type: VectorFeatureType = 1;
  constructor(pbf: Protobuf, cache: ColumnCacheReader) {
    super(pbf, cache);
    this.#bboxIndices = pbf.readPackedVarint() as BBox;
  }

  bbox(): BBox {
    return this.#bboxIndices.map((index) => {
      return this._cache.getColumn(OColumnName.double, index);
    }) as BBox;
  }

  // mValues: () => null | OProperties[];
  // loadLines: () => Array<{ offset: number; line: VectorLine }>;
  // loadGeometry: () => VectorGeometry;
}
export class OVectorFeatureBaseLines3D extends OVectorFeatureBase {
  #bboxIndices: BBox3D;
  constructor(pbf: Protobuf, cache: ColumnCacheReader) {
    super(pbf, cache);
    this.#bboxIndices = pbf.readPackedVarint() as BBox3D;
  }

  bbox(): BBox3D {
    return this.#bboxIndices.map((index) => {
      return this._cache.getColumn(OColumnName.double, index);
    }) as BBox3D;
  }

  // mValues: () => null | OProperties[];
  // loadLines: () => Array<{ offset: number; line: VectorLine3D }>;
  // loadGeometry: () => VectorGeometry;
}
export interface OVectorFeatureBasePolys extends OVectorFeatureBase {}
export interface OVectorFeatureBasePolys3D extends OVectorFeatureBase {}

// export interface VectorPointsFeature extends OVectorFeatureBase {
//   type: 1;

//   loadGeometry: () => VectorPoints;
// }
export interface VectorPoints3DFeature extends OVectorFeatureBase {
  type: 4;

  loadGeometry: () => VectorPoints3D;
}

// export interface VectorLinesFeature extends OVectorFeatureBase {
//   type: 2;

//   loadGeometry: () => VectorLines;
//   loadLines: () => Array<{ offset: number; line: VectorLine }>;
//   bbox: () => BBox;
//   mValues: () => null | OProperties[];
// }
export interface VectorLines3DFeature extends OVectorFeatureBase {
  type: 5;

  loadGeometry: () => VectorLines3D;
  loadLines: () => Array<{ offset: number; line: VectorLine3D }>;
  bbox: () => BBox3D;
  mValues: () => null | OProperties[];
}

export interface OVectorPolygonsFeature extends OVectorFeatureBase {
  type: 3;

  loadGeometry: (withMValues?: boolean) => VectorMultiPoly;
  loadGeometryFlat: () => [number[], number[]];
  loadLines: (withMValues?: boolean) => Array<{ offset: number; line: VectorLine }>;
  bbox: () => BBox;
  mValues: () => null | OProperties[];
  readIndices: () => number[];
  addTesselation: (geometry: number[], multiplier: number) => void;
}
export interface OVectorPolygons3DFeature extends OVectorFeatureBase {
  type: 6;

  loadGeometry: (withMValues?: boolean) => VectorMultiPoly3D;
  loadGeometryFlat: () => [number[], number[]];
  loadLines: (withMValues?: boolean) => Array<{ offset: number; line: VectorLine3D }>;
  bbox: () => BBox3D;
  mValues: () => null | OProperties[];
  readIndices: () => number[];
  addTesselation: (geometry: number[], multiplier: number) => void;
}

// export type OpenVectorFeature =
//   | VectorPointsFeature
//   | VectorPoints3DFeature
//   | VectorLinesFeature
//   | VectorLines3DFeature
//   | OVectorPolygonsFeature
//   | OVectorPolygons3DFeature;

export class OVectorFeature implements OVectorFeatureBase {
  type: VectorFeatureType = 1;
  id = 0;
  properties: OProperties = {};
  extent: Extents;
  #cache: ColumnCacheReader;
  #mValues = -1;
  #bbox = -1;
  #indices = -1;
  #geometry = -1;
  #tesselation = -1;

  constructor(pbf: Protobuf, end: number, extent: Extents, cache: ColumnCacheReader) {
    this.extent = extent;
    this.#cache = cache;
    pbf.readFields(this.#readFeature.bind(this), this, end);
  }

  mValues(): OProperties[] | null {
    return null;
  }

  #readFeature(tag: number, feature: OVectorFeature, pbf: Protobuf): void {
    if (tag === 1) feature.properties = this.#cache.getColumnData(pbf.readVarint());
    else if (tag === 2) feature.type = pbf.readVarint() as VectorFeatureType;
    else if (tag === 3) feature.#geometry = pbf.pos;
    else if (tag === 4) feature.#indices = pbf.pos;
    else if (tag === 5) feature.#tesselation = pbf.pos;
    else if (tag === 6) feature.#mValues = pbf.pos;
    else if (tag === 7) feature.#bbox = pbf.pos;
  }

  // TODO:
  bbox(): BBox | BBox3D {
    if (this.type === 2 || this.type === 3) return [0, 0, 0, 0] as BBox;
    else if (this.type === 5 || this.type === 6) return [0, 0, 0, 0, 0, 0] as BBox3D;
    else throw new Error("Not applicable to feature type");
  }

  hasMvalues(): boolean {
    return this.#mValues !== -1;
  }

  // TODO
  loadGeometry(): VectorGeometry {
    return [];
  }

  // TODO
  loadLines(): Array<{ offset: number; line: VectorLine }> {
    return [];
  }

  // TODO
  loadGeometryFlat(): [number[], number[]] {
    return [[], []];
  }

  // TODO
  readIndices(): number[] {
    return [];
  }

  // TODO:
  addTesselation(geometry: number[], multiplier: number): void {}
}

export function readFeatures(
  features: OVectorFeature[],
  cache: ColumnCacheReader,
  bytes: Uint8Array,
): void {
  const pbf = new Protobuf(bytes);
  // read in order:
  // id, type, properties, bbox, geometry, indices, tesselation, mValues
}

export function writeFeature(feature: BaseVectorFeature, cache: ColumnCacheWriter): Buffer {
  // write id, type, properties, bbox, geometry, indices, tesselation, mValues
  const pbf = new Protobuf();
  // id is stored in unsigned column
  pbf.writeVarint(columnEncode(OColumnName.unsigned, feature.id ?? 0));
  // type is just stored as a varint
  pbf.writeVarint(feature.type);
  // index to values column
  pbf.writeVarint(encodeValue(cache, feature.properties));
  // bbox is stored in double column.
  if ("bbox" in feature) pbf.writeVarint(cache.addColumnData(OColumnName.double, feature.bbox));
  // offset is stored in signed column offset is a float, so we need to convert it to a
  // signed integer by multiplying by 1000 and then simplifying to an integer
  if ("offset" in feature)
    pbf.writeVarint(cache.addColumnData(OColumnName.signed, encodeOffset(feature.offset)));
  // geometry
  if ("geometry" in feature) pbf.writeVarint(feature.addGeometryToCache(cache));
  // indices
  if ("indices" in feature)
    pbf.writeVarint(cache.addColumnData(OColumnName.indices, feature.indices));
  // tesselation
  if ("tesselation" in feature)
    pbf.writeVarint(cache.addColumnData(OColumnName.points, feature.tesselation));
  // mValues will be written as Shapes. The feature will write each shape in, build an index list
  // that index list will be stored in in the indices column, and the index to the indices column
  // is returned.
  if ("mValues" in feature) {
    pbf.writeVarint(1);
    pbf.writeVarint(feature.addMvaluesToCache(cache));
  } else {
    pbf.writeVarint(0);
  }

  return Buffer.from(pbf.commit());
}

function encodeOffset(offset: number): number {
  return Math.floor(offset * 1000);
}

function decodeOffset(offset: number): number {
  return offset / 1000;
}
