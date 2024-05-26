import { BaseVectorPolysFeature } from '../baseVectorTile';
import { OVectorLayer } from '../openVectorTile/vectorLayer';
import { Pbf as Protobuf } from '../pbf';
import { commandEncode, zigzag } from '../util';

import type { VectorTile } from '../vectorTile';
import type { BaseVectorFeature, BaseVectorLayer, BaseVectorTile } from '../baseVectorTile';
import type { MapboxVectorFeature, MapboxVectorLayer } from '../mapboxVectorTile';
import type {
  Point,
  Value,
  VectorLines,
  VectorMultiPoly,
  VectorPoints,
  VectorPoly,
} from '../vectorTile.spec';

// NOTE: Deprecated tool. Rely upon `writeOVTile` for future use.

/**
 * A storage structure to manage deduplication of keys and values in each layer
 */
interface Context {
  keys: string[];
  values: Value[];
  keycache: Record<string, number>;
  valuecache: Record<string, number>;
}

/**
 * A method of passing both the context and feature to a writer callback
 */
interface ContextWithFeature {
  context: Context;
  feature: BaseVectorFeature | MapboxVectorFeature;
}

/**
 * @deprecated - use `writeOVTile` instead
 * @param tile - the tile to serialize. Either a BaseVectorTile or a MapboxVectorTile
 * @returns - a Uint8Array of the tile
 */
export default function serialize(tile: BaseVectorTile | VectorTile): Uint8Array {
  const out = new Protobuf();
  writeTile(tile, out);
  return out.commit();
}

/**
 * @param tile - the tile to serialize. Either a BaseVectorTile or a MapboxVectorTile
 * @param pbf - the Protobuf object to write to
 */
function writeTile(tile: BaseVectorTile | VectorTile, pbf: Protobuf): void {
  for (const key in tile.layers) {
    const layer = tile.layers[key];
    if (layer instanceof OVectorLayer) continue;
    pbf.writeMessage(3, writeLayer, layer);
  }
}

/**
 * @param layer - the layer to serialize. Either a BaseVectorLayer or a MapboxVectorLayer
 * @param pbf - the Protobuf object to write to
 */
function writeLayer(layer: BaseVectorLayer | MapboxVectorLayer, pbf: Protobuf): void {
  pbf.writeVarintField(15, layer.version ?? 1);
  pbf.writeStringField(1, layer.name ?? '');
  pbf.writeVarintField(5, layer.extent ?? 4096);

  let i;
  const context: Context = {
    keys: [],
    values: [],
    keycache: {},
    valuecache: {},
  };

  const ll = layer.length;
  for (i = 0; i < ll; i++) {
    const feature = layer.feature(i);
    pbf.writeMessage(2, writeFeature, { context, feature });
  }

  const keys = context.keys;
  for (i = 0; i < keys.length; i++) {
    pbf.writeStringField(3, keys[i]);
  }

  const values = context.values;
  for (i = 0; i < values.length; i++) {
    pbf.writeMessage(4, writeValue, values[i]);
  }
}

/**
 * @param contextWF - the context and feature to write
 * @param pbf - the Protobuf object to write to
 */
function writeFeature(contextWF: ContextWithFeature, pbf: Protobuf): void {
  const { feature } = contextWF;
  // fix BaseVectorPolysFeature to work with S2
  if (feature instanceof BaseVectorPolysFeature) {
    feature.type = 4;
  }
  // if id write it
  if (typeof feature.id === 'number') pbf.writeVarintField(1, feature.id);
  // properties
  pbf.writeMessage(2, writeProperties, contextWF);
  pbf.writeVarintField(3, feature.type);
  // geoemtry, indices
  pbf.writeMessage(4, writeGeometry, feature);
  if ('indices' in feature && feature.indices.length) {
    pbf.writeMessage(5, writeIndices, feature.indices);
  }
  if ('tesselation' in feature && feature.tesselation.length) {
    pbf.writeMessage(6, writeTesselation, feature.tesselation);
  }
}

/**
 * @param contextWF - the context and feature to write
 * @param pbf - the Protobuf object to write to
 */
function writeProperties(contextWF: ContextWithFeature, pbf: Protobuf): void {
  const { feature, context } = contextWF;
  const { keys, values, keycache, valuecache } = context;
  const { properties } = feature;

  for (const key in properties) {
    let keyIndex = keycache[key];
    if (typeof keyIndex === 'undefined') {
      keys.push(key);
      keyIndex = keys.length - 1;
      keycache[key] = keyIndex;
    }
    pbf.writeVarint(keyIndex);

    let value = properties[key] as Value;
    const type = typeof value;
    if (type !== 'string' && type !== 'boolean' && type !== 'number') {
      value = JSON.stringify(value);
    }
    const valueKey = type + ':' + String(value);
    let valueIndex = valuecache[valueKey];
    if (typeof valueIndex === 'undefined') {
      values.push(value);
      valueIndex = values.length - 1;
      valuecache[valueKey] = valueIndex;
    }
    pbf.writeVarint(valueIndex);
  }
}

/**
 * @param indices - the indices of the geometry
 * @param pbf - the Protobuf object to write to
 */
function writeIndices(indices: number[], pbf: Protobuf): void {
  let curr = 0;
  for (const index of indices) {
    const dCurr = index - curr;
    pbf.writeVarint(zigzag(dCurr));
    curr += dCurr;
  }
}

// just an array of points that are used inside an extent x extent tile block
/**
 * @param geometry - the geometry to write
 * @param pbf - the Protobuf object to write to
 */
function writeTesselation(geometry: Point[], pbf: Protobuf): void {
  let x = 0;
  let y = 0;
  for (const point of geometry) {
    const dx = point.x - x;
    const dy = point.y - y;
    pbf.writeVarint(zigzag(dx));
    pbf.writeVarint(zigzag(dy));
    x += dx;
    y += dy;
  }
}

/**
 * @param feature - the feature to use for the geometry to write
 * @param pbf - the Protobuf object to write to
 */
function writeGeometry(feature: BaseVectorFeature | MapboxVectorFeature, pbf: Protobuf): void {
  const { type } = feature;
  const geometry = feature.loadGeometry();

  if (type === 1) writePointGeometry(geometry as VectorPoints, pbf);
  else if (type === 4) writeMultiPolyGeometry(geometry as VectorMultiPoly, pbf);
  else writeLinesGeometry(geometry as VectorLines | VectorPoly, type === 3, pbf);
}

/**
 * @param geometry - the geometry to encode the points from
 * @param pbf - the Protobuf object to write to
 */
function writePointGeometry(geometry: VectorPoints, pbf: Protobuf): void {
  let x = 0;
  let y = 0;

  for (const point of geometry) {
    // move
    pbf.writeVarint(commandEncode(1, 1)); // moveto
    // store
    const dx = point.x - x;
    const dy = point.y - y;
    pbf.writeVarint(zigzag(dx));
    pbf.writeVarint(zigzag(dy));
    // update position
    x += dx;
    y += dy;
  }
}

/**
 * @param geometry - the geometry to encode
 * @param polygon - true if the geometry is a polygon, otherwise its a set of lines
 * @param pbf - the Protobuf object to write to
 */
function writeLinesGeometry(
  geometry: VectorLines | VectorPoly,
  polygon: boolean,
  pbf: Protobuf,
): void {
  let x = 0;
  let y = 0;

  for (let r = 0, gl = geometry.length; r < gl; r++) {
    const ring = geometry[r];
    pbf.writeVarint(commandEncode(1, 1)); // moveto
    // do not write polygon closing path as lineto
    const lineCount = polygon ? ring.length - 1 : ring.length;
    for (let i = 0; i < lineCount; i++) {
      if (i === 1) pbf.writeVarint(commandEncode(2, lineCount - 1)); // lineto

      const dx = ring[i].x - x;
      const dy = ring[i].y - y;
      pbf.writeVarint(zigzag(dx));
      pbf.writeVarint(zigzag(dy));
      x += dx;
      y += dy;
    }
    if (polygon) pbf.writeVarint(commandEncode(7, 1)); // closepath
  }
}

/**
 * @param geometry - the geometry to encode
 * @param pbf - the Protobuf object to write to
 */
function writeMultiPolyGeometry(geometry: VectorMultiPoly, pbf: Protobuf): void {
  let x = 0;
  let y = 0;

  for (let p = 0, pl = geometry.length; p < pl; p++) {
    const poly = geometry[p];
    for (let r = 0, rl = poly.length; r < rl; r++) {
      const ring = poly[r];
      pbf.writeVarint(commandEncode(1, 1)); // moveto
      const lineCount = ring.length - 1;
      for (let i = 0; i < lineCount; i++) {
        if (i === 1) pbf.writeVarint(commandEncode(2, lineCount - 1)); // lineto

        const dx = ring[i].x - x;
        const dy = ring[i].y - y;
        pbf.writeVarint(zigzag(dx));
        pbf.writeVarint(zigzag(dy));
        x += dx;
        y += dy;
      }
      pbf.writeVarint(commandEncode(7, 1)); // ClosePath
    }
    pbf.writeVarint(commandEncode(4, 1)); // ClosePolygon
  }
}

/**
 * @param value - the value to write (can be string, number, null, or boolean)
 * @param pbf - the Protobuf object to write to
 */
function writeValue(value: Value, pbf: Protobuf): void {
  if (typeof value === 'string') {
    pbf.writeStringField(1, value);
  } else if (typeof value === 'boolean') {
    pbf.writeBooleanField(7, value);
  } else if (typeof value === 'number') {
    if (value % 1 !== 0) {
      pbf.writeDoubleField(3, value);
    } else if (value < 0) {
      pbf.writeSVarintField(6, value);
    } else {
      pbf.writeVarintField(5, value);
    }
  }
}
