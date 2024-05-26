import { Pbf } from '../src/pbf';
import { VectorTile } from '../src';
import {
  BaseVectorLayer,
  BaseVectorLine,
  BaseVectorLinesFeature,
  BaseVectorPointsFeature,
  BaseVectorPolysFeature,
  BaseVectorTile,
} from '../src/baseVectorTile';
import { MapboxVectorFeature, MapboxVectorLayer, serializeS2 } from '../src/mapboxVectorTile';
import { describe, expect, it, test } from 'bun:test';

describe('serialize and parse vector tile points', () => {
  // Step 1: Create
  const point1 = new BaseVectorPointsFeature([{ x: 3805, y: 5645 }], { name: 'a' }, 1);

  const point2 = new BaseVectorPointsFeature([{ x: 5136, y: 4700 }], { name: [0, 1, 2, 3] }, 2);
  const layer = new BaseVectorLayer(5, 'points', 8_192, [point1, point2]);
  const tile = new BaseVectorTile({ points: layer });

  // Step 2: Serialize
  const data = serializeS2(tile);

  // Step 3: Parse
  it('should have proper metadata', () => {
    const tile = new VectorTile(data);

    expect(Object.keys(tile.layers)).toEqual(['points']);

    const layer = tile.layers.points;

    expect(layer.version).toBe(5);
    expect(layer.name).toBe('points');
    expect(layer.extent).toBe(8_192);
    expect(layer.length).toBe(2);
  });

  it('should be capable of parsing the points', () => {
    const tile = new VectorTile(data);
    const layer = tile.layers.points;

    const point1 = layer.feature(0);
    const point2 = layer.feature(1);

    // IDs
    expect(point1.id).toBe(1);
    expect(point2.id).toBe(2);

    // Properties
    expect(point1.properties).toEqual({ name: 'a' });
    expect(point2.properties).toEqual({ name: '[0,1,2,3]' });

    // Geometry
    expect(point1.loadGeometry()).toEqual([{ x: 3805, y: 5645 }]);
    expect(point2.loadGeometry()).toEqual([{ x: 5136, y: 4700 }]);

    // Geomtery v1:
    layer.version = 1;
    expect(point1.loadGeometry()).toEqual([{ x: 3805, y: 5645 }]);
    expect(point2.loadGeometry()).toEqual([{ x: 5136, y: 4700 }]);
  });
});

describe('serialize and parse vector tile lines', () => {
  // Step 1: Create
  const line1 = new BaseVectorLinesFeature(
    [
      new BaseVectorLine([
        { x: 3664, y: 3664 },
        { x: 4053, y: 4053 },
        { x: 2135, y: 2135 },
        { x: 1879, y: 1879 },
      ]),
    ],
    undefined,
    { name: 2.2 },
    100,
  );
  const line2 = new BaseVectorLinesFeature(
    [
      new BaseVectorLine([
        { x: 2679, y: 2679 },
        { x: 3283, y: 3283 },
        { x: 2819, y: 2819 },
        { x: 3383, y: 3383 },
      ]),
      new BaseVectorLine([
        { x: 3613, y: 3613 },
        { x: 3882, y: 3882 },
        { x: 3469, y: 3469 },
      ]),
    ],
    undefined,
    { name: true },
    200,
  );
  const layer = new BaseVectorLayer(2, 'lines', 8_192, [line1, line2]);
  const tile = new BaseVectorTile({ lines: layer });

  // Step 2: Serialize
  const data = serializeS2(tile);

  // Step 3: Parse
  it('should have proper metadata', () => {
    const tile = new VectorTile(data);

    expect(Object.keys(tile.layers)).toEqual(['lines']);

    const layer = tile.layers.lines;

    expect(layer.version).toBe(2);
    expect(layer.name).toBe('lines');
    expect(layer.extent).toBe(8_192);
    expect(layer.length).toBe(2);
  });

  it('should be capable of parsing the lines', () => {
    const tile = new VectorTile(data);
    const layer = tile.layers.lines;

    const line1 = layer.feature(0);
    const line2 = layer.feature(1);

    // IDs
    expect(line1.id).toBe(100);
    expect(line2.id).toBe(200);

    // Properties
    expect(line1.properties).toEqual({ name: 2.2 });
    expect(line2.properties).toEqual({ name: true });

    // Geometry
    expect(line1.loadGeometry()).toEqual([
      [
        // [3664, 3664], [4053, 4053], [2135, 2135], [1879, 1879]
        { x: 3664, y: 3664 },
        { x: 4053, y: 4053 },
        { x: 2135, y: 2135 },
        { x: 1879, y: 1879 },
      ],
    ]);
    expect(line2.loadGeometry()).toEqual([
      // [[2679, 2679], [3283, 3283], [2819, 2819], [3383, 3383]],
      // [[3613, 3613], [3882, 3882], [3469, 3469]]
      [
        { x: 2679, y: 2679 },
        { x: 3283, y: 3283 },
        { x: 2819, y: 2819 },
        { x: 3383, y: 3383 },
      ],
      [
        { x: 3613, y: 3613 },
        { x: 3882, y: 3882 },
        { x: 3469, y: 3469 },
      ],
    ]);

    // Geomtery v1:
    layer.version = 1;
    expect(line1.loadGeometry()).toEqual([
      [
        // [3664, 3664], [4053, 4053], [2135, 2135], [1879, 1879]
        { x: 3664, y: 3664 },
        { x: 4053, y: 4053 },
        { x: 2135, y: 2135 },
        { x: 1879, y: 1879 },
      ],
    ]);
    expect(line2.loadGeometry()).toEqual([
      // [[2679, 2679], [3283, 3283], [2819, 2819], [3383, 3383]],
      // [[3613, 3613], [3882, 3882], [3469, 3469]]
      [
        { x: 2679, y: 2679 },
        { x: 3283, y: 3283 },
        { x: 2819, y: 2819 },
        { x: 3383, y: 3383 },
      ],
      [
        { x: 3613, y: 3613 },
        { x: 3882, y: 3882 },
        { x: 3469, y: 3469 },
      ],
    ]);
  });
});

describe('serialize and parse vector tile polygons', () => {
  // Step 1: Create
  const poly1 = new BaseVectorPolysFeature(
    [
      [
        new BaseVectorLine([
          { x: 2565, y: 2565 },
          { x: 2565, y: 2565 },
          { x: 3889, y: 3889 },
          { x: 3889, y: 3889 },
          { x: 2565, y: 2565 },
        ]),
        new BaseVectorLine([
          { x: 3025, y: 3025 },
          { x: 3025, y: 3025 },
          { x: 2766, y: 2766 },
          { x: 2766, y: 2766 },
          { x: 3025, y: 3025 },
        ]),
      ],
    ],
    undefined,
    undefined,
    undefined,
    { a: -100, b: 500 },
    0,
  );
  const polys2 = new BaseVectorPolysFeature(
    [
      [
        new BaseVectorLine([
          { x: 2614, y: 2614 },
          { x: 2614, y: 2614 },
          { x: 3110, y: 3110 },
          { x: 5299, y: 5299 },
          { x: 5299, y: 5299 },
          { x: 2614, y: 2614 },
        ]),
        new BaseVectorLine([
          { x: 3497, y: 3497 },
          { x: 4603, y: 4603 },
          { x: 4603, y: 4603 },
          { x: 3497, y: 3497 },
          { x: 3497, y: 3497 },
        ]),
        new BaseVectorLine([
          { x: 2978, y: 2978 },
          { x: 3329, y: 3329 },
          { x: 3329, y: 3329 },
          { x: 2978, y: 2978 },
          { x: 2978, y: 2978 },
        ]),
      ],
      [
        new BaseVectorLine([
          { x: 4591, y: 4591 },
          { x: 4591, y: 4591 },
          { x: 5704, y: 5704 },
          { x: 5967, y: 5967 },
          { x: 5967, y: 5967 },
          { x: 4591, y: 4591 },
        ]),
        new BaseVectorLine([
          { x: 5730, y: 5730 },
          { x: 5730, y: 5730 },
          { x: 5556, y: 5556 },
          { x: 5556, y: 5556 },
          { x: 5730, y: 5730 },
        ]),
      ],
    ],
    [0, 1, 2],
    [1, 2, 3, 4, 5, 6, 7, 8],
    undefined,
    { name: 'c' },
    1234,
  );
  const layer = new BaseVectorLayer(5, 'polys', 8_192, [poly1, polys2]);
  const tile = new BaseVectorTile({ polys: layer });

  // Step 2: Serialize
  const data = serializeS2(tile);

  // Step 3: Parse
  it('should have proper metadata', () => {
    const tile = new VectorTile(data);

    expect(Object.keys(tile.layers)).toEqual(['polys']);

    const layer = tile.layers.polys;

    expect(layer.version).toBe(5);
    expect(layer.name).toBe('polys');
    expect(layer.extent).toBe(8_192);
    expect(layer.length).toBe(2);
  });

  it('should be capable of parsing the polys', () => {
    const tile = new VectorTile(data);
    const layer = tile.layers.polys;

    const poly1 = layer.feature(0);
    const poly2 = layer.feature(1);

    // IDs
    expect(poly1.id).toBe(0);
    expect(poly2.id).toBe(1234);

    // Properties
    expect(poly1.properties).toEqual({ a: -100, b: 500 });
    expect(poly2.properties).toEqual({ name: 'c' });

    // Geometry
    expect(poly1.loadGeometry()).toEqual([
      [
        [
          { x: 2565, y: 2565 },
          { x: 2565, y: 2565 },
          { x: 3889, y: 3889 },
          { x: 3889, y: 3889 },
          { x: 2565, y: 2565 },
        ],
        [
          { x: 3025, y: 3025 },
          { x: 3025, y: 3025 },
          { x: 2766, y: 2766 },
          { x: 2766, y: 2766 },
          { x: 3025, y: 3025 },
        ],
      ],
    ]);
    expect(poly1.loadGeometryFlat()).toEqual([
      [
        [
          [
            {
              x: 2565,
              y: 2565,
            },
            {
              x: 2565,
              y: 2565,
            },
            {
              x: 3889,
              y: 3889,
            },
            {
              x: 3889,
              y: 3889,
            },
            {
              x: 2565,
              y: 2565,
            },
          ],
          [
            {
              x: 3025,
              y: 3025,
            },
            {
              x: 3025,
              y: 3025,
            },
            {
              x: 2766,
              y: 2766,
            },
            {
              x: 2766,
              y: 2766,
            },
            {
              x: 3025,
              y: 3025,
            },
          ],
        ],
      ],
      [],
    ]);
    expect(poly2.loadGeometry()).toEqual([
      [
        [
          { x: 2614, y: 2614 },
          { x: 2614, y: 2614 },
          { x: 3110, y: 3110 },
          { x: 5299, y: 5299 },
          { x: 5299, y: 5299 },
          { x: 2614, y: 2614 },
        ],
        [
          { x: 3497, y: 3497 },
          { x: 4603, y: 4603 },
          { x: 4603, y: 4603 },
          { x: 3497, y: 3497 },
          { x: 3497, y: 3497 },
        ],
        [
          { x: 2978, y: 2978 },
          { x: 3329, y: 3329 },
          { x: 3329, y: 3329 },
          { x: 2978, y: 2978 },
          { x: 2978, y: 2978 },
        ],
      ],
      [
        [
          { x: 4591, y: 4591 },
          { x: 4591, y: 4591 },
          { x: 5704, y: 5704 },
          { x: 5967, y: 5967 },
          { x: 5967, y: 5967 },
          { x: 4591, y: 4591 },
        ],
        [
          { x: 5730, y: 5730 },
          { x: 5730, y: 5730 },
          { x: 5556, y: 5556 },
          { x: 5556, y: 5556 },
          { x: 5730, y: 5730 },
        ],
      ],
    ]);

    // Geomtery v1
    layer.version = 1;
    expect(poly1.loadGeometry()).toEqual([
      [
        [
          { x: 2565, y: 2565 },
          { x: 2565, y: 2565 },
          { x: 3889, y: 3889 },
          { x: 3889, y: 3889 },
          { x: 2565, y: 2565 },
        ],
        [
          { x: 3025, y: 3025 },
          { x: 3025, y: 3025 },
          { x: 2766, y: 2766 },
          { x: 2766, y: 2766 },
          { x: 3025, y: 3025 },
        ],
      ],
    ]);
    expect(poly2.loadGeometry()).toEqual([
      [
        [
          { x: 2614, y: 2614 },
          { x: 2614, y: 2614 },
          { x: 3110, y: 3110 },
          { x: 5299, y: 5299 },
          { x: 5299, y: 5299 },
          { x: 2614, y: 2614 },
        ],
        [
          { x: 3497, y: 3497 },
          { x: 4603, y: 4603 },
          { x: 4603, y: 4603 },
          { x: 3497, y: 3497 },
          { x: 3497, y: 3497 },
        ],
        [
          { x: 2978, y: 2978 },
          { x: 3329, y: 3329 },
          { x: 3329, y: 3329 },
          { x: 2978, y: 2978 },
          { x: 2978, y: 2978 },
        ],
      ],
      [
        [
          { x: 4591, y: 4591 },
          { x: 4591, y: 4591 },
          { x: 5704, y: 5704 },
          { x: 5967, y: 5967 },
          { x: 5967, y: 5967 },
          { x: 4591, y: 4591 },
        ],
        [
          { x: 5730, y: 5730 },
          { x: 5730, y: 5730 },
          { x: 5556, y: 5556 },
          { x: 5556, y: 5556 },
          { x: 5730, y: 5730 },
        ],
      ],
    ]);

    // Geomtery with tesselation and indices
    const tess: number[] = [];
    poly2.addTesselation(tess, 1);
    expect(tess).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(poly2.readIndices()).toEqual([0, 1, 2]);
  });
});

test('VectorLayer', () => {
  const { version, name, extent, isS2, length } = new MapboxVectorLayer(
    new Pbf(Buffer.alloc(0)),
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
    new Pbf(Buffer.alloc(0)),
    0,
    false,
    4096,
    5,
    [],
    [],
  );
  expect({ id, properties, extent, isS2, type, version }).toEqual({
    id: undefined,
    properties: {},
    extent: 4096,
    isS2: false,
    type: 1,
    version: 5,
  });
});
