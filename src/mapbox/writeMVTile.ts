import { BaseVectorPolysFeature } from '../base';
import { OVectorLayer } from '../open/vectorLayer';
import { Pbf as Protobuf } from 'pbf-ts';
import { commandEncode, zigzag } from '../util';

import type { VectorTile } from '../vectorTile';
import type { BaseVectorFeature, BaseVectorLayer, BaseVectorTile } from '../base';
import type {
  MapboxValue,
  Point,
  VectorLines,
  VectorMultiPoly,
  VectorPoints,
  VectorPoly,
} from '../vectorTile.spec';
import type { MapboxVectorFeature, MapboxVectorLayer } from '.';

/** A storage structure to manage deduplication of keys and values in each layer */
interface Context {
  keys: string[];
  values: MapboxValue[];
  keycache: Record<string, number>;
  valuecache: Record<string, number>;
}

/** A method of passing both the context and feature to a writer callback */
interface ContextWithFeature {
  context: Context;
  feature: BaseVectorFeature | MapboxVectorFeature;
  mapbox: boolean;
}

/** A method of passing both the layer and mapbox support to a writer callback */
interface ContextWithLayer {
  layer: BaseVectorLayer | MapboxVectorLayer;
  mapbox: boolean;
}

/**
 * Write old schema Mapbox vector tiles with extra features (backwards compatible)
 * @param tile - the tile to serialize. Either a BaseVectorTile or a MapboxVectorTile
 * @param mapboxSupport - support old school mapbox tooling
 * @returns - a Uint8Array of the tile
 */
export default function writeMVTile(
  tile: BaseVectorTile | VectorTile,
  mapboxSupport = false,
): Uint8Array {
  const out = new Protobuf();
  writeTile(tile, out, mapboxSupport);
  return out.commit();
}

/**
 * @param tile - the tile to serialize. Either a BaseVectorTile or a MapboxVectorTile
 * @param pbf - the Protobuf object to write to
 * @param mapbox - support old school mapbox tooling
 */
function writeTile(tile: BaseVectorTile | VectorTile, pbf: Protobuf, mapbox: boolean): void {
  for (const key in tile.layers) {
    const layer = tile.layers[key];
    if (layer instanceof OVectorLayer) continue;
    pbf.writeMessage(mapbox ? 3 : 1, writeLayer, { layer, mapbox });
  }
}

/**
 * @param layerContext - the layer to serialize. Either a BaseVectorLayer or a MapboxVectorLayer
 * @param pbf - the Protobuf object to write to
 */
function writeLayer(layerContext: ContextWithLayer, pbf: Protobuf): void {
  const { layer, mapbox } = layerContext;
  pbf.writeVarintField(15, mapbox ? 1 : 5);
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
    pbf.writeMessage(2, writeFeature, { context, feature, mapbox });
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
  const { feature, mapbox } = contextWF;
  // fix BaseVectorPolysFeature to work with S2
  if (feature instanceof BaseVectorPolysFeature) feature.type = 4;
  // if id write it
  if (typeof feature.id === 'number') pbf.writeVarintField(mapbox ? 1 : 15, feature.id);
  // properties
  pbf.writeMessage(mapbox ? 2 : 1, writeProperties, contextWF);
  let featureType = feature.type;
  if (mapbox && featureType === 4) featureType = 3;
  pbf.writeVarintField(mapbox ? 3 : 2, featureType);
  // geoemtry, indices
  pbf.writeMessage(mapbox ? 4 : 3, writeGeometry, contextWF);
  if ('indices' in feature && feature.indices.length > 0) {
    pbf.writeMessage(mapbox ? 5 : 4, writeIndices, feature.indices);
  }
  if ('tessellation' in feature && feature.tessellation.length > 0) {
    pbf.writeMessage(mapbox ? 6 : 5, writeTessellation, feature.tessellation);
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

    let value = properties[key] as MapboxValue;
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

/**
 * just an array of points that are used inside an extent x extent tile block
 * @param geometry - the geometry to write
 * @param pbf - the Protobuf object to write to
 */
function writeTessellation(geometry: Point[], pbf: Protobuf): void {
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
 * @param featureContext - the feature to use for the geometry to write
 * @param pbf - the Protobuf object to write to
 */
function writeGeometry(featureContext: ContextWithFeature, pbf: Protobuf): void {
  const { feature, mapbox } = featureContext;
  const { type } = feature;
  const geometry = feature.loadGeometry();

  if (type === 1) writePointGeometry(geometry as VectorPoints, pbf);
  else if (type === 4) writeMultiPolyGeometry(geometry as VectorMultiPoly, pbf, mapbox);
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
 * @param mapbox - support old school mapbox tooling
 */
function writeMultiPolyGeometry(geometry: VectorMultiPoly, pbf: Protobuf, mapbox: boolean): void {
  let x = 0;
  let y = 0;

  for (const poly of geometry) {
    for (const ring of poly) {
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
    pbf.writeVarint(commandEncode(mapbox ? 7 : 4, 1)); // ClosePolygon (Mapbox does not support so close path if not supported)
  }
}

/**
 * @param value - the value to write (can be string, number, null, or boolean)
 * @param pbf - the Protobuf object to write to
 */
function writeValue(value: MapboxValue, pbf: Protobuf): void {
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
