import type Protobuf from "../pbf";
import type {
  BBox,
  BBox3D,
  OValue,
  VectorFeatureType,
  VectorGeometry,
  VectorLine,
  VectorLine3D,
  VectorLines,
  VectorLines3D,
  VectorMultiPoly,
  VectorMultiPoly3D,
  VectorPoints,
  VectorPoints3D,
} from "../vectorTile.spec";
import type { ColumnCacheReader } from "./columnCache";
export interface OVectorFeatureBase {
  type: VectorFeatureType;
  id: number;
  properties: OValue;

  bbox: () => BBox | BBox3D;
  hasMvalues: () => boolean;
  loadLines: () => Array<{ offset: number; line: VectorLine }>;
  loadGeometry: () => VectorGeometry;
  loadGeometryFlat: () => [number[], number[]];
  readIndices: () => number[];
  addTesselation: (geometry: number[], multiplier: number) => void;
}

export interface VectorPointsFeature extends OVectorFeatureBase {
  type: 1;

  loadGeometry: () => VectorPoints;
}
export interface VectorPoints3DFeature extends OVectorFeatureBase {
  type: 4;

  loadGeometry: () => VectorPoints3D;
}

export interface VectorLinesFeature extends OVectorFeatureBase {
  type: 2;

  loadGeometry: () => VectorLines;
  loadLines: () => Array<{ offset: number; line: VectorLine }>;
  bbox: () => BBox;
  hasMvalues: () => boolean;
}
export interface VectorLines3DFeature extends OVectorFeatureBase {
  type: 5;

  loadGeometry: () => VectorLines3D;
  loadLines: () => Array<{ offset: number; line: VectorLine3D }>;
  bbox: () => BBox3D;
  hasMvalues: () => boolean;
}

export interface OVectorPolygonsFeature extends OVectorFeatureBase {
  type: 3;

  loadGeometry: (withMValues?: boolean) => VectorMultiPoly;
  loadGeometryFlat: () => [number[], number[]];
  loadLines: (withMValues?: boolean) => Array<{ offset: number; line: VectorLine }>;
  bbox: () => BBox;
  hasMvalues: () => boolean;
  readIndices: () => number[];
  addTesselation: (geometry: number[], multiplier: number) => void;
}
export interface OVectorPolygons3DFeature extends OVectorFeatureBase {
  type: 6;

  loadGeometry: (withMValues?: boolean) => VectorMultiPoly3D;
  loadGeometryFlat: () => [number[], number[]];
  loadLines: (withMValues?: boolean) => Array<{ offset: number; line: VectorLine3D }>;
  bbox: () => BBox3D;
  hasMvalues: () => boolean;
  readIndices: () => number[];
  addTesselation: (geometry: number[], multiplier: number) => void;
}

export type OpenVectorFeature =
  | VectorPointsFeature
  | VectorPoints3DFeature
  | VectorLinesFeature
  | VectorLines3DFeature
  | OVectorPolygonsFeature
  | OVectorPolygons3DFeature;

export class OVectorFeature implements OVectorFeatureBase {
  type: VectorFeatureType = 1;
  id: number; // id is required but may be 0 to reperesent null (its a u65)
  properties: OValue = {};
  readonly extent: number;
  readonly #cache: ColumnCacheReader;
  #mValues = -1;
  #bbox = -1;
  #indices = -1;
  #geometry = -1;
  #tesselation = -1;

  constructor(
    pbf: Protobuf,
    end: number,
    id: number, // id is required but may be 0
    extent: number,
    cache: ColumnCacheReader,
  ) {
    this.extent = extent;
    this.#cache = cache;
    this.id = id;

    pbf.readFields(this.#readFeature.bind(this), this, end);
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
