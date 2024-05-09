import type { VectorFeature } from "../index";
import type {
  OValue,
  VectorPoints,
  VectorLines,
  VectorMultiPoly,
  VectorPoly,
  VectorPoints3D,
  VectorLines3D,
  VectorMultiPoly3D,
  BBox,
  BBox3D,
} from "../vectorTile.spec";

export class VectorFeatureBase {
  id?: number;
  properties: { [key: string]: OValue };
  constructor(properties: { [key: string]: OValue } = {}, id?: number) {
    this.properties = properties;
    this.id = id;
  }
}

export class BaseVectorPointsFeature extends VectorFeatureBase {
  type = 1;
  geometry: VectorPoints = [];

  constructor(geometry: VectorPoints, properties?: { [key: string]: OValue }, id?: number) {
    super(properties, id);
    this.geometry = geometry;
  }
}

export class BaseVectorLinesFeature extends VectorFeatureBase {
  type = 2;
  geometry: VectorLines;
  bbox: BBox;
  offset: number;

  constructor(
    geometry: VectorLines,
    bbox: BBox = [0, 0, 0, 0],
    offset: number = 0,
    properties?: { [key: string]: OValue },
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
  geometry: VectorMultiPoly;
  indices: number[];
  tesselation: number[];
  bbox: BBox;

  constructor(
    geometry: VectorMultiPoly,
    indices: number[] = [],
    tesselation: number[] = [],
    bbox: BBox = [0, 0, 0, 0],
    properties?: { [key: string]: OValue },
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

  constructor(geometry: VectorPoints3D, properties?: { [key: string]: OValue }, id?: number) {
    super(properties, id);
    this.geometry = geometry;
  }
}

export class BaseVectorLine3DFeature extends VectorFeatureBase {
  type = 5;
  geometry: VectorLines3D;
  bbox: BBox3D;
  offset: number;

  constructor(
    geometry: VectorLines3D,
    bbox: BBox3D = [0, 0, 0, 0, 0, 0],
    offset: number = 0,
    properties?: { [key: string]: OValue },
    id?: number,
  ) {
    super(properties, id);
    this.geometry = geometry;
    this.bbox = bbox;
    this.offset = offset;
  }
}

export class BaseVectorPoly3DFeature extends VectorFeatureBase {
  type = 6;
  geometry: VectorMultiPoly3D;
  indices: number[];
  tesselation: number[];
  bbox: BBox3D;

  constructor(
    geometry: VectorMultiPoly3D,
    indices: number[] = [],
    tesselation: number[] = [],
    bbox: BBox3D = [0, 0, 0, 0, 0, 0],
    properties?: { [key: string]: OValue },
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
  | BaseVectorLine3DFeature
  | BaseVectorPoly3DFeature;

export function fromVectorFeature(feature: VectorFeature): BaseVectorFeature {
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

// function convertVectorPointsToPoints (points: VectorPoints): VectorPoints {
//   const geometry: VectorPoints = []
//   for (const [x, y] of points) geometry.push({ x, y })
//   return geometry
// }

// function convertVectorLinesToLines (lines: VectorLines): VectorLines {
//   const geometry: VectorLines = []
//   for (const line of lines) {
//     const newLine: VectorLine = []
//     for (const [x, y] of line) newLine.push({ x, y })
//     geometry.push(newLine)
//   }
//   return geometry
// }

// export function convertS2VectorPolysToPolys (polys: S2VectorMultiPoly): VectorMultiPoly {
//   const geometry: VectorMultiPoly = []
//   for (const poly of polys) {
//     const newPoly: VectorPoly = []
//     for (const line of poly) {
//       const newLine: VectorLine = []
//       for (const [x, y] of line) newLine.push({ x, y })
//       newPoly.push(newLine)
//     }
//     geometry.push(newPoly)
//   }
//   return geometry
// }
