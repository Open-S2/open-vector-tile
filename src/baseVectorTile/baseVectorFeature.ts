import type { MapboxVectorFeature } from "../";
import type {
  VectorPoints,
  VectorLines,
  VectorMultiPoly,
  VectorPoly,
  VectorPoints3D,
  VectorLines3D,
  BBox,
  BBox3D,
  OProperties,
} from "../vectorTile.spec";

export class VectorFeatureBase {
  id?: number;
  properties: OProperties;
  constructor(properties: OProperties = {}, id?: number) {
    this.properties = properties;
    this.id = id;
  }
}

export class BaseVectorPointsFeature extends VectorFeatureBase {
  type = 1;
  geometry: VectorPoints = [];

  constructor(geometry: VectorPoints, properties?: OProperties, id?: number) {
    super(properties, id);
    this.geometry = geometry;
  }
}

export class BaseVectorLinesFeature extends VectorFeatureBase {
  type = 2;
  geometry: VectorLines;
  bbox: BBox;
  offset: number;
  mvalues?: OProperties[];

  constructor(
    geometry: VectorLines,
    bbox: BBox = [0, 0, 0, 0],
    offset: number = 0,
    properties?: OProperties,
    id?: number,
  ) {
    super(properties, id);
    this.geometry = geometry;
    this.bbox = bbox;
    this.offset = offset;
  }
}

export class BaseVectorPolysFeature extends VectorFeatureBase {
  type = 3;
  geometry: BaseVectorLinesFeature[][];
  indices: number[];
  tesselation: number[];
  bbox: BBox;

  constructor(
    geometry: BaseVectorLinesFeature[][],
    indices: number[] = [],
    tesselation: number[] = [],
    bbox: BBox = [0, 0, 0, 0],
    properties?: OProperties,
    id?: number,
  ) {
    super(properties, id);
    this.geometry = geometry;
    this.indices = indices;
    this.tesselation = tesselation;
    this.bbox = bbox;
  }
}

export class BaseVectorPoint3DFeature extends VectorFeatureBase {
  type = 4;
  geometry: VectorPoints3D = [];

  constructor(geometry: VectorPoints3D, properties?: OProperties, id?: number) {
    super(properties, id);
    this.geometry = geometry;
  }
}

export class BaseVectorLines3DFeature extends VectorFeatureBase {
  type = 5;
  geometry: VectorLines3D;
  bbox: BBox3D;
  offset: number;

  constructor(
    geometry: VectorLines3D,
    bbox: BBox3D = [0, 0, 0, 0, 0, 0],
    offset: number = 0,
    properties?: OProperties,
    id?: number,
  ) {
    super(properties, id);
    this.geometry = geometry;
    this.bbox = bbox;
    this.offset = offset;
  }
}

export class BaseVectorPolys3DFeature extends VectorFeatureBase {
  type = 6;
  geometry: BaseVectorLines3DFeature[][];
  indices: number[];
  tesselation: number[];
  bbox: BBox3D;

  constructor(
    geometry: BaseVectorLines3DFeature[][],
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
}

export type BaseVectorFeature =
  | BaseVectorPointsFeature
  | BaseVectorLinesFeature
  | BaseVectorPolysFeature
  | BaseVectorPoint3DFeature
  | BaseVectorLines3DFeature
  | BaseVectorPolys3DFeature;

export function fromMapboxVectorFeature(feature: MapboxVectorFeature): BaseVectorFeature {
  const { id, properties } = feature;
  const geometry = feature.loadGeometry();
  const indices = feature.readIndices();
  const tesselation: number[] = [];
  feature.addTesselation(tesselation, 1 / feature.extent);
  switch (feature.type) {
    case 1:
      return new BaseVectorPointsFeature(geometry as VectorPoints, properties, id);
    case 2:
      return new BaseVectorLinesFeature(
        geometry as VectorLines,
        undefined,
        undefined,
        properties,
        id,
      );
    case 3:
      return new BaseVectorPolysFeature(
        [geometry as VectorPoly],
        indices,
        tesselation,
        undefined,
        properties,
        id,
      );
    case 4:
      return new BaseVectorPolysFeature(
        geometry as VectorMultiPoly,
        indices,
        tesselation,
        undefined,
        properties,
        id,
      );
    default:
      throw new Error(`Unknown feature type: ${feature.type}`);
  }
}
