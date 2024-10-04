import { BaseVectorTile } from '../../src/base';
import { VectorTile } from '../../src';
import { describe, expect, it } from 'bun:test';

import type { BaseVectorFeature } from '../../src/base';
import type { Tile as S2JSONTile } from 's2-tools';

describe('BaseVectorTile', () => {
  const layer = new BaseVectorTile();

  it('should be an instance of BaseVectorTile', () => {
    expect(layer).toBeInstanceOf(BaseVectorTile);
  });

  it('should parse a mapbox tile', async () => {
    const data = await Bun.file(`${__dirname}/../fixtures/lots-of-tags.vector.pbf`).arrayBuffer();
    const uint8 = new Uint8Array(data, 0, data.byteLength);
    const tile = new VectorTile(uint8);
    const parsedTile = BaseVectorTile.fromVectorTile(tile);
    expect(parsedTile).toBeInstanceOf(BaseVectorTile);
    expect(Object.keys(parsedTile.layers)).toEqual(['stuttgart-rails']);
    const rails = parsedTile.layers['stuttgart-rails'];
    expect(rails.extent).toEqual(4_096);
    expect(rails.name).toEqual('stuttgart-rails');
    expect(rails.length).toEqual(137);
    expect(rails.feature(0).id).toEqual(22);
    expect(rails.version).toEqual(1);
  });
});

it('should parse a S2JSONTile', () => {
  const s2Tile = {
    transformed: true,
    layers: {
      point: {
        name: 'point',
        features: [
          {
            id: 0,
            type: 'S2Feature',
            face: 1,
            properties: {},
            geometry: {
              type: 'Point',
              bbox: [0, 0, 1, 1],
              is3D: false,
              coordinates: { x: 0.5, y: 0.25 },
            },
          },
        ],
      },
      point3D: {
        name: 'point3D',
        features: [
          {
            id: 0,
            type: 'S2Feature',
            face: 1,
            properties: {},
            geometry: {
              type: 'Point',
              bbox: [0, 0, 1, 1, 0.1, 0.1],
              is3D: true,
              coordinates: { x: 0.5, y: 0.25, z: 0.1 },
            },
          },
        ],
      },
      multiPoints: {
        name: 'multiPoints',
        features: [
          {
            id: 1,
            type: 'VectorFeature',
            face: 0,
            properties: {},
            geometry: {
              type: 'MultiPoint',
              bbox: [0.5, 0.5, 0.75, 1],
              is3D: false,
              coordinates: [
                { x: 0.5, y: 0.25 },
                { x: 0.75, y: 0.5 },
              ],
            },
          },
        ],
      },
      multiPoints3D: {
        name: 'multiPoints3D',
        features: [
          {
            id: 1,
            type: 'VectorFeature',
            face: 0,
            properties: {},
            geometry: {
              type: 'MultiPoint',
              bbox: [0.5, 0.5, 0.75, 1, 0, 1],
              is3D: true,
              coordinates: [
                { x: 0.5, y: 0.25, z: 0 },
                { x: 0.75, y: 0.5, z: 1 },
              ],
            },
          },
        ],
      },
      lineString: {
        name: 'lineString',
        features: [
          {
            id: 1,
            type: 'VectorFeature',
            face: 0,
            properties: {},
            geometry: {
              type: 'LineString',
              bbox: [0.5, 0.5, 0.75, 1],
              is3D: false,
              coordinates: [
                { x: 0.5, y: 0.25 },
                { x: 0.75, y: 0.5 },
              ],
            },
          },
        ],
      },
      lineString3D: {
        name: 'lineString3D',
        features: [
          {
            id: 1,
            type: 'VectorFeature',
            face: 0,
            properties: {},
            geometry: {
              type: 'LineString',
              bbox: [0.5, 0.5, 0.75, 1, 0, 1],
              is3D: true,
              coordinates: [
                { x: 0.5, y: 0.25, z: 0 },
                { x: 0.75, y: 0.5, z: 1 },
              ],
            },
          },
        ],
      },
      multiLineString: {
        name: 'multiLineString',
        features: [
          {
            id: 1,
            type: 'VectorFeature',
            face: 0,
            properties: {},
            geometry: {
              type: 'MultiLineString',
              bbox: [0.5, 0.5, 0.75, 1],
              is3D: false,
              coordinates: [
                [
                  { x: 0.5, y: 0.25 },
                  { x: 0.75, y: 0.5 },
                ],
                [
                  { x: 0.75, y: 0.5 },
                  { x: 0, y: 1 },
                ],
              ],
            },
          },
        ],
      },
      multiLineString3D: {
        name: 'multiLineString3D',
        features: [
          {
            id: 1,
            type: 'VectorFeature',
            face: 0,
            properties: {},
            geometry: {
              type: 'MultiLineString',
              bbox: [0.5, 0.5, 0.75, 1, 0, 1],
              is3D: true,
              coordinates: [
                [
                  { x: 0.5, y: 0.25, z: 0 },
                  { x: 0.75, y: 0.5, z: 0.25 },
                ],
                [
                  { x: 0.75, y: 0.5, z: 0.25 },
                  { x: 0, y: 1, z: 0.5 },
                ],
              ],
            },
          },
        ],
      },
      polygon: {
        name: 'polygon',
        features: [
          {
            id: 1,
            type: 'VectorFeature',
            face: 0,
            properties: {},
            geometry: {
              type: 'Polygon',
              bbox: [0.5, 0.5, 0.75, 1],
              is3D: false,
              coordinates: [
                [
                  { x: 0.5, y: 0.25 },
                  { x: 0.75, y: 0.5 },
                ],
                [
                  { x: 0.75, y: 0.5 },
                  { x: 0, y: 1 },
                ],
              ],
            },
          },
        ],
      },
      polygon3D: {
        name: 'polygon3D',
        features: [
          {
            id: 1,
            type: 'VectorFeature',
            face: 0,
            properties: {},
            geometry: {
              type: 'Polygon',
              bbox: [0.5, 0.5, 0.75, 1, 0, 1],
              is3D: true,
              coordinates: [
                [
                  { x: 0.5, y: 0.25, z: 0 },
                  { x: 0.75, y: 0.5, z: 0.25 },
                ],
                [
                  { x: 0.75, y: 0.5, z: 0.25 },
                  { x: 0, y: 1, z: 0.5 },
                ],
              ],
            },
          },
        ],
      },
      multiPolygon: {
        name: 'multiPolygon',
        features: [
          {
            id: 1,
            type: 'VectorFeature',
            face: 0,
            properties: {},
            geometry: {
              type: 'MultiPolygon',
              bbox: [0.5, 0.5, 0.75, 1],
              is3D: false,
              coordinates: [
                [
                  [
                    { x: 0.5, y: 0.25 },
                    { x: 0.75, y: 0.5 },
                  ],
                  [
                    { x: 0.75, y: 0.5 },
                    { x: 0, y: 1 },
                  ],
                ],
              ],
            },
          },
        ],
      },
      multiPolygon3D: {
        name: 'multiPolygon3D',
        features: [
          {
            id: 1,
            type: 'VectorFeature',
            face: 0,
            properties: {},
            geometry: {
              type: 'MultiPolygon',
              bbox: [0.5, 0.5, 0.75, 1, 0, 1],
              is3D: true,
              coordinates: [
                [
                  [
                    { x: 0.5, y: 0.25, z: 0 },
                    { x: 0.75, y: 0.5, z: 0.25 },
                  ],
                  [
                    { x: 0.75, y: 0.5, z: 0.25 },
                    { x: 0, y: 1, z: 0.5 },
                  ],
                ],
              ],
            },
          },
        ],
      },
    },
  } as unknown as S2JSONTile;

  const parsedTile = BaseVectorTile.fromS2JSONTile(s2Tile, {});
  expect(parsedTile).toBeInstanceOf(BaseVectorTile);
  expect(Object.keys(parsedTile.layers)).toEqual([
    'point',
    'point3D',
    'multiPoints',
    'multiPoints3D',
    'lineString',
    'lineString3D',
    'multiLineString',
    'multiLineString3D',
    'polygon',
    'polygon3D',
    'multiPolygon',
    'multiPolygon3D',
  ]);

  const point = parsedTile.layers['point'];
  expect(point.extent).toEqual(4_096);
  expect(point.name).toEqual('point');
  expect(point.length).toEqual(1);
  expect(point.version).toEqual(1);

  expect(point.feature(0)).toEqual({
    bbox: [0, 0, 1, 1],
    geometry: [
      {
        x: 2_048,
        y: 1_024,
      },
    ],
    id: 0,
    properties: {},
    type: 1,
  } as unknown as BaseVectorFeature);

  const point3D = parsedTile.layers['point3D'];
  expect(point3D.feature(0)).toEqual({
    bbox: [0, 0, 1, 1, 0.1, 0.1],
    geometry: [
      {
        x: 2_048,
        y: 1_024,
        z: 410,
      },
    ],
    id: 0,
    properties: {},
    type: 4,
  } as unknown as BaseVectorFeature);

  const multiPoints = parsedTile.layers['multiPoints'];
  expect(multiPoints.feature(0)).toEqual({
    bbox: [0.5, 0.5, 0.75, 1],
    geometry: [
      {
        x: 2_048,
        y: 1_024,
      },
      {
        x: 3_072,
        y: 2_048,
      },
    ],
    id: 1,
    properties: {},
    type: 1,
  } as unknown as BaseVectorFeature);

  const multiPoints3D = parsedTile.layers['multiPoints3D'];
  expect(multiPoints3D.feature(0)).toEqual({
    bbox: [0.5, 0.5, 0.75, 1, 0, 1],
    geometry: [
      {
        x: 2_048,
        y: 1_024,
        z: 0,
      },
      {
        x: 3_072,
        y: 2_048,
        z: 4096,
      },
    ],
    id: 1,
    properties: {},
    type: 4,
  } as unknown as BaseVectorFeature);

  const lineString = parsedTile.layers['lineString'];
  expect(lineString.feature(0)).toEqual({
    bbox: [0.5, 0.5, 0.75, 1],
    geometry: [
      {
        geometry: [
          {
            x: 2048,
            y: 1024,
          },
          {
            x: 3072,
            y: 2048,
          },
        ],
        offset: 0,
      },
    ],
    id: 1,
    properties: {},
    type: 2,
  } as unknown as BaseVectorFeature);

  const lineString3D = parsedTile.layers['lineString3D'];
  expect(lineString3D.feature(0)).toEqual({
    bbox: [0.5, 0.5, 0.75, 1, 0, 1],
    geometry: [
      {
        geometry: [
          {
            x: 2048,
            y: 1024,
            z: 0,
          },
          {
            x: 3072,
            y: 2048,
            z: 4096,
          },
        ],
        offset: 0,
      },
    ],
    id: 1,
    properties: {},
    type: 5,
  } as unknown as BaseVectorFeature);

  const multiLineString = parsedTile.layers['multiLineString'];
  expect(multiLineString.feature(0)).toEqual({
    bbox: [0.5, 0.5, 0.75, 1],
    geometry: [
      {
        geometry: [
          {
            x: 2048,
            y: 1024,
          },
          {
            x: 3072,
            y: 2048,
          },
        ],
        offset: 0,
      },
      {
        geometry: [
          {
            x: 3072,
            y: 2048,
          },
          {
            x: 0,
            y: 4096,
          },
        ],
        offset: 0,
      },
    ],
    id: 1,
    properties: {},
    type: 2,
  } as unknown as BaseVectorFeature);

  const multiLineString3D = parsedTile.layers['multiLineString3D'];
  expect(multiLineString3D.feature(0)).toEqual({
    bbox: [0.5, 0.5, 0.75, 1, 0, 1],
    geometry: [
      {
        geometry: [
          {
            x: 2048,
            y: 1024,
            z: 0,
          },
          {
            x: 3072,
            y: 2048,
            z: 1024,
          },
        ],
        offset: 0,
      },
      {
        geometry: [
          {
            x: 3072,
            y: 2048,
            z: 1024,
          },
          {
            x: 0,
            y: 4096,
            z: 2048,
          },
        ],
        offset: 0,
      },
    ],
    id: 1,
    properties: {},
    type: 5,
  } as unknown as BaseVectorFeature);

  const polygon = parsedTile.layers['polygon'];
  expect(polygon.feature(0)).toEqual({
    bbox: [0.5, 0.5, 0.75, 1],
    geometry: [
      [
        {
          geometry: [
            {
              x: 2048,
              y: 1024,
            },
            {
              x: 3072,
              y: 2048,
            },
          ],
          offset: 0,
        },
        {
          geometry: [
            {
              x: 3072,
              y: 2048,
            },
            {
              x: 0,
              y: 4096,
            },
          ],
          offset: 0,
        },
      ],
    ],
    id: 1,
    indices: [],
    properties: {},
    tesselation: [],
    type: 3,
  } as unknown as BaseVectorFeature);

  const polygon3D = parsedTile.layers['polygon3D'];
  expect(polygon3D.feature(0)).toEqual({
    bbox: [0.5, 0.5, 0.75, 1, 0, 1],
    geometry: [
      [
        {
          geometry: [
            {
              x: 2048,
              y: 1024,
              z: 0,
            },
            {
              x: 3072,
              y: 2048,
              z: 1024,
            },
          ],
          offset: 0,
        },
        {
          geometry: [
            {
              x: 3072,
              y: 2048,
              z: 1024,
            },
            {
              x: 0,
              y: 4096,
              z: 2048,
            },
          ],
          offset: 0,
        },
      ],
    ],
    id: 1,
    indices: [],
    properties: {},
    tesselation: [],
    type: 6,
  } as unknown as BaseVectorFeature);

  const multiPolygon = parsedTile.layers['multiPolygon'];
  expect(multiPolygon.feature(0)).toEqual({
    bbox: [0.5, 0.5, 0.75, 1],
    geometry: [
      [
        {
          geometry: [
            {
              x: 2048,
              y: 1024,
            },
            {
              x: 3072,
              y: 2048,
            },
          ],
          offset: 0,
        },
        {
          geometry: [
            {
              x: 3072,
              y: 2048,
            },
            {
              x: 0,
              y: 4096,
            },
          ],
          offset: 0,
        },
      ],
    ],
    id: 1,
    indices: [],
    properties: {},
    tesselation: [],
    type: 3,
  } as unknown as BaseVectorFeature);

  const multiPolygon3D = parsedTile.layers['multiPolygon3D'];
  expect(multiPolygon3D.feature(0)).toEqual({
    bbox: [0.5, 0.5, 0.75, 1, 0, 1],
    geometry: [
      [
        {
          geometry: [
            {
              x: 2048,
              y: 1024,
              z: 0,
            },
            {
              x: 3072,
              y: 2048,
              z: 1024,
            },
          ],
          offset: 0,
        },
        {
          geometry: [
            {
              x: 3072,
              y: 2048,
              z: 1024,
            },
            {
              x: 0,
              y: 4096,
              z: 2048,
            },
          ],
          offset: 0,
        },
      ],
    ],
    id: 1,
    indices: [],
    properties: {},
    tesselation: [],
    type: 6,
  } as unknown as BaseVectorFeature);
});
