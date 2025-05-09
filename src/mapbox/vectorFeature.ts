import type { PbfReader } from 'pbf-ts';
import type {
  BBox,
  BBox3D,
  VectorGeometryType,
  VectorMultiLineOffset,
  VectorMultiLineString,
  VectorMultiPoint,
  VectorMultiPolygon,
  VectorMultiPolygonOffset,
  VectorPolygonOffset,
} from 's2json-spec';
import type {
  MapboxProperties,
  MapboxValue,
  MapboxVectorFeatureType,
  Point,
  VectorGeometry,
  VectorLine,
  VectorPoly,
} from '../vectorTile.spec.js';

/**
 * Mapbox Vector Feature types are all bundled in one class
 * to make it easier to read. Primarily contains an id, properties, and geometry.
 * The now deprecated S2 model extends this class to include indices and tessellation data.
 */
export default class MapboxVectorFeature {
  id?: number;
  version = 5;
  properties: MapboxProperties = {};
  extent: number;
  type: MapboxVectorFeatureType = 1;
  isS2: boolean;
  #pbf: PbfReader;
  #indices = -1;
  #geometry = -1;
  #tessellation = -1;
  #keys: string[];
  #values: MapboxValue[];
  /**
   * @param pbf - the pbf protocol we are reading from
   * @param end - the position to stop at
   * @param isS2 - whether the layer is a deprecated S2 layer or Mapbox layer.
   * @param extent - the extent of the vector tile
   * @param version - the version of the vector tile. S2 is 5, Mapbox is 1
   * @param keys - the keys in the vector layer to pull from
   * @param values - the values in the vector layer to pull from
   */
  constructor(
    pbf: PbfReader,
    end: number,
    isS2: boolean,
    extent: number,
    version: number,
    keys: string[],
    values: MapboxValue[],
  ) {
    this.isS2 = isS2;
    this.extent = extent;
    this.version = version;
    this.#pbf = pbf;
    this.#keys = keys;
    this.#values = values;

    pbf.readFields(this.#readFeature, this, end);
  }

  /** @returns - the geometry type of the feature */
  geoType(): VectorGeometryType {
    const { type } = this;
    if (type === 1) return 'MultiPoint';
    else if (type === 2) return 'MultiLineString';
    else return 'MultiPolygon'; // 3, 4
  }

  /** @returns - true if the type of the feature is points */
  isPoints(): boolean {
    return this.type === 1;
  }

  /** @returns - true if the type of the feature is lines */
  isLines(): boolean {
    return this.type === 2;
  }

  /** @returns - true if the type of the feature is polygons */
  isPolygons(): boolean {
    return this.type === 3 || this.type === 4;
  }

  /** @returns - true if the type of the feature is points 3D */
  isPoints3D(): boolean {
    return false;
  }

  /** @returns - true if the type of the feature is lines 3D */
  isLines3D(): boolean {
    return false;
  }

  /** @returns - true if the type of the feature is polygons 3D */
  isPolygons3D(): boolean {
    return false;
  }

  /**
   * @param tag - the tag to know what kind of data to read
   * @param feature - the feature to mutate with the new data
   * @param pbf - the Protobuf object to read from
   */
  #readFeature(tag: number, feature: MapboxVectorFeature, pbf: PbfReader): void {
    // old spec
    if (feature.isS2) {
      if (tag === 15) feature.id = pbf.readVarint();
      else if (tag === 1) feature.#readTag(pbf, feature);
      else if (tag === 2) feature.type = pbf.readVarint() as MapboxVectorFeatureType;
      else if (tag === 3) feature.#geometry = pbf.pos;
      else if (tag === 4) feature.#indices = pbf.pos;
      else if (tag === 5) feature.#tessellation = pbf.pos;
    } else {
      if (tag === 1) feature.id = pbf.readVarint();
      else if (tag === 2) feature.#readTag(pbf, feature);
      else if (tag === 3) feature.type = pbf.readVarint() as MapboxVectorFeatureType;
      else if (tag === 4) feature.#geometry = pbf.pos;
      else if (tag === 5) feature.#indices = pbf.pos;
      else if (tag === 6) feature.#tessellation = pbf.pos;
    }
  }

  /**
   * @param pbf - the Protobuf object
   * @param feature - the feature to mutate relative to the tag.
   */
  #readTag(pbf: PbfReader, feature: MapboxVectorFeature): void {
    const end = pbf.readVarint() + pbf.pos;

    while (pbf.pos < end) {
      const key = feature.#keys[pbf.readVarint()];
      const value = feature.#values[pbf.readVarint()];

      feature.properties[key] = value;
    }
  }

  /** @returns - MapboxVectorTile's do not support m-values so we return false */
  get hasMValues(): boolean {
    return false;
  }

  /**
   * @returns - a default bbox. Since no bbox is present, the default is [0, 0, 0, 0]
   * also MapboxVectorTile's do not support 3D, so we only return a 2D bbox
   */
  bbox(): BBox | BBox3D {
    return [0, 0, 0, 0] as BBox;
  }

  /** @returns - regardless of the type, we return a flattend point array */
  loadPoints(): VectorMultiPoint | undefined {
    let res: VectorMultiPoint = [];
    const geometry = this.loadGeometry();
    if (this.type === 1) res = geometry as Point[];
    else if (this.type === 2) res = (geometry as Point[][]).flat();
    else if (this.type === 3 || this.type === 4) res = (geometry as Point[][][]).flat(2);

    return res;
  }

  /** @returns - an array of lines. The offsets will be set to 0 */
  loadLines(): [VectorMultiLineString, VectorMultiLineOffset] | undefined {
    if (this.type === 1) return;
    const geometry = this.loadGeometry();
    const outLines: VectorMultiLineString = [];
    const offsets: VectorMultiLineOffset = [];

    const lines = this.type === 2 ? (geometry as VectorLine[]) : (geometry as VectorPoly[]).flat();
    for (const line of lines) {
      outLines.push(line);
      offsets.push(0);
    }

    return [outLines, offsets];
  }

  /** @returns - an array of polys. The offsets will be set to 0 */
  loadPolys(): [VectorMultiPolygon, VectorMultiPolygonOffset] | undefined {
    if (this.type === 1 || this.type === 2) return;
    const geometry = this.loadGeometry();
    const polys: VectorMultiPolygon = [];
    const offsets: VectorMultiPolygonOffset = [];

    if (this.type === 3 || this.type === 4) {
      for (const poly of geometry as VectorPoly[]) {
        const polyOffset: VectorPolygonOffset = [];
        for (const _ of poly) polyOffset.push(0);
        polys.push(poly);
        offsets.push(polyOffset);
      }
    }

    return [polys, offsets];
  }

  /** @returns - [flattened geometry & tesslation if applicable, indices] */
  loadGeometryFlat(): [geometry: number[], indices: number[]] {
    this.#pbf.pos = this.#geometry;
    const multiplier = 1 / this.extent;

    const geometry = [];
    const end = this.#pbf.readVarint() + this.#pbf.pos;
    let cmd = 1;
    let length = 0;
    let x = 0;
    let y = 0;
    let startX: number | null = null;
    let startY: number | null = null;

    while (this.#pbf.pos < end) {
      if (length <= 0) {
        const cmdLen = this.#pbf.readVarint();
        cmd = cmdLen & 0x7;
        length = cmdLen >> 3;
      }

      length--;

      if (cmd === 1 || cmd === 2) {
        x += this.#pbf.readSVarint();
        y += this.#pbf.readSVarint();
        if (startX === null) startX = x * multiplier;
        if (startY === null) startY = y * multiplier;
        geometry.push(x * multiplier, y * multiplier);
      } else if (cmd === 7) {
        // ClosePath
        geometry.push(startX ?? 0, startY ?? 0);
        startX = null;
        startY = null;
      }
    }

    // if a poly, check if we should load indices
    const indices = this.readIndices();
    // if a poly, check if we should load tessellation
    if (this.#tessellation > 0) this.addTessellation(geometry, multiplier);

    return [geometry, indices];
  }

  /** @returns - vector geometry relative to feature type. */
  loadGeometry(): VectorGeometry {
    this.#pbf.pos = this.#geometry;

    const points: Point[] = [];
    let lines: Point[][] = [];
    let polys: Point[][][] = [];
    const end = this.#pbf.readVarint() + this.#pbf.pos;
    let cmd = 1;
    let length = 0;
    let x = 0;
    let y = 0;
    let input: Point[] = [];

    while (this.#pbf.pos < end) {
      if (length <= 0) {
        const cmdLen = this.#pbf.readVarint();
        cmd = cmdLen & 7;
        length = cmdLen >> 3;
      }

      length--;

      if (cmd === 1 || cmd === 2) {
        x += this.#pbf.readSVarint();
        y += this.#pbf.readSVarint();

        if (cmd === 1) {
          // moveTo
          if (input.length > 0) {
            if (this.type === 1) points.push(...input);
            else lines.push(input);
          }
          input = [];
        }
        input.push({ x, y });
      } else if (cmd === 7) {
        // ClosePath
        if (input.length > 0) {
          input.push({ x: input[0].x, y: input[0].y });
          lines.push(input);
          input = [];
        }
      } else if (cmd === 4) {
        // ClosePolygon
        if (input.length > 0) lines.push(input);
        polys.push(lines);
        lines = [];
        input = [];
      } else {
        throw new Error('unknown command ' + String(cmd));
      }
    }

    if (input.length > 0) {
      if (this.type === 1) points.push(...input);
      else lines.push(input);
    }

    // if type is polygon but we are using old mapbox spec, we might have a multipolygon
    if (this.type === 3 && !this.isS2) polys = classifyRings(lines);

    if (this.type === 1) return points;
    else if (polys.length > 0) return polys;
    return lines;
  }

  /** @returns - an array of indices for the geometry */
  readIndices(): number[] {
    if (this.#indices <= 0) return [];
    this.#pbf.pos = this.#indices;

    let curr = 0;
    const end = this.#pbf.readVarint() + this.#pbf.pos;
    // build indices
    const indices: number[] = [];
    while (this.#pbf.pos < end) {
      curr += this.#pbf.readSVarint();
      indices.push(curr);
    }

    return indices;
  }

  /**
   * Add tessellation data to the geometry
   * @param geometry - the geometry to add the tessellation data to
   * @param multiplier - the multiplier to apply the extent shift
   */
  addTessellation(geometry: number[], multiplier: number): void {
    if (this.#tessellation <= 0) return;
    this.#pbf.pos = this.#tessellation;
    const end = this.#pbf.readVarint() + this.#pbf.pos;
    let x = 0;
    let y = 0;
    while (this.#pbf.pos < end) {
      x += this.#pbf.readSVarint();
      y += this.#pbf.readSVarint();
      geometry.push(x * multiplier, y * multiplier);
    }
  }
}

/**
 * @param rings - input flattened rings that need to be classified
 * @returns - parsed polygons
 */
function classifyRings(rings: Point[][]): Point[][][] {
  if (rings.length <= 1) return [rings];

  const polygons: Point[][][] = [];
  let polygon: Point[][] | undefined;
  let ccw: boolean | undefined;

  for (let i = 0, rl = rings.length; i < rl; i++) {
    const area = signedArea(rings[i]);
    if (area === 0) continue;

    if (ccw === undefined) ccw = area < 0;

    if (ccw === area < 0) {
      if (polygon !== undefined) polygons.push(polygon);
      polygon = [rings[i]];
    } else {
      if (polygon === undefined) polygon = [];
      polygon.push(rings[i]);
    }
  }
  if (polygon !== undefined) polygons.push(polygon);

  return polygons;
}

/**
 * @param ring - linestring of points to check if it is ccw
 * @returns - true if the linestring is ccw
 */
function signedArea(ring: Point[]): number {
  let sum = 0;
  for (let i = 0, rl = ring.length, j = rl - 1, p1, p2; i < rl; j = i++) {
    p1 = ring[i];
    p2 = ring[j];
    sum += (p2.x - p1.x) * (p1.y + p2.y);
  }
  return sum;
}
