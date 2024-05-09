export type BBox = [left: number, bottom: number, right: number, top: number];
export type BBox3D = [
  left: number,
  bottom: number,
  right: number,
  top: number,
  near: number,
  far: number,
];

export type Value = string | number | boolean | null;

export type Properties = Record<string, Value>;

export type Shape = Record<string, OValue>;
export type OValue = string | number | boolean | null | OValue[] | { [key: string]: OValue };

export type OProperties = Record<string, OValue>;

export type OldVectorFeatureType =
  | 1 // point[]
  | 2 // line[]
  | 3 // polygon
  | 4; // polygon[]

export type VectorFeatureType =
  | 1 // POINT[]
  | 2 // LINE[]
  | 3 // POLYGON[]
  | 4 // 3D_POINT[]
  | 5 // 3D_LINE[]
  | 6; // 3D_POLYGON[]

export interface Point {
  x: number;
  y: number;
  m?: OValue;
}
export interface Point3D {
  x: number;
  y: number;
  z: number;
  m?: OValue;
}

export type VectorPoints = Point[];
export type VectorPoints3D = Point3D[];
export type VectorLine = Point[];
export type VectorLine3D = Point3D[];
export type VectorLines = VectorLine[];
export type VectorLines3D = VectorLine3D[];
export type VectorPoly = Point[][];
export type VectorPoly3D = Point3D[][];
export type VectorMultiPoly = Point[][][];
export type VectorMultiPoly3D = Point3D[][][];
export type VectorGeometry =
  | VectorPoints
  | VectorLines
  | VectorPoly
  | VectorMultiPoly
  | VectorPoints3D
  | VectorLines3D
  | VectorPoly3D
  | VectorMultiPoly3D;
