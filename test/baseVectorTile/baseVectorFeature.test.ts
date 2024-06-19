import { Pbf } from '../../src/pbf';
import {
  BaseVectorLine,
  BaseVectorLine3D,
  BaseVectorLines3DFeature,
  BaseVectorLinesFeature,
  BaseVectorPoint3DFeature,
  BaseVectorPointsFeature,
  BaseVectorPolys3DFeature,
  BaseVectorPolysFeature,
  decodeOffset,
  encodeOffset,
} from '../../src/base';
import { ColumnCacheReader, ColumnCacheWriter } from '../../src/open/columnCache';
import { describe, expect, it } from 'bun:test';

describe('encodeOffset and decodeOffset', () => {
  it('offsets are encoded and decoded correctly', () => {
    expect(encodeOffset(1.234)).toBe(1234);
    expect(decodeOffset(1234)).toBe(1.234);
  });
});

describe('BaseVectorPointsFeature', () => {
  const point = new BaseVectorPointsFeature([{ x: 0, y: 0 }], { name: 'a' }, 1);
  const point2 = new BaseVectorPointsFeature(
    [
      { x: 1_234, y: 5_678 },
      { x: 2, y: 3 },
    ],
    { name: 'b' },
    2,
    [1, 2, 3, 4],
  );

  it('geometry', () => {
    expect(point.geometry).toEqual([{ x: 0, y: 0 }]);
    expect(point2.geometry).toEqual([
      { x: 1_234, y: 5_678 },
      { x: 2, y: 3 },
    ]);
  });

  it('has ids', () => {
    expect(point.id).toBe(1);
    expect(point2.id).toBe(2);
  });

  it('hasOffsets', () => {
    expect(point.hasOffsets).toBe(false);
    expect(point2.hasOffsets).toBe(false);
  });

  it('hasMValues', () => {
    expect(point.hasMValues).toBe(false);
    expect(point2.hasMValues).toBe(false);
  });

  it('hasBBox', () => {
    expect(point.hasBBox).toBe(false);
    expect(point2.hasBBox).toBe(true);
  });

  it('has properties', () => {
    expect(point.properties).toEqual({ name: 'a' });
    expect(point2.properties).toEqual({ name: 'b' });
  });

  it('adds geometry to cache', () => {
    const pbf = new Pbf();
    const cache = new ColumnCacheWriter();
    // we only add the second because the first is a single point and doesn't need to be added to cache
    expect(point2.addGeometryToCache(cache));
    pbf.writeMessage(5, ColumnCacheWriter.write, cache);
    const rawData = pbf.commit();
    expect(rawData).toEqual(new Uint8Array([42, 10, 42, 8, 176, 205, 133, 71, 247, 198, 133, 71]));

    const parsePBF = new Pbf(rawData);
    parsePBF.readTag(); // 5
    const cache2 = new ColumnCacheReader(parsePBF, parsePBF.readVarint() + parsePBF.pos);
    expect(cache2[5]).toEqual([{ pos: 3 }]);
  });
});

describe('BaseVectorPoint3DFeature', () => {
  const point = new BaseVectorPoint3DFeature([{ x: 0, y: 0, z: 1 }], { name: 'a' }, 1);
  const point2 = new BaseVectorPoint3DFeature(
    [
      { x: 1_234, y: 5_678, z: 2_419 },
      { x: 2, y: 3, z: 4 },
    ],
    { name: 'b' },
    2,
    [4, 3, 2, 1, -2.2, -3.3],
  );

  it('geometry', () => {
    expect(point.geometry).toEqual([{ x: 0, y: 0, z: 1 }]);
    expect(point2.geometry).toEqual([
      { x: 1_234, y: 5_678, z: 2_419 },
      { x: 2, y: 3, z: 4 },
    ]);
    expect(point2.loadGeometry()).toEqual([
      { x: 1_234, y: 5_678, z: 2_419 },
      { x: 2, y: 3, z: 4 },
    ]);
  });

  it('has ids', () => {
    expect(point.id).toBe(1);
    expect(point2.id).toBe(2);
  });

  it('hasOffsets', () => {
    expect(point.hasOffsets).toBe(false);
    expect(point2.hasOffsets).toBe(false);
  });

  it('hasMValues', () => {
    expect(point.hasMValues).toBe(false);
    expect(point2.hasMValues).toBe(false);
  });

  it('hasBBox', () => {
    expect(point.hasBBox).toBe(false);
    expect(point2.hasBBox).toBe(true);
  });

  it('has properties', () => {
    expect(point.properties).toEqual({ name: 'a' });
    expect(point2.properties).toEqual({ name: 'b' });
  });

  it('adds geometry to cache', () => {
    const pbf = new Pbf();
    const cache = new ColumnCacheWriter();
    // we only add the second because the first is a single point and doesn't need to be added to cache
    expect(point2.addGeometryToCache(cache));
    pbf.writeMessage(5, ColumnCacheWriter.write, cache);
    const rawData = pbf.commit();
    expect(rawData).toEqual(
      new Uint8Array([42, 14, 50, 12, 224, 203, 234, 141, 234, 40, 207, 247, 225, 141, 234, 40]),
    );

    const parsePBF = new Pbf(rawData);
    parsePBF.readTag(); // 5
    const cache2 = new ColumnCacheReader(parsePBF, parsePBF.readVarint() + parsePBF.pos);
    expect(cache2[6]).toEqual([{ pos: 3 }]);
  });
});

describe('BaseVectorLinesFeature', () => {
  const lineA = new BaseVectorLinesFeature(
    [
      new BaseVectorLine([
        { x: 0, y: 1 },
        { x: 2, y: 3 },
      ]),
    ],
    undefined,
    { name: 'a' },
    1,
  );
  const lineB = new BaseVectorLinesFeature(
    [
      new BaseVectorLine(
        [
          { x: -200, y: 5_123, m: { width: 2 } },
          { x: 1_234, y: 5_678, m: { width: 3 } },
        ],
        3.3,
      ),
      new BaseVectorLine(
        [
          { x: 1_234, y: 5_678, m: { width: 4 } },
          { x: 2, y: 3, m: { width: 5 } },
        ],
        4.4,
      ),
    ],
    [0, 1, 500, 600],
    { name: 'b' },
    100,
  );

  it('geometry', () => {
    expect(lineA.geometry).toEqual([
      new BaseVectorLine([
        { x: 0, y: 1 },
        { x: 2, y: 3 },
      ]),
    ]);
    expect(lineB.geometry).toEqual([
      new BaseVectorLine(
        [
          { x: -200, y: 5_123, m: { width: 2 } },
          { x: 1_234, y: 5_678, m: { width: 3 } },
        ],
        3.3,
      ),
      new BaseVectorLine(
        [
          { x: 1_234, y: 5_678, m: { width: 4 } },
          { x: 2, y: 3, m: { width: 5 } },
        ],
        4.4,
      ),
    ]);
  });

  it('has ids', () => {
    expect(lineA.id).toBe(1);
    expect(lineB.id).toBe(100);
  });

  it('hasOffsets', () => {
    expect(lineA.hasOffsets).toBe(false);
    expect(lineB.hasOffsets).toBe(true);
  });

  it('hasMValues', () => {
    expect(lineA.hasMValues).toBe(false);
    expect(lineB.hasMValues).toBe(true);
  });

  it('hasBBox', () => {
    expect(lineA.hasBBox).toBe(false);
    expect(lineB.hasBBox).toBe(true);
  });

  it('has properties', () => {
    expect(lineA.properties).toEqual({ name: 'a' });
    expect(lineB.properties).toEqual({ name: 'b' });
  });

  it('adds geometry and mvalues to cache', () => {
    const pbf = new Pbf();
    const cache = new ColumnCacheWriter();
    // we only add the second because the first is a single point and doesn't need to be added to cache
    expect(lineB.addGeometryToCache(cache, { width: 'u64' }));
    pbf.writeMessage(5, ColumnCacheWriter.write, cache);
    const rawData = pbf.commit();
    expect(rawData).toEqual(
      new Uint8Array([
        42, 57, 8, 2, 8, 3, 8, 4, 8, 5, 42, 8, 253, 128, 133, 68, 184, 206, 148, 3, 42, 8, 176, 205,
        133, 71, 247, 198, 133, 71, 58, 15, 4, 196, 51, 199, 51, 4, 3, 2, 222, 68, 221, 68, 2, 0, 2,
        66, 1, 0, 66, 1, 1, 66, 1, 2, 66, 1, 3,
      ]),
    );

    const parsePBF = new Pbf(rawData);
    parsePBF.readTag(); // 5
  });
});

describe('BaseVectorLines3DFeature', () => {
  const lineA = new BaseVectorLines3DFeature(
    [
      new BaseVectorLine3D([
        { x: 0, y: 1, z: 2 },
        { x: 2, y: 3, z: 4 },
      ]),
    ],
    undefined,
    { name: 'a' },
    1,
  );
  const lineB = new BaseVectorLines3DFeature(
    [
      new BaseVectorLine3D(
        [
          { x: -200, y: 5_123, z: 6_789, m: { width: 2 } },
          { x: 1_234, y: 5_678, z: 7_890, m: { width: 3 } },
        ],
        3.3,
      ),
      new BaseVectorLine3D(
        [
          { x: 1_234, y: 5_678, z: 7_890, m: { width: 4 } },
          { x: 2, y: 3, z: 4, m: { width: 5 } },
        ],
        4.4,
      ),
    ],
    [0, 1, 500, 600, 4, 1_000],
    { name: 'b' },
    100,
  );

  it('geometry', () => {
    expect(lineA.geometry).toEqual([
      new BaseVectorLine3D([
        { x: 0, y: 1, z: 2 },
        { x: 2, y: 3, z: 4 },
      ]),
    ]);
    expect(lineA.loadGeometry()).toEqual([
      [
        { x: 0, y: 1, z: 2 },
        { x: 2, y: 3, z: 4 },
      ],
    ]);
    expect(lineB.geometry).toEqual([
      new BaseVectorLine3D(
        [
          { x: -200, y: 5_123, z: 6_789, m: { width: 2 } },
          { x: 1_234, y: 5_678, z: 7_890, m: { width: 3 } },
        ],
        3.3,
      ),
      new BaseVectorLine3D(
        [
          { x: 1_234, y: 5_678, z: 7_890, m: { width: 4 } },
          { x: 2, y: 3, z: 4, m: { width: 5 } },
        ],
        4.4,
      ),
    ]);
  });

  it('has ids', () => {
    expect(lineA.id).toBe(1);
    expect(lineB.id).toBe(100);
  });

  it('hasOffsets', () => {
    expect(lineA.hasOffsets).toBe(false);
    expect(lineB.hasOffsets).toBe(true);
  });

  it('hasMValues', () => {
    expect(lineA.hasMValues).toBe(false);
    expect(lineB.hasMValues).toBe(true);
  });

  it('hasBBox', () => {
    expect(lineA.hasBBox).toBe(false);
    expect(lineB.hasBBox).toBe(true);
  });

  it('has properties', () => {
    expect(lineA.properties).toEqual({ name: 'a' });
    expect(lineB.properties).toEqual({ name: 'b' });
  });

  it('adds geometry and mvalues to cache', () => {
    const pbf = new Pbf();
    const cache = new ColumnCacheWriter();
    // we only add the second because the first is a single point and doesn't need to be added to cache
    expect(lineB.addGeometryToCache(cache, { width: 'u64' }));
    pbf.writeMessage(5, ColumnCacheWriter.write, cache);
    const rawData = pbf.commit();
    expect(rawData).toEqual(
      new Uint8Array([
        42, 65, 8, 2, 8, 3, 8, 4, 8, 5, 50, 12, 249, 149, 128, 169, 208, 104, 240, 241, 163, 204,
        168, 1, 50, 12, 192, 203, 170, 173, 248, 105, 239, 245, 161, 173, 248, 105, 58, 15, 4, 196,
        51, 199, 51, 4, 3, 2, 222, 68, 221, 68, 2, 0, 2, 66, 1, 0, 66, 1, 1, 66, 1, 2, 66, 1, 3,
      ]),
    );

    const parsePBF = new Pbf(rawData);
    parsePBF.readTag(); // 5
    // const cache2 = new ColumnCacheReader(parsePBF, parsePBF.readVarint() + parsePBF.pos);
    // expect(cache2[0]).toEqual([{ pos: 3 }]);
    // expect(cache2[1]).toEqual([
    //   {
    //     pos: 10,
    //   },
    //   {
    //     pos: 12,
    //   },
    //   {
    //     pos: 14,
    //   },
    //   {
    //     pos: 16,
    //   },
    // ]);
    // expect(cache2[5]).toEqual([{ pos: 18 }, { pos: 32 }]);
    // expect(cache2[6]).toEqual([
    //   {
    //     pos: 46,
    //   },
    //   {
    //     pos: 51,
    //   },
    //   {
    //     pos: 54,
    //   },
    //   {
    //     pos: 57,
    //   },
    //   {
    //     pos: 60,
    //   },
    //   {
    //     pos: 63,
    //   },
    // ]);
    // expect(cache2[7]).toEqual([
    //   {
    //     pos: 73,
    //   },
    //   {
    //     pos: 77,
    //   },
    //   {
    //     pos: 81,
    //   },
    //   {
    //     pos: 85,
    //   },
    // ]);
  });
});

describe('BaseVectorPolysFeature', () => {
  const polyA = new BaseVectorPolysFeature(
    [
      [
        new BaseVectorLine([
          { x: 1, y: 2 },
          { x: 3, y: 4 },
        ]),
        new BaseVectorLine([
          { x: 5, y: 6 },
          { x: 7, y: 8 },
        ]),
        new BaseVectorLine([
          { x: 9, y: 10 },
          { x: 11, y: 12 },
        ]),
      ],
    ],
    undefined,
    undefined,
    undefined,
    { name: 'a' },
    200,
  );

  const polyB = new BaseVectorPolysFeature(
    [
      [
        new BaseVectorLine([
          { x: 13, y: 14, m: { a: 1 } },
          { x: 15, y: 16, m: { b: 2 } },
        ]),
        new BaseVectorLine([
          { x: 17, y: 18 },
          { x: 19, y: 20 },
        ]),
        new BaseVectorLine([
          { x: 21, y: 22 },
          { x: 23, y: 24 },
        ]),
      ],
      [
        new BaseVectorLine([
          { x: 25, y: 26 },
          { x: 27, y: 28 },
        ]),
        new BaseVectorLine([
          { x: 29, y: 30 },
          { x: 31, y: 32 },
        ]),
        new BaseVectorLine([
          { x: 33, y: 34 },
          { x: 35, y: 36 },
        ]),
      ],
    ],
    undefined,
    undefined,
    undefined,
    { name: 'b' },
    200,
  );

  it('geometry', () => {
    expect(polyA.geometry).toEqual([
      [
        new BaseVectorLine([
          { x: 1, y: 2 },
          { x: 3, y: 4 },
        ]),
        new BaseVectorLine([
          { x: 5, y: 6 },
          { x: 7, y: 8 },
        ]),
        new BaseVectorLine([
          { x: 9, y: 10 },
          { x: 11, y: 12 },
        ]),
      ],
    ]);

    expect(polyB.geometry).toEqual([
      [
        new BaseVectorLine([
          { x: 13, y: 14, m: { a: 1 } },
          { x: 15, y: 16, m: { b: 2 } },
        ]),
        new BaseVectorLine([
          { x: 17, y: 18 },
          { x: 19, y: 20 },
        ]),
        new BaseVectorLine([
          { x: 21, y: 22 },
          { x: 23, y: 24 },
        ]),
      ],
      [
        new BaseVectorLine([
          { x: 25, y: 26 },
          { x: 27, y: 28 },
        ]),
        new BaseVectorLine([
          { x: 29, y: 30 },
          { x: 31, y: 32 },
        ]),
        new BaseVectorLine([
          { x: 33, y: 34 },
          { x: 35, y: 36 },
        ]),
      ],
    ]);
  });

  it('properties', () => {
    expect(polyA.properties).toEqual({ name: 'a' });
    expect(polyB.properties).toEqual({ name: 'b' });
  });

  it('id', () => {
    expect(polyA.id).toEqual(200);
    expect(polyB.id).toEqual(200);
  });

  it('hasOffsets', () => {
    expect(polyA.hasOffsets).toEqual(false);
    expect(polyB.hasOffsets).toEqual(false);
  });

  it('hasMValues', () => {
    expect(polyA.hasMValues).toEqual(false);
    expect(polyB.hasMValues).toEqual(true);
  });

  it('hasBBox', () => {
    expect(polyA.hasBBox).toEqual(false);
    expect(polyB.hasBBox).toEqual(false);
  });

  it('addGeometryToCache', () => {
    const pbf = new Pbf();
    const cache = new ColumnCacheWriter();
    polyB.addGeometryToCache(cache, { a: 'i64', b: 'i64' });

    pbf.writeMessage(5, ColumnCacheWriter.write, cache);

    const rawData = pbf.commit();
    expect(rawData).toEqual(
      new Uint8Array([
        42, 77, 16, 0, 16, 2, 16, 4, 42, 3, 228, 7, 48, 42, 3, 164, 24, 48, 42, 3, 228, 25, 48, 42,
        3, 164, 30, 48, 42, 3, 228, 31, 48, 42, 3, 164, 96, 48, 58, 27, 4, 2, 5, 4, 3, 2, 0, 2, 0,
        0, 0, 0, 0, 0, 2, 0, 1, 0, 0, 4, 3, 0, 0, 6, 5, 0, 0, 66, 2, 1, 0, 66, 2, 0, 2, 66, 2, 0, 0,
      ]),
    );
  });
});

describe('BaseVectorPolys3DFeature', () => {
  const polyA = new BaseVectorPolys3DFeature(
    [
      [
        new BaseVectorLine3D([
          { x: 1, y: 2, z: 3 },
          { x: 3, y: 4, z: 5 },
        ]),
        new BaseVectorLine3D([
          { x: 5, y: 6, z: 7 },
          { x: 7, y: 8, z: 9 },
        ]),
        new BaseVectorLine3D([
          { x: 9, y: 10, z: 11 },
          { x: 11, y: 12, z: 13 },
        ]),
      ],
    ],
    undefined,
    undefined,
    undefined,
    { name: 'a' },
    200,
  );

  const polyB = new BaseVectorPolys3DFeature(
    [
      [
        new BaseVectorLine3D([
          { x: 13, y: 14, z: 15, m: { a: 1 } },
          { x: 15, y: 16, z: 17, m: { b: 2 } },
        ]),
        new BaseVectorLine3D([
          { x: 17, y: 18, z: 19 },
          { x: 19, y: 20, z: 21 },
        ]),
        new BaseVectorLine3D([
          { x: 21, y: 22, z: 23 },
          { x: 23, y: 24, z: 25 },
        ]),
      ],
      [
        new BaseVectorLine3D([
          { x: 25, y: 26, z: 27 },
          { x: 27, y: 28, z: 29 },
        ]),
        new BaseVectorLine3D([
          { x: 29, y: 30, z: 31 },
          { x: 31, y: 32, z: 33 },
        ]),
        new BaseVectorLine3D([
          { x: 33, y: 34, z: 35 },
          { x: 35, y: 36, z: 37 },
        ]),
      ],
    ],
    undefined,
    undefined,
    undefined,
    { name: 'b' },
    200,
  );

  it('geometry', () => {
    expect(polyA.geometry).toEqual([
      [
        new BaseVectorLine3D([
          { x: 1, y: 2, z: 3 },
          { x: 3, y: 4, z: 5 },
        ]),
        new BaseVectorLine3D([
          { x: 5, y: 6, z: 7 },
          { x: 7, y: 8, z: 9 },
        ]),
        new BaseVectorLine3D([
          { x: 9, y: 10, z: 11 },
          { x: 11, y: 12, z: 13 },
        ]),
      ],
    ]);

    expect(polyB.geometry).toEqual([
      [
        new BaseVectorLine3D([
          { x: 13, y: 14, z: 15, m: { a: 1 } },
          { x: 15, y: 16, z: 17, m: { b: 2 } },
        ]),
        new BaseVectorLine3D([
          { x: 17, y: 18, z: 19 },
          { x: 19, y: 20, z: 21 },
        ]),
        new BaseVectorLine3D([
          { x: 21, y: 22, z: 23 },
          { x: 23, y: 24, z: 25 },
        ]),
      ],
      [
        new BaseVectorLine3D([
          { x: 25, y: 26, z: 27 },
          { x: 27, y: 28, z: 29 },
        ]),
        new BaseVectorLine3D([
          { x: 29, y: 30, z: 31 },
          { x: 31, y: 32, z: 33 },
        ]),
        new BaseVectorLine3D([
          { x: 33, y: 34, z: 35 },
          { x: 35, y: 36, z: 37 },
        ]),
      ],
    ]);
  });

  it('properties', () => {
    expect(polyA.properties).toEqual({ name: 'a' });
    expect(polyB.properties).toEqual({ name: 'b' });
  });

  it('id', () => {
    expect(polyA.id).toEqual(200);
    expect(polyB.id).toEqual(200);
  });

  it('hasOffsets', () => {
    expect(polyA.hasOffsets).toEqual(false);
    expect(polyB.hasOffsets).toEqual(false);
  });

  it('hasMValues', () => {
    expect(polyA.hasMValues).toEqual(false);
    expect(polyB.hasMValues).toEqual(true);
  });

  it('hasBBox', () => {
    expect(polyA.hasBBox).toEqual(false);
    expect(polyB.hasBBox).toEqual(false);
  });

  it('addGeometryToCache', () => {
    const pbf = new Pbf();
    const cache = new ColumnCacheWriter();
    polyB.addGeometryToCache(cache, { a: 'i64', b: 'i64' });

    pbf.writeMessage(5, ColumnCacheWriter.write, cache);

    const rawData = pbf.commit();
    expect(rawData).toEqual(
      new Uint8Array([
        42, 89, 16, 0, 16, 2, 16, 4, 50, 5, 168, 255, 1, 192, 3, 50, 5, 168, 131, 14, 192, 3, 50, 5,
        168, 159, 14, 192, 3, 50, 5, 168, 227, 15, 192, 3, 50, 5, 168, 255, 15, 192, 3, 50, 5, 168,
        131, 112, 192, 3, 58, 27, 4, 2, 5, 4, 3, 2, 0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 1, 0, 0, 4, 3, 0,
        0, 6, 5, 0, 0, 66, 2, 1, 0, 66, 2, 0, 2, 66, 2, 0, 0,
      ]),
    );
  });
});
