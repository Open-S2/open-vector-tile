import { Pbf as Protobuf } from '../src/pbf';
import { MapboxVectorFeature, MapboxVectorLayer, VectorTile } from '../src';
import { describe, expect, it, test } from 'bun:test';

describe('serialize and parse vector tile points', () => {
  const data = new Uint8Array([
    10, 63, 120, 1, 10, 6, 112, 111, 105, 110, 116, 115, 40, 128, 64, 18, 15, 120, 1, 10, 2, 0, 0,
    16, 1, 26, 5, 9, 186, 59, 154, 88, 18, 15, 120, 2, 10, 2, 0, 1, 16, 1, 26, 5, 9, 160, 80, 184,
    73, 26, 4, 110, 97, 109, 101, 34, 3, 10, 1, 97, 34, 3, 10, 1, 99,
  ]);

  // Parse
  it('should have proper metadata', () => {
    const tile = new VectorTile(data);

    expect(Object.keys(tile.layers)).toEqual(['points']);

    const layer = tile.layers.points;

    expect(layer.version).toBe(1);
    expect(layer.name).toBe('points');
    expect(layer.extent).toBe(8_192);
    expect(layer.length).toBe(2);
  });

  it('should be capable of parsing the points', () => {
    const tile = new VectorTile(data);
    const layer = tile.layers.points as MapboxVectorLayer;

    const point1 = layer.feature(0);
    const point2 = layer.feature(1);

    // IDs
    expect(point1.id).toBe(1);
    expect(point2.id).toBe(2);

    // Properties
    expect(point1.properties).toEqual({ name: 'a' });
    expect(point2.properties).toEqual({ name: 'c' });

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
  const data = new Uint8Array([
    10, 100, 120, 1, 10, 5, 108, 105, 110, 101, 115, 40, 128, 64, 18, 28, 120, 1, 10, 2, 0, 0, 16,
    2, 26, 18, 9, 160, 57, 160, 57, 26, 138, 6, 138, 6, 251, 29, 251, 29, 255, 3, 255, 3, 18, 42,
    120, 2, 10, 2, 1, 1, 16, 2, 26, 32, 9, 238, 41, 238, 41, 26, 184, 9, 184, 9, 159, 7, 159, 7,
    232, 8, 232, 8, 9, 204, 3, 204, 3, 18, 154, 4, 154, 4, 185, 6, 185, 6, 26, 1, 97, 26, 1, 98, 34,
    2, 40, 1, 34, 2, 40, 2,
  ]);

  // Parse
  it('should have proper metadata', () => {
    const tile = new VectorTile(data);

    expect(Object.keys(tile.layers)).toEqual(['lines']);

    const layer = tile.layers.lines;

    expect(layer.version).toBe(1);
    expect(layer.name).toBe('lines');
    expect(layer.extent).toBe(8_192);
    expect(layer.length).toBe(2);
  });

  it('should be capable of parsing the lines', () => {
    const tile = new VectorTile(data);
    const layer = tile.layers.lines as MapboxVectorLayer;

    const line1 = layer.feature(0);
    const line2 = layer.feature(1);

    // IDs
    expect(line1.id).toBe(1);
    expect(line2.id).toBe(2);

    // Properties
    expect(line1.properties).toEqual({ a: 1 });
    expect(line2.properties).toEqual({ b: 2 });

    // Geometry
    expect(line1.loadGeometry()).toEqual([
      [
        { x: 3664, y: 3664 },
        { x: 4053, y: 4053 },
        { x: 2135, y: 2135 },
        { x: 1879, y: 1879 },
      ],
    ]);
    expect(line2.loadGeometry()).toEqual([
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
        { x: 3664, y: 3664 },
        { x: 4053, y: 4053 },
        { x: 2135, y: 2135 },
        { x: 1879, y: 1879 },
      ],
    ]);
    expect(line2.loadGeometry()).toEqual([
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
  const data = new Uint8Array([
    10, 172, 1, 120, 1, 10, 8, 112, 111, 108, 121, 103, 111, 110, 115, 40, 128, 64, 18, 40, 120, 1,
    10, 2, 0, 0, 16, 3, 26, 30, 9, 138, 40, 138, 40, 26, 0, 0, 216, 20, 216, 20, 0, 0, 15, 9, 191,
    13, 191, 13, 26, 0, 0, 133, 4, 133, 4, 0, 0, 15, 18, 99, 120, 2, 10, 2, 1, 1, 16, 4, 26, 89, 9,
    236, 40, 236, 40, 34, 0, 0, 224, 7, 224, 7, 154, 34, 154, 34, 0, 0, 15, 9, 147, 28, 147, 28, 26,
    164, 17, 164, 17, 0, 0, 163, 17, 163, 17, 15, 9, 141, 8, 141, 8, 26, 190, 5, 190, 5, 0, 0, 189,
    5, 189, 5, 15, 12, 9, 154, 25, 154, 25, 34, 0, 0, 178, 17, 178, 17, 142, 4, 142, 4, 0, 0, 15, 9,
    217, 3, 217, 3, 26, 0, 0, 219, 2, 219, 2, 0, 0, 15, 12, 26, 1, 97, 26, 1, 98, 34, 2, 40, 1, 34,
    2, 40, 2,
  ]);

  // Step 3: Parse
  it('should have proper metadata', () => {
    const tile = new VectorTile(data);

    expect(Object.keys(tile.layers)).toEqual(['polygons']);

    const layer = tile.layers.polygons;

    expect(layer.version).toBe(1);
    expect(layer.name).toBe('polygons');
    expect(layer.extent).toBe(8_192);
    expect(layer.length).toBe(2);
  });

  it('should be capable of parsing the polygons', () => {
    const tile = new VectorTile(data);
    const layer = tile.layers.polygons as MapboxVectorLayer;

    const poly1 = layer.feature(0);
    const poly2 = layer.feature(1);

    // IDs
    expect(poly1.id).toBe(1);
    expect(poly2.id).toBe(2);

    // Properties
    expect(poly1.properties).toEqual({ a: 1 });
    expect(poly2.properties).toEqual({ b: 2 });

    // Geometry
    expect(poly1.loadGeometry()).toEqual([
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
    true,
    4096,
    5,
    [],
    [],
  );
  expect({ id, properties, extent, isS2, type, version }).toEqual({
    id: undefined,
    properties: {},
    extent: 4096,
    isS2: true,
    type: 1,
    version: 5,
  });
});
