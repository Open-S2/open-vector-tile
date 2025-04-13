/* eslint-disable @typescript-eslint/no-misused-promises */
import MapboxProtobuf from 'pbf';
import { VectorTile as MapboxVectorTile } from '@mapbox/vector-tile';
import { Pbf as Protobuf } from 'pbf-ts';
import { VectorTile } from '../src';
import { MapboxVectorFeature, MapboxVectorLayer } from '../src/mapbox';
import { describe, expect, it, test } from 'bun:test';

import type { VectorGeometry } from '../src/vectorTile.spec';

describe('parsing vector tiles', async (): Promise<void> => {
  const data = await Bun.file(`${__dirname}/fixtures/14-8801-5371.vector.pbf`).arrayBuffer();
  const uint8 = new Uint8Array(data, 0, data.byteLength);
  const tile = new VectorTile(uint8);

  it('should have all layers', () => {
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

  it('shoulnd contain mValues and have an empty bbox', () => {
    const poi_label = tile.layers.poi_label;
    const feature = poi_label.feature(11);
    expect(feature.geoType()).toEqual('MultiPoint');
    expect(feature.isPoints()).toBeTrue();
    expect(feature.isLines()).toBeFalse();
    expect(feature.isPolygons()).toBeFalse();
    expect(feature.isPoints3D()).toBeFalse();
    expect(feature.isLines3D()).toBeFalse();
    expect(feature.isPolygons3D()).toBeFalse();

    expect(feature.hasMValues).toEqual(false);
    expect(feature.bbox()).toEqual([0, 0, 0, 0]);
  });

  it('should extract the tags of a feature', () => {
    const poi_label = tile.layers.poi_label;
    const road = tile.layers.road;

    expect(poi_label.length).toEqual(558);

    const park = poi_label.feature(11);

    expect(() => {
      const park = poi_label.feature(1e9);
      park.loadGeometry();
    }).toThrowError('feature index out of bounds');

    expect(park.id).toEqual(3000003150561);

    expect(park.properties.name).toEqual('Mauerpark');
    expect(park.properties.type).toEqual('Park');

    // Check point geometry
    expect(park.loadGeometry()).toEqual([{ x: 3898, y: 1731 }]);
    expect(park.loadLines()).toBeUndefined();
    expect(park.loadPoints()).toEqual([{ x: 3898, y: 1731 }]);

    // Check line geometry
    const feature_656 = road.feature(656);
    expect(feature_656.geoType()).toEqual('MultiLineString');
    expect(feature_656.loadGeometry()).toEqual([
      [
        { x: 1988, y: 306 },
        { x: 1808, y: 321 },
        { x: 1506, y: 347 },
      ],
    ]);
    expect(feature_656.loadPolys()).toBeUndefined();
    expect(feature_656.loadLines()).toEqual([
      [
        [
          { x: 1988, y: 306 },
          { x: 1808, y: 321 },
          { x: 1506, y: 347 },
        ],
      ],
      [0],
    ]);
    expect(feature_656.loadPoints()).toEqual([
      { x: 1988, y: 306 },
      { x: 1808, y: 321 },
      { x: 1506, y: 347 },
    ]);
  });

  it('changing first point of a polygon should not change last point', () => {
    const buildingLayer = tile.layers.building;

    const building = buildingLayer.feature(0);
    expect(building.geoType()).toEqual('MultiPolygon');
    expect(building.loadGeometry()).toEqual([
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
    expect(building.loadPolys()).toEqual([
      [
        [
          [
            {
              x: 2039,
              y: -32,
            },
            {
              x: 2035,
              y: -31,
            },
            {
              x: 2032,
              y: -31,
            },
            {
              x: 2032,
              y: -32,
            },
            {
              x: 2039,
              y: -32,
            },
          ],
        ],
      ],
      [[0]],
    ]);
    expect(building.loadLines()).toEqual([
      [
        [
          {
            x: 2039,
            y: -32,
          },
          {
            x: 2035,
            y: -31,
          },
          {
            x: 2032,
            y: -31,
          },
          {
            x: 2032,
            y: -32,
          },
          {
            x: 2039,
            y: -32,
          },
        ],
      ],
      [0],
    ]);
    expect(building.loadPoints()).toEqual([
      {
        x: 2039,
        y: -32,
      },
      {
        x: 2035,
        y: -31,
      },
      {
        x: 2032,
        y: -31,
      },
      {
        x: 2032,
        y: -32,
      },
      {
        x: 2039,
        y: -32,
      },
    ]);
  });
});

test('VectorLayer', () => {
  const { version, name, extent, isS2, length } = new MapboxVectorLayer(
    new Protobuf(Buffer.alloc(0)),
    0,
  );
  expect({ version, name, extent, isS2, length }).toEqual({
    version: 5,
    name: 'default',
    extent: 4096,
    isS2: false,
    length: 0,
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

test('https://github.com/mapbox/vector-tile-js/issues/15', async () => {
  const data = await Bun.file(`${__dirname}/fixtures/lots-of-tags.vector.pbf`).arrayBuffer();
  const uint8 = new Uint8Array(data, 0, data.byteLength);
  const tile = new VectorTile(uint8);
  const feature = tile.layers['stuttgart-rails'].feature(0);
  expect(feature.id).toEqual(22);
  expect(feature.type).toEqual(2);
  expect(feature.extent).toEqual(4096);
});

test('https://github.com/mapbox/mapbox-gl-js/issues/1019', async () => {
  const data = await Bun.file(`${__dirname}/fixtures/12-1143-1497.vector.pbf`).arrayBuffer();
  const uint8 = new Uint8Array(data, 0, data.byteLength);
  const tile = new VectorTile(uint8);
  const waterLayer = tile.layers.water;
  const waterFeature = waterLayer.feature(1);
  const waterGeometry = waterFeature.loadGeometry();
  expect(waterGeometry).toHaveLength(1);
  expect(waterLayer.feature(1).loadGeometry()).toHaveLength(1);
});

test('https://github.com/mapbox/vector-tile-js/issues/60', async () => {
  const data = await Bun.file(
    `${__dirname}/fixtures/multipolygon-with-closepath.pbf`,
  ).arrayBuffer();
  const uint8 = new Uint8Array(data, 0, data.byteLength);
  const tile = new VectorTile(uint8);
  for (const id in tile.layers) {
    const layer = tile.layers[id];
    for (let i = 0; i < layer.length; i++) {
      layer.feature(i).loadGeometry();
    }
  }
});

describe('parsing multi polygons are the same', async () => {
  const data = await Bun.file(`${__dirname}/fixtures/1-1-0.vector.pbf`).arrayBuffer();
  const uint8 = new Uint8Array(data, 0, data.byteLength);

  it('should have all layers', () => {
    const mTile = new MapboxVectorTile(new MapboxProtobuf(uint8));
    const s2Tile = new VectorTile(uint8);

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
