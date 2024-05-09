import type Protobuf from "../pbf";
import type {
  Value,
  Properties,
  Point,
  VectorFeatureType,
  VectorGeometry,
  BBox,
  BBox3D,
  VectorLine,
} from "../vectorTile.spec";

export default class VectorTile {
  id?: number;
  version = 5;
  properties: Properties = {};
  extent: number;
  type: VectorFeatureType = 1;
  isS2: boolean;
  #pbf: Protobuf;
  #indices = -1;
  #geometry = -1;
  #tesselation = -1;
  #keys: string[];
  #values: Value[];
  constructor(
    pbf: Protobuf,
    end: number,
    isS2: boolean,
    extent: number,
    version: number,
    keys: string[],
    values: Value[],
  ) {
    this.isS2 = isS2;
    this.extent = extent;
    this.version = version;
    this.#pbf = pbf;
    this.#keys = keys;
    this.#values = values;

    pbf.readFields(this.#readFeature, this, end);
  }

  #readFeature(tag: number, feature: VectorTile, pbf: Protobuf): void {
    // old spec
    if (feature.isS2) {
      if (tag === 15) feature.id = pbf.readVarint();
      else if (tag === 1) feature.#readTag(pbf, feature);
      else if (tag === 2) feature.type = pbf.readVarint() as VectorFeatureType;
      else if (tag === 3) feature.#geometry = pbf.pos;
      else if (tag === 4) feature.#indices = pbf.pos;
      else if (tag === 5) feature.#tesselation = pbf.pos;
    } else {
      if (tag === 1) feature.id = pbf.readVarint();
      else if (tag === 2) feature.#readTag(pbf, feature);
      else if (tag === 3) feature.type = pbf.readVarint() as VectorFeatureType;
      else if (tag === 4) feature.#geometry = pbf.pos;
      else if (tag === 5) feature.#indices = pbf.pos;
      else if (tag === 6) feature.#tesselation = pbf.pos;
    }
  }

  #readTag(pbf: Protobuf, feature: VectorTile): void {
    const end = pbf.readVarint() + pbf.pos;

    while (pbf.pos < end) {
      const key = feature.#keys[pbf.readVarint()];
      const value = feature.#values[pbf.readVarint()];

      feature.properties[key] = value;
    }
  }

  hasMvalues(): boolean {
    return false;
  }

  bbox(): BBox | BBox3D {
    return [0, 0, 0, 0] as BBox;
  }

  loadGeometryFlat(): [number[] | VectorGeometry, number[]] {
    if (!this.isS2) return [this.loadGeometry(), [] as number[]];
    this.#pbf.pos = this.#geometry;
    const { extent } = this;
    const multiplier = 1 / extent;

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
    // if a poly, check if we should load tesselation
    if (this.#tesselation > 0) this.addTesselation(geometry, multiplier);

    return [geometry, indices];
  }

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
        throw new Error("unknown command " + String(cmd));
      }
    }

    if (input.length > 0) {
      if (this.type === 1) points.push(...input);
      else lines.push(input);
    }

    // if type is polygon but we are using version 1, we might have a multipolygon
    if (this.type === 3 && !this.isS2) {
      polys = classifyRings(lines);
    }

    if (this.type === 1) return points;
    else if (polys.length > 0) return polys;
    return lines;
  }

  // TODO
  loadLines(): Array<{ offset: number; line: VectorLine }> {
    return [];
  }

  readIndices(): number[] {
    if (this.#indices === 0) return [];
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

  addTesselation(geometry: number[], multiplier: number): void {
    if (this.#tesselation <= 0) return;
    this.#pbf.pos = this.#tesselation;
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

function signedArea(ring: Point[]): number {
  let sum = 0;
  for (let i = 0, rl = ring.length, j = rl - 1, p1, p2; i < rl; j = i++) {
    p1 = ring[i];
    p2 = ring[j];
    sum += (p2.x - p1.x) * (p1.y + p2.y);
  }
  return sum;
}
