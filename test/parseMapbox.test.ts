import MapboxProtobuf from 'pbf';
import { VectorTile as MapboxVectorTile } from '@mapbox/vector-tile';
import { Pbf as Protobuf } from '../src/pbf';
import { VectorGeometry } from '../src/vectorTile.spec';
import fs from 'fs';
import path from 'path';
import { MapboxVectorFeature, MapboxVectorLayer, VectorTile } from '../src';
import { describe, expect, it, test } from 'bun:test';

describe('parsing vector tiles', () => {
  const data = fs.readFileSync(
    path.join(__dirname, 'fixtures/14-8801-5371.vector.pbf'),
  ) as Uint8Array;

  it('should have all layers', () => {
    const tile = new VectorTile(data);

    expect(Object.keys(tile.layers)).toEqual([
      'landuse',
      'waterway',
      'water',
      'barrier_line',
      'building',
      'landuse_overlay',
      'tunnel',
      'road',
      'bridge',
      'place_label',
      'water_label',
      'poi_label',
      'road_label',
      'waterway_label',
    ]);
  });

  it('should extract the tags of a feature', () => {
    const tile = new VectorTile(data);
    const poi_label = tile.layers.poi_label as MapboxVectorLayer;
    const road = tile.layers.road as MapboxVectorLayer;

    expect(poi_label.length).toEqual(558);

    const park = poi_label.feature(11);

    // expect(park.bbox()).toEqual([ 3898, 1731, 3898, 1731 ]);

    expect(function () {
      const park = poi_label.feature(1e9);
      park.loadGeometry();
    }).toThrowError('feature index out of bounds');

    expect(park.id).toEqual(3000003150561);

    expect(park.properties.name).toEqual('Mauerpark');
    expect(park.properties.type).toEqual('Park');

    // Check point geometry
    expect(park.loadGeometry()).toEqual([{ x: 3898, y: 1731 }]);

    // Check line geometry
    expect(road.feature(656).loadGeometry()).toEqual([
      [
        { x: 1988, y: 306 },
        { x: 1808, y: 321 },
        { x: 1506, y: 347 },
      ],
    ]);
  });

  it('changing first point of a polygon should not change last point', () => {
    const tile = new VectorTile(data);
    const buildingLayer = tile.layers.building as MapboxVectorLayer;

    const building = buildingLayer.feature(0).loadGeometry();
    expect(building).toEqual([
      [
        [
          { x: 2039, y: -32 },
          { x: 2035, y: -31 },
          { x: 2032, y: -31 },
          { x: 2032, y: -32 },
          { x: 2039, y: -32 },
        ],
      ],
    ]);
  });
});

test('VectorLayer', () => {
  const { version, name, extent, isS2, length, features } = new MapboxVectorLayer(
    new Protobuf(Buffer.alloc(0)),
    0,
  );
  expect({ version, name, extent, isS2, length, features }).toEqual({
    version: 5,
    name: 'default',
    extent: 4096,
    isS2: false,
    length: 0,
    features: [],
  });
});

test('VectorFeature', () => {
  const { id, properties, extent, isS2, type, version } = new MapboxVectorFeature(
    new Protobuf(Buffer.alloc(0)),
    0,
    false,
    4096,
    1,
    [],
    [],
  );
  expect({ id, properties, extent, isS2, type, version }).toEqual({
    id: undefined,
    properties: {},
    extent: 4096,
    isS2: false,
    type: 1,
    version: 1,
  });
});

test('https://github.com/mapbox/vector-tile-js/issues/15', () => {
  const data = fs.readFileSync(path.join(__dirname, 'fixtures/lots-of-tags.vector.pbf'));
  const tile = new VectorTile(data);
  const feature = tile.layers['stuttgart-rails'].feature(0);
  expect(feature.id).toEqual(22);
  expect(feature.type).toEqual(2);
  expect(feature.extent).toEqual(4096);
});

test('https://github.com/mapbox/mapbox-gl-js/issues/1019', () => {
  const data = fs.readFileSync(path.join(__dirname, 'fixtures/12-1143-1497.vector.pbf'));
  const tile = new VectorTile(data);
  const waterLayer = tile.layers.water as MapboxVectorLayer;
  expect(waterLayer.feature(1).loadGeometry()).toHaveLength(1);
});

test('https://github.com/mapbox/vector-tile-js/issues/60', () => {
  const data = fs.readFileSync(path.join(__dirname, 'fixtures/multipolygon-with-closepath.pbf'));
  const tile = new VectorTile(data);
  for (const id in tile.layers) {
    const layer = tile.layers[id] as MapboxVectorLayer;
    for (let i = 0; i < layer.length; i++) {
      layer.feature(i).loadGeometry();
    }
  }
});

describe('parsing multi polygons are the same', () => {
  const data = fs.readFileSync(path.join(__dirname, 'fixtures/1-1-0.vector.pbf')) as Uint8Array;

  it('should have all layers', () => {
    const mTile = new MapboxVectorTile(new MapboxProtobuf(data));
    const s2Tile = new VectorTile(data);

    const { water: mWater } = mTile.layers;
    const { water: s2Water } = s2Tile.layers;

    // regular polygons
    for (let i = 0; i < mWater.length; i++) {
      if (i === 1) continue;
      const mFeature = mWater.feature(i);
      const mGeometry = mFeature.loadGeometry();
      const mFlatGeometry = [];
      mergePolygons(mFlatGeometry, mGeometry);

      const s2Feature = (s2Water as MapboxVectorLayer).feature(i);
      const s2Geometry = s2Feature.loadGeometry();

      expect([mFlatGeometry] as VectorGeometry).toEqual(s2Geometry);
    }
  });
});

/**
 * @param out - the output array
 * @param input - the input array
 */
// @ts-expect-error this is just for testing purposes
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergePolygons(out: any[], input: any[]): any[] {
  for (const arr of input) {
    if (!Array.isArray(arr)) {
      out.push({ x: arr.x, y: arr.y });
    } else {
      const outArr = [];
      mergePolygons(outArr, arr);
      out.push(outArr);
    }
  }
}
