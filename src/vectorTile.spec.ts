import type { Face, VectorFeatures } from 's2json-spec';

/**
 * A BBOX is defined in lon-lat space and helps with zooming motion to
 * see the entire line or polygon
 */
export type BBox = [left: number, bottom: number, right: number, top: number];
/**
 * A BBOX is defined in lon-lat space and helps with zooming motion to
 * see the entire 3D line or polygon
 */
export type BBox3D = [
  left: number,
  bottom: number,
  right: number,
  top: number,
  near: number,
  far: number,
];
/** A 2D or 3D Bounding Box */
export type BBOX = BBox | BBox3D;

/**
 * Value is the old type used by Mapbox vector tiles. Properties can not be nested, so we only
 * support string, number, boolean, and null
 */
export type Value = string | number | boolean | null;

/**
 * A Mapbox Properties is a storage structure for the vector feature. keys are strings, values are
 * any basic type of Value
 */
export type Properties = Record<string, Value>;

/** Primitive types supported by Properties */
export type Primitive = string | number | boolean | null | undefined;

/**
 * When an array is used, it must be an array of the same type.
 * Arrays are also limited to primitives and objects of primitives
 */
export type ValueArray =
  Array<Primitive | { [key: string]: Primitive }> extends (infer U)[] ? U[] : never;

/**
 * The new OpenVectorTile type can create complex nested objects.
 * May either be a string, number, boolean, null, an array of those types, or an object of those types
 * Object keys are always strings, values can be any basic type, an array, or a nested object.
 */
export type OValue = Primitive | ValueArray | { [key: string]: OValue };

/**
 * Some components inside the OpenVectorTile spec require the starting with an object of key-value pairs.
 * `MValues`and `feature properties` are such a case.
 */
export type OProperties = Record<string, OValue>;

/** Mapbox Vector Feature types. */
export type OldVectorFeatureType =
  | 1 // point[]
  | 2 // line[]
  | 3 // polygon
  | 4; // polygon[]

/** Open Vector Tile Feature types. */
export type VectorFeatureType =
  | 1 // POINT[]
  | 2 // LINE[]
  | 3 // POLYGON[]
  | 4 // 3D_POINT[]
  | 5 // 3D_LINE[]
  | 6; // 3D_POLYGON[]

/**
 * Open Vector Spec can be an x,y but also may contain an MValue if the geometry is
 * a line or polygon
 */
export interface Point {
  x: number;
  y: number;
  m?: OProperties;
}
/**
 * Open Vector Spec can be an x,y,z but also may contain an MValue if the geometry
 * is a line or polygon
 */
export interface Point3D {
  x: number;
  y: number;
  z: number;
  m?: OProperties;
}

/** Built array line data with associated offset to help render dashed lines across tiles. */
export interface VectorLineWithOffset {
  /** the offset of the line to start processing the dash position */
  offset: number;
  /** the line data */
  geometry: VectorLine;
}
/** Built array line data with associated offset to help render dashed lines across tiles. */
export type VectorLinesWithOffset = VectorLineWithOffset[];
/** Built array line data with associated offset to help render dashed lines across tiles. */
export interface VectorLine3DWithOffset {
  /** the offset of the line to start processing the dash position */
  offset: number;
  /** the line data */
  geometry: VectorLine3D;
}
/** Built array line data with associated offset to help render dashed lines across tiles. */
export type VectorLines3DWithOffset = VectorLine3DWithOffset[];

/** A set of points */
export type VectorPoints = Point[];
/** A set of 3D points */
export type VectorPoints3D = Point3D[];
/** A set of points */
export type VectorLine = Point[];
/** A set of 3D points */
export type VectorLine3D = Point3D[];
/** A set of lines */
export type VectorLines = VectorLine[];
/** A set of 3D lines */
export type VectorLines3D = VectorLine3D[];
/** A set of polygons */
export type VectorPoly = Point[][];
/** A set of 3D polygons */
export type VectorPoly3D = Point3D[][];
/** A set of multiple polygons */
export type VectorMultiPoly = Point[][][];
/** A set of multiple 3D polygons */
export type VectorMultiPoly3D = Point3D[][][];
/** An enumeration of all the geometry types */
export type VectorGeometry =
  | VectorPoints
  | VectorLines
  | VectorPoly
  | VectorMultiPoly
  | VectorPoints3D
  | VectorLines3D
  | VectorPoly3D
  | VectorMultiPoly3D;

/** All possible geometry coordinates */
export type VectorCoordinates =
  | Point[] // points
  | Point3D[] // 3D points
  | VectorLineWithOffset[] // lines
  | VectorLine3DWithOffset[] // 3D lines
  | VectorLineWithOffset[][] // polys
  | VectorLine3DWithOffset[][]; // 3D polys

/** BaseGeometry with MValues is the a generic geometry type that includes MValues */
export interface BaseGeometry<T = VectorFeatureType, C = VectorCoordinates, B = BBOX> {
  type: T;
  coordinates: C;
  bbox?: B;
}

/** PointsGeometry is a point array container */
export type PointsGeometry = BaseGeometry<1, Point[], BBox>;
/** LinesGeometry is a line array container */
export type LinesGeometry = BaseGeometry<2, VectorLineWithOffset[], BBox>;
/** PolysGeometry is a polygon array container */
export interface PolysGeometry extends BaseGeometry<3, VectorLineWithOffset[][], BBox> {
  indices: number[];
  tesselation: number[];
}
/** Points3DGeometry is a 3D point array container */
export type Points3DGeometry = BaseGeometry<4, Point3D[], BBox3D>;
/** Lines3DGeometry is a 3D line array container */
export type Lines3DGeometry = BaseGeometry<5, VectorLine3DWithOffset[], BBox3D>;
/** Polys3DGeometry is a 3D polygon array container */
export interface Polys3DGeometry extends BaseGeometry<6, VectorLine3DWithOffset[][], BBox3D> {
  indices: number[];
  tesselation: number[];
}

/** All possible geometry types used by vector geometry */
export type BaseVectorGeometry =
  | PointsGeometry
  | LinesGeometry
  | PolysGeometry
  | Points3DGeometry
  | Lines3DGeometry
  | Polys3DGeometry;

/** An external tile should implement this shape to be useable by the tile writers */
export interface S2JSONTile {
  extent: number;
  face: Face;
  zoom: number;
  i: number;
  j: number;
  transformed: boolean;
  layers: Record<string, S2JSONLayer>;
}

/** An external layer should implement this shape to be used by the tile writers */
export interface S2JSONLayer {
  extent: number;
  name: string;
  features: VectorFeatures[];
}
