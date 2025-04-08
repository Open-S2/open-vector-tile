import { Pbf } from 'pbf-ts';
import {
  BaseVectorLine,
  BaseVectorLines3DFeature,
  BaseVectorLinesFeature,
  BaseVectorPoints3DFeature,
  BaseVectorPointsFeature,
  BaseVectorPolys3DFeature,
  BaseVectorPolysFeature,
} from '../../src/base';
import { ColumnCacheReader, ColumnCacheWriter } from '../../src/open/columnCache';
import {
  OVectorFeatureBase,
  OVectorLines3DFeature,
  OVectorLinesFeature,
  OVectorPoints3DFeature,
  OVectorPointsFeature,
  OVectorPolys3DFeature,
  OVectorPolysFeature,
  readFeature,
  writeOVFeature,
} from '../../src/open/vectorFeature';
import { describe, expect, it } from 'bun:test';

import type { Shape } from '../../src/open/shape';

describe('OVectorFeatureBase', () => {
  const pbf = new Pbf();
  const col = new ColumnCacheReader(pbf);
  it('basic creation', () => {
    const feature = new OVectorFeatureBase(
      col,
      22,
      { name: 'a' },
      { width: 'u64' },
      4096,
      [],
      true,
      0,
      false,
      false,
      0,
      0,
    );
    expect(feature).toBeInstanceOf(OVectorFeatureBase);
  });
});

describe('encodePointFeature and decodePointFeature', () => {
  const pbf = new Pbf();
  const col = new ColumnCacheWriter();
  const shape: Shape = { name: 'string' };
  const mShape: Shape = { size: 'i64' };
  const basePointFeatureA = new BaseVectorPointsFeature([{ x: 3_805, y: 5_645 }], { name: 'a' }, 1);
  const basePointFeatureB = new BaseVectorPointsFeature(
    [
      { x: 1, y: 0, m: { size: 1 } },
      { x: 2, y: -1 },
    ],
    { name: 'b' },
    2,
  );
  const dataA = writeOVFeature(basePointFeatureA, shape, undefined, col);
  const dataB = writeOVFeature(basePointFeatureB, shape, mShape, col);
  // store column
  pbf.writeMessage(5, ColumnCacheWriter.write, col);
  // store features
  pbf.writeBytes(dataA);
  pbf.writeBytes(dataB);
  // commit
  const rawData = pbf.commit();

  const parsePBF = new Pbf(rawData);
  parsePBF.readTag(); // 5
  const cache = new ColumnCacheReader(parsePBF, parsePBF.readVarint() + parsePBF.pos);
  const decodeBytesA = parsePBF.readBytes();
  const decodeBytesB = parsePBF.readBytes();
  // ensure the features bytes are the same
  expect(decodeBytesA).toEqual(new Uint8Array(dataA));
  expect(decodeBytesB).toEqual(new Uint8Array(dataB));
  // read out the features
  const decodedPointFeatureA = readFeature(
    decodeBytesA,
    4_096,
    cache,
    shape,
  ) as OVectorPointsFeature;
  const decodedPointFeatureB = readFeature(
    decodeBytesB,
    4_096,
    cache,
    shape,
    mShape,
  ) as OVectorPointsFeature;

  it('point features are decoded correctly', () => {
    // ensure data type is accurate:
    expect(decodedPointFeatureA).toBeInstanceOf(OVectorPointsFeature);
    expect(decodedPointFeatureB).toBeInstanceOf(OVectorPointsFeature);

    // ensure accuracy of feature A:
    expect(decodedPointFeatureA.id).toBe(1);
    expect(decodedPointFeatureA.properties).toEqual({ name: 'a' });
    expect(decodedPointFeatureA.extent).toBe(4_096);
    expect(decodedPointFeatureA.type).toBe(1);
    expect(decodedPointFeatureA.loadGeometry()).toEqual([{ x: 3_805, y: 5_645 }]);
    expect(decodedPointFeatureA.isPoints()).toBeTrue();
    expect(decodedPointFeatureA.isLines()).toBeFalse();
    expect(decodedPointFeatureA.isPolygons()).toBeFalse();
    expect(decodedPointFeatureA.isPoints3D()).toBeFalse();
    expect(decodedPointFeatureA.isLines3D()).toBeFalse();
    expect(decodedPointFeatureA.isPolygons3D()).toBeFalse();

    // ensure accuracy of feature B:
    expect(decodedPointFeatureB.id).toBe(2);
    expect(decodedPointFeatureB.properties).toEqual({ name: 'b' });
    expect(decodedPointFeatureB.extent).toBe(4_096);
    expect(decodedPointFeatureB.type).toBe(1);
    expect(decodedPointFeatureB.hasMValues).toBe(true);
    expect(decodedPointFeatureB.loadGeometry()).toEqual([
      { x: 1, y: 0, m: { size: 1 } },
      { x: 2, y: -1, m: { size: 0 } },
    ]);
    expect(decodedPointFeatureB.loadPoints()).toEqual([
      { x: 1, y: 0, m: { size: 1 } },
      { x: 2, y: -1, m: { size: 0 } },
    ]);
    expect(decodedPointFeatureB.loadLines()).toEqual([]);
    // dead code
    const tess: number[] = [];
    decodedPointFeatureB.addTessellation(tess, 1);
    expect(tess).toEqual([]);
    expect(decodedPointFeatureB.loadGeometryFlat()).toEqual([[], []]);
    expect(decodedPointFeatureB.readIndices()).toEqual([]);
    expect(decodedPointFeatureB.bbox()).toEqual([0, 0, 0, 0]);
  });
});

describe('encodePoint3DFeature and decodePoint3DFeature', () => {
  const pbf = new Pbf();
  const col = new ColumnCacheWriter();
  const shape: Shape = { name: 'string' };
  const mShape: Shape = { size: 'u64' };
  const basePointFeatureA = new BaseVectorPoints3DFeature(
    [{ x: 3_805, y: 5_645, z: 3_212 }],
    { name: 'a' },
    1,
  );
  const basePointFeatureB = new BaseVectorPoints3DFeature(
    [
      { x: 1, y: 0, z: 5, m: { size: 1 } },
      { x: 2, y: -1, z: 6 },
    ],
    { name: 'b' },
    2,
  );
  const dataA = writeOVFeature(basePointFeatureA, shape, undefined, col);
  const dataB = writeOVFeature(basePointFeatureB, shape, mShape, col);
  // store column
  pbf.writeMessage(5, ColumnCacheWriter.write, col);
  // store features
  pbf.writeBytes(dataA);
  pbf.writeBytes(dataB);
  // commit
  const rawData = pbf.commit();

  const parsePBF = new Pbf(rawData);
  parsePBF.readTag(); // 5
  const cache = new ColumnCacheReader(parsePBF, parsePBF.readVarint() + parsePBF.pos);
  const decodeBytesA = parsePBF.readBytes();
  const decodeBytesB = parsePBF.readBytes();
  // ensure the features bytes are the same
  expect(decodeBytesA).toEqual(new Uint8Array(dataA));
  expect(decodeBytesB).toEqual(new Uint8Array(dataB));
  // read out the features
  const decodedPointFeatureA = readFeature(
    decodeBytesA,
    4_096,
    cache,
    shape,
  ) as OVectorPoints3DFeature;
  const decodedPointFeatureB = readFeature(
    decodeBytesB,
    4_096,
    cache,
    shape,
    mShape,
  ) as OVectorPoints3DFeature;

  it('point features are decoded correctly', () => {
    // ensure data type is accurate:
    expect(decodedPointFeatureA).toBeInstanceOf(OVectorPoints3DFeature);
    expect(decodedPointFeatureB).toBeInstanceOf(OVectorPoints3DFeature);

    // ensure accuracy of feature A:
    expect(decodedPointFeatureA.id).toBe(1);
    expect(decodedPointFeatureA.properties).toEqual({ name: 'a' });
    expect(decodedPointFeatureA.extent).toBe(4_096);
    expect(decodedPointFeatureA.type).toBe(4);
    expect(decodedPointFeatureA.loadGeometry()).toEqual([{ x: 3_805, y: 5_645, z: 3_212 }]);
    expect(decodedPointFeatureA.geoType()).toEqual('MultiPoint');
    expect(decodedPointFeatureA.isPoints()).toBeFalse();
    expect(decodedPointFeatureA.isLines()).toBeFalse();
    expect(decodedPointFeatureA.isPolygons()).toBeFalse();
    expect(decodedPointFeatureA.isPoints3D()).toBeTrue();
    expect(decodedPointFeatureA.isLines3D()).toBeFalse();
    expect(decodedPointFeatureA.isPolygons3D()).toBeFalse();

    // ensure accuracy of feature B:
    expect(decodedPointFeatureB.id).toBe(2);
    expect(decodedPointFeatureB.properties).toEqual({ name: 'b' });
    expect(decodedPointFeatureB.extent).toBe(4_096);
    expect(decodedPointFeatureB.type).toBe(4);
    expect(decodedPointFeatureB.hasMValues).toBe(true);
    expect(decodedPointFeatureB.loadGeometry()).toEqual([
      { x: 1, y: 0, z: 5, m: { size: 1 } },
      { x: 2, y: -1, z: 6, m: { size: 0 } },
    ]);
    expect(decodedPointFeatureB.loadPoints()).toEqual([
      { x: 1, y: 0, z: 5, m: { size: 1 } },
      { x: 2, y: -1, z: 6, m: { size: 0 } },
    ]);
    expect(decodedPointFeatureB.loadLines()).toEqual([]);
    // dead code
    const tess: number[] = [];
    decodedPointFeatureB.addTessellation(tess, 1);
    expect(tess).toEqual([]);
    expect(decodedPointFeatureB.loadGeometryFlat()).toEqual([[], []]);
    expect(decodedPointFeatureB.readIndices()).toEqual([]);
    expect(decodedPointFeatureB.bbox()).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe('encodeLineFeature and decodeLineFeature', () => {
  const pbf = new Pbf();
  const col = new ColumnCacheWriter();
  const shape: Shape = { name: 'string' };
  const mShape: Shape = { width: 'i64' };
  const basePointFeatureA = new BaseVectorLinesFeature(
    [
      new BaseVectorLine([
        { x: 3_805, y: 5_645 },
        { x: 1, y: 0 },
      ]),
    ],
    { name: 'a' },
    1,
  );
  const basePointFeatureB = new BaseVectorLinesFeature(
    [
      new BaseVectorLine(
        [
          { x: 1, y: 0, m: { width: 2 } },
          { x: 2, y: -1, m: { width: -3 } },
        ],
        2.2,
      ),
      new BaseVectorLine(
        [
          { x: 0, y: -2 },
          { x: 300, y: 500 },
        ],
        102.2,
      ),
    ],
    { name: 'b' },
    2,
    [-120.22, -2, 102.111, 50.5],
  );
  const dataA = writeOVFeature(basePointFeatureA, shape, mShape, col);
  const dataB = writeOVFeature(basePointFeatureB, shape, mShape, col);
  // store column
  pbf.writeMessage(5, ColumnCacheWriter.write, col);
  // store features
  pbf.writeBytes(dataA);
  pbf.writeBytes(dataB);
  // commit
  const rawData = pbf.commit();

  const parsePBF = new Pbf(rawData);
  parsePBF.readTag(); // 5
  const cache = new ColumnCacheReader(parsePBF, parsePBF.readVarint() + parsePBF.pos);
  const decodeBytesA = parsePBF.readBytes();
  const decodeBytesB = parsePBF.readBytes();
  // ensure the features bytes are the same
  expect(decodeBytesA).toEqual(new Uint8Array(dataA));
  expect(decodeBytesB).toEqual(new Uint8Array(dataB));
  // read out the features
  const decodedPointFeatureA = readFeature(
    decodeBytesA,
    4_096,
    cache,
    shape,
    mShape,
  ) as OVectorLinesFeature;
  const decodedPointFeatureB = readFeature(
    decodeBytesB,
    4_096,
    cache,
    shape,
    mShape,
  ) as OVectorLinesFeature;

  it('line features are decoded correctly', () => {
    // ensure data type is accurate:
    expect(decodedPointFeatureA).toBeInstanceOf(OVectorLinesFeature);
    expect(decodedPointFeatureB).toBeInstanceOf(OVectorLinesFeature);

    // ensure accuracy of feature A:
    expect(decodedPointFeatureA.id).toBe(1);
    expect(decodedPointFeatureA.properties).toEqual({ name: 'a' });
    expect(decodedPointFeatureA.extent).toBe(4_096);
    expect(decodedPointFeatureA.type).toBe(2);
    const geometry = decodedPointFeatureA.loadGeometry();
    expect(geometry).toEqual([
      [
        { x: 3_805, y: 5_645 },
        { x: 1, y: 0 },
      ],
    ]);
    expect(decodedPointFeatureA.isPoints()).toBeFalse();
    expect(decodedPointFeatureA.isLines()).toBeTrue();
    expect(decodedPointFeatureA.isPolygons()).toBeFalse();
    expect(decodedPointFeatureA.isPoints3D()).toBeFalse();
    expect(decodedPointFeatureA.isLines3D()).toBeFalse();
    expect(decodedPointFeatureA.isPolygons3D()).toBeFalse();

    // ensure accuracy of feature B:
    expect(decodedPointFeatureB.id).toBe(2);
    expect(decodedPointFeatureB.properties).toEqual({ name: 'b' });
    expect(decodedPointFeatureB.extent).toBe(4_096);
    expect(decodedPointFeatureB.type).toBe(2);
    expect(decodedPointFeatureB.loadPoints()).toEqual([
      { x: 1, y: 0, m: { width: 2 } },
      { x: 2, y: -1, m: { width: -3 } },
      { x: 0, y: -2, m: { width: 0 } },
      { x: 300, y: 500, m: { width: 0 } },
    ]);
    expect(decodedPointFeatureB.loadGeometry()).toEqual([
      [
        { x: 1, y: 0, m: { width: 2 } },
        { x: 2, y: -1, m: { width: -3 } },
      ],
      [
        { x: 0, y: -2, m: { width: 0 } },
        { x: 300, y: 500, m: { width: 0 } },
      ],
    ]);
    expect(decodedPointFeatureB.loadLines()).toEqual([
      {
        geometry: [
          { m: { width: 2 }, x: 1, y: 0 },
          { m: { width: -3 }, x: 2, y: -1 },
        ],
        offset: 2.2,
      },
      {
        geometry: [
          { m: { width: 0 }, x: 0, y: -2 },
          { m: { width: 0 }, x: 300, y: 500 },
        ],
        offset: 102.2,
      },
    ]);
    expect(decodedPointFeatureB.bbox()).toEqual([
      -120.2199947965142, -2, 102.1110059089068, 50.49999597668625,
    ]);
  });
});

describe('encodeLine3DFeature and decodeLine3DFeature', () => {
  const pbf = new Pbf();
  const col = new ColumnCacheWriter();
  const shape: Shape = { name: 'string' };
  const mShape: Shape = { width: 'i64' };
  const basePointFeatureA = new BaseVectorLines3DFeature(
    [
      new BaseVectorLine([
        { x: 3_805, y: 5_645, z: 1_000 },
        { x: 1, y: 0, z: 2 },
      ]),
    ],
    { name: 'a' },
    1,
  );
  const basePointFeatureB = new BaseVectorLines3DFeature(
    [
      new BaseVectorLine(
        [
          { x: 1, y: 0, z: 2, m: { width: 2 } },
          { x: 2, y: -1, z: -3, m: { width: -3 } },
        ],
        2.2,
      ),
      new BaseVectorLine(
        [
          { x: 0, y: -2, z: 200 },
          { x: 300, y: 500, z: 502 },
        ],
        102.2,
      ),
    ],
    { name: 'b' },
    2,
    [0.11, -2, 165.5, 45.5, -102.2, 30.667],
  );
  const dataA = writeOVFeature(basePointFeatureA, shape, mShape, col);
  const dataB = writeOVFeature(basePointFeatureB, shape, mShape, col);
  // store column
  pbf.writeMessage(5, ColumnCacheWriter.write, col);
  // store features
  pbf.writeBytes(dataA);
  pbf.writeBytes(dataB);
  // commit
  const rawData = pbf.commit();

  const parsePBF = new Pbf(rawData);
  parsePBF.readTag(); // 5
  const cache = new ColumnCacheReader(parsePBF, parsePBF.readVarint() + parsePBF.pos);
  const decodeBytesA = parsePBF.readBytes();
  const decodeBytesB = parsePBF.readBytes();
  // ensure the features bytes are the same
  expect(decodeBytesA).toEqual(new Uint8Array(dataA));
  expect(decodeBytesB).toEqual(new Uint8Array(dataB));
  // read out the features
  const decodedPointFeatureA = readFeature(
    decodeBytesA,
    4_096,
    cache,
    shape,
    mShape,
  ) as OVectorLines3DFeature;
  const decodedPointFeatureB = readFeature(
    decodeBytesB,
    4_096,
    cache,
    shape,
    mShape,
  ) as OVectorLines3DFeature;

  it('point features are decoded correctly', () => {
    // ensure data type is accurate:
    expect(decodedPointFeatureA).toBeInstanceOf(OVectorLines3DFeature);
    expect(decodedPointFeatureB).toBeInstanceOf(OVectorLines3DFeature);

    // ensure accuracy of feature A:
    expect(decodedPointFeatureA.id).toBe(1);
    expect(decodedPointFeatureA.properties).toEqual({ name: 'a' });
    expect(decodedPointFeatureA.extent).toBe(4_096);
    expect(decodedPointFeatureA.type).toBe(5);
    const geometry = decodedPointFeatureA.loadGeometry();
    expect(geometry).toEqual([
      [
        { x: 3_805, y: 5_645, z: 1_000 },
        { x: 1, y: 0, z: 2 },
      ],
    ]);
    expect(decodedPointFeatureA.geoType()).toEqual('MultiLineString');
    expect(decodedPointFeatureA.isPoints()).toBeFalse();
    expect(decodedPointFeatureA.isLines()).toBeFalse();
    expect(decodedPointFeatureA.isPolygons()).toBeFalse();
    expect(decodedPointFeatureA.isPoints3D()).toBeFalse();
    expect(decodedPointFeatureA.isLines3D()).toBeTrue();
    expect(decodedPointFeatureA.isPolygons3D()).toBeFalse();

    // ensure accuracy of feature B:
    expect(decodedPointFeatureB.id).toBe(2);
    expect(decodedPointFeatureB.properties).toEqual({ name: 'b' });
    expect(decodedPointFeatureB.extent).toBe(4_096);
    expect(decodedPointFeatureB.type).toBe(5);
    expect(decodedPointFeatureB.loadGeometry()).toEqual([
      [
        { x: 1, y: 0, z: 2, m: { width: 2 } },
        { x: 2, y: -1, z: -3, m: { width: -3 } },
      ],
      [
        { x: 0, y: -2, z: 200, m: { width: 0 } },
        { x: 300, y: 500, z: 502, m: { width: 0 } },
      ],
    ]);
    expect(decodedPointFeatureB.loadPoints()).toEqual([
      { x: 1, y: 0, z: 2, m: { width: 2 } },
      { x: 2, y: -1, z: -3, m: { width: -3 } },
      { x: 0, y: -2, z: 200, m: { width: 0 } },
      { x: 300, y: 500, z: 502, m: { width: 0 } },
    ]);
    expect(decodedPointFeatureB.loadLines()).toEqual([
      {
        geometry: [
          { m: { width: 2 }, x: 1, y: 0, z: 2 },
          { m: { width: -3 }, x: 2, y: -1, z: -3 },
        ],
        offset: 2.2,
      },
      {
        geometry: [
          { m: { width: 0 }, x: 0, y: -2, z: 200 },
          { m: { width: 0 }, x: 300, y: 500, z: 502 },
        ],
        offset: 102.2,
      },
    ]);
    // 0.11, -2, 165.5, 45.5, -102.2, 30.667
    expect(decodedPointFeatureB.bbox()).toEqual([
      0.11000276267546383, -2, 165.49999865889544, 45.50000402331375, -102.19999694824219,
      30.66699981689453,
    ]);
  });
});

describe('encodePolysFeature and decodePolysFeature', () => {
  const pbf = new Pbf();
  const col = new ColumnCacheWriter();
  const shape: Shape = { name: 'string' };
  const mShape: Shape = { width: 'i64' };
  const basePolyFeatureA = new BaseVectorPolysFeature(
    [
      [
        new BaseVectorLine([
          { x: 3_805, y: 5_645 },
          { x: 1, y: 0 },
        ]),
        new BaseVectorLine([
          { x: 1, y: 0 },
          { x: 2, y: -1 },
        ]),
        new BaseVectorLine([
          { x: 2, y: -1 },
          { x: 0, y: -2 },
        ]),
      ],
    ],
    undefined,
    undefined,
    { name: 'a' },
    55,
  );
  const basePolyFeatureB = new BaseVectorPolysFeature(
    [
      [
        new BaseVectorLine(
          [
            { x: 1, y: 0, m: { width: 2 } },
            { x: 2, y: -1, m: { width: -3 } },
          ],
          4.4,
        ),
        new BaseVectorLine(
          [
            { x: 2, y: -1 },
            { x: 0, y: -2 },
          ],
          1004,
        ),
      ],
      [
        new BaseVectorLine(
          [
            { x: 0, y: -2, m: { width: 0 } },
            { x: 300, y: 500, m: { width: 55 } },
          ],
          102.2,
        ),
        new BaseVectorLine(
          [
            { x: 300, y: 500 },
            { x: 0, y: 0 },
          ],
          2.2,
        ),
      ],
      [
        new BaseVectorLine(
          [
            { x: 0, y: 0 },
            { x: 300, y: 500 },
          ],
          5.5,
        ),
        new BaseVectorLine([
          { x: 300, y: 500, m: { width: -1_222 } },
          { x: 0, y: -2 },
        ]),
        new BaseVectorLine([
          { x: 0, y: -2 },
          { x: 300, y: 500 },
        ]),
      ],
    ],
    [0, 1, 5, 2],
    [1, 2, 3, 4, 5, 6],
    { name: 'b' },
    5_555,
    [0.1, 1.1, 2.3, 3.3],
  );

  const dataA = writeOVFeature(basePolyFeatureA, shape, undefined, col);
  const dataB = writeOVFeature(basePolyFeatureB, shape, mShape, col);
  // store column
  pbf.writeMessage(5, ColumnCacheWriter.write, col);
  // store features
  pbf.writeBytes(dataA);
  pbf.writeBytes(dataB);
  // commit
  const rawData = pbf.commit();

  const parsePBF = new Pbf(rawData);
  parsePBF.readTag(); // 5
  const cache = new ColumnCacheReader(parsePBF, parsePBF.readVarint() + parsePBF.pos);
  const decodeBytesA = parsePBF.readBytes();
  const decodeBytesB = parsePBF.readBytes();
  // ensure the features bytes are the same
  expect(decodeBytesA).toEqual(new Uint8Array(dataA));
  expect(decodeBytesB).toEqual(new Uint8Array(dataB));
  // read out the features
  const decodedPolyFeatureA = readFeature(decodeBytesA, 4_096, cache, shape) as OVectorPolysFeature;
  const decodedPolyFeatureB = readFeature(
    decodeBytesB,
    4_096,
    cache,
    shape,
    mShape,
  ) as OVectorPolysFeature;

  it('point features are decoded correctly', () => {
    // ensure data type is accurate:
    expect(decodedPolyFeatureA).toBeInstanceOf(OVectorPolysFeature);
    expect(decodedPolyFeatureB).toBeInstanceOf(OVectorPolysFeature);

    // ensure accuracy of feature A:
    expect(decodedPolyFeatureA.id).toBe(55);
    expect(decodedPolyFeatureA.properties).toEqual({ name: 'a' });
    expect(decodedPolyFeatureA.extent).toBe(4_096);
    expect(decodedPolyFeatureA.type).toBe(3);
    const geometry = decodedPolyFeatureA.loadGeometry();
    expect(geometry).toEqual([
      [
        [
          { x: 3805, y: 5645 },
          { x: 1, y: 0 },
        ],
        [
          { x: 1, y: 0 },
          { x: 2, y: -1 },
        ],
        [
          { x: 2, y: -1 },
          { x: 0, y: -2 },
        ],
      ],
    ]);
    expect(decodedPolyFeatureA.geoType()).toEqual('MultiPolygon');
    expect(decodedPolyFeatureA.isPoints()).toBeFalse();
    expect(decodedPolyFeatureA.isLines()).toBeFalse();
    expect(decodedPolyFeatureA.isPolygons()).toBeTrue();
    expect(decodedPolyFeatureA.isPoints3D()).toBeFalse();
    expect(decodedPolyFeatureA.isLines3D()).toBeFalse();
    expect(decodedPolyFeatureA.isPolygons3D()).toBeFalse();

    // ensure accuracy of feature B:
    expect(decodedPolyFeatureB.id).toBe(5_555);
    expect(decodedPolyFeatureB.properties).toEqual({ name: 'b' });
    expect(decodedPolyFeatureB.extent).toBe(4_096);
    expect(decodedPolyFeatureB.type).toBe(3);
    expect(decodedPolyFeatureB.loadGeometry()).toEqual([
      [
        [
          { x: 1, y: 0, m: { width: 2 } },
          { x: 2, y: -1, m: { width: -3 } },
        ],
        [
          { x: 2, y: -1, m: { width: 0 } },
          { x: 0, y: -2, m: { width: 0 } },
        ],
      ],
      [
        [
          { x: 0, y: -2, m: { width: 0 } },
          { x: 300, y: 500, m: { width: 55 } },
        ],
        [
          { x: 300, y: 500, m: { width: 0 } },
          { x: 0, y: 0, m: { width: 0 } },
        ],
      ],
      [
        [
          { x: 0, y: 0, m: { width: 0 } },
          { x: 300, y: 500, m: { width: 0 } },
        ],
        [
          { x: 300, y: 500, m: { width: -1_222 } },
          { x: 0, y: -2, m: { width: 0 } },
        ],
        [
          { x: 0, y: -2, m: { width: 0 } },
          { x: 300, y: 500, m: { width: 0 } },
        ],
      ],
    ]);
    expect(decodedPolyFeatureB.loadPoints()).toEqual([
      { x: 1, y: 0, m: { width: 2 } },
      { x: 2, y: -1, m: { width: -3 } },
      { x: 2, y: -1, m: { width: 0 } },
      { x: 0, y: -2, m: { width: 0 } },
      { x: 0, y: -2, m: { width: 0 } },
      { x: 300, y: 500, m: { width: 55 } },
      { x: 300, y: 500, m: { width: 0 } },
      { x: 0, y: 0, m: { width: 0 } },
      { x: 0, y: 0, m: { width: 0 } },
      { x: 300, y: 500, m: { width: 0 } },
      { x: 300, y: 500, m: { width: -1_222 } },
      { x: 0, y: -2, m: { width: 0 } },
      { x: 0, y: -2, m: { width: 0 } },
      { x: 300, y: 500, m: { width: 0 } },
    ]);
    expect(decodedPolyFeatureB.loadLines()).toEqual([
      {
        geometry: [
          { x: 1, y: 0, m: { width: 2 } },
          { x: 2, y: -1, m: { width: -3 } },
        ],
        offset: 4.4,
      },
      {
        geometry: [
          { x: 2, y: -1, m: { width: 0 } },
          { x: 0, y: -2, m: { width: 0 } },
        ],
        offset: 1004,
      },
      {
        geometry: [
          { x: 0, y: -2, m: { width: 0 } },
          { x: 300, y: 500, m: { width: 55 } },
        ],
        offset: 102.2,
      },
      {
        geometry: [
          { x: 300, y: 500, m: { width: 0 } },
          { x: 0, y: 0, m: { width: 0 } },
        ],
        offset: 2.2,
      },
      {
        geometry: [
          { x: 0, y: 0, m: { width: 0 } },
          { x: 300, y: 500, m: { width: 0 } },
        ],
        offset: 5.5,
      },
      {
        geometry: [
          { x: 300, y: 500, m: { width: -1_222 } },
          { x: 0, y: -2, m: { width: 0 } },
        ],
        offset: 0,
      },
      {
        geometry: [
          { x: 0, y: -2, m: { width: 0 } },
          { x: 300, y: 500, m: { width: 0 } },
        ],
        offset: 0,
      },
    ]);
    const [geoWithTess, indices] = decodedPolyFeatureB.loadGeometryFlat();
    expect(geoWithTess).toEqual([
      0.000244140625, 0, 0.00048828125, -0.000244140625, 0.00048828125, -0.000244140625, 0,
      -0.00048828125, 0, -0.00048828125, 0.0732421875, 0.1220703125, 0.0732421875, 0.1220703125, 0,
      0, 0, 0, 0.0732421875, 0.1220703125, 0.0732421875, 0.1220703125, 0, -0.00048828125, 0,
      -0.00048828125, 0.0732421875, 0.1220703125, 0.000244140625, 0.00048828125, 0.000732421875,
      0.0009765625, 0.001220703125, 0.00146484375,
    ]);
    expect(indices).toEqual([0, 1, 5, 2]);
    expect(decodedPolyFeatureB.bbox()).toEqual([
      0.10000348687194105, 1.1000008046627556, 2.299994367360739, 3.3000024139882527,
    ]);
  });
});

describe('encodePolys3DFeature and decodePolys3DFeature', () => {
  const pbf = new Pbf();
  const col = new ColumnCacheWriter();
  const shape: Shape = { name: 'string' };
  const mShape: Shape = { width: 'i64' };
  const basePolyFeatureA = new BaseVectorPolys3DFeature(
    [
      [
        new BaseVectorLine([
          { x: 3_805, y: 5_645, z: 4_001 },
          { x: 1, y: 0, z: 3 },
        ]),
        new BaseVectorLine([
          { x: 1, y: 0, z: 3 },
          { x: 2, y: -1, z: -9 },
        ]),
        new BaseVectorLine([
          { x: 2, y: -1, z: -9 },
          { x: 0, y: -2, z: 0 },
        ]),
      ],
    ],
    undefined,
    undefined,
    { name: 'a' },
    55,
  );
  const basePolyFeatureB = new BaseVectorPolys3DFeature(
    [
      [
        new BaseVectorLine(
          [
            { x: 1, y: 0, z: 3, m: { width: 55 } },
            { x: 2, y: -1, z: -9 },
          ],
          4.4,
        ),
        new BaseVectorLine(
          [
            { x: 2, y: -1, z: -3 },
            { x: 0, y: -2, z: 22 },
          ],
          1004,
        ),
      ],
      [
        new BaseVectorLine(
          [
            { x: 0, y: -2, z: 0 },
            { x: 300, y: 500, z: 300 },
          ],
          102.2,
        ),
        new BaseVectorLine(
          [
            { x: 300, y: 500, z: 100 },
            { x: 0, y: 0, z: 0 },
          ],
          2.2,
        ),
      ],
      [
        new BaseVectorLine(
          [
            { x: 0, y: 0, z: 0 },
            { x: 300, y: 500, z: 300 },
          ],
          5.5,
        ),
        new BaseVectorLine([
          { x: 300, y: 500, z: 300 },
          { x: 0, y: -2, z: 0 },
        ]),
        new BaseVectorLine([
          { x: 0, y: -2, z: 0 },
          { x: 300, y: 500, z: 200 },
        ]),
      ],
    ],
    [0, 1, 5, 2],
    [1, 2, 3, 4, 5, 6],
    { name: 'b' },
    5_555,
    [0.1, 1.1, 2.3, 3.3, -50, 120],
  );

  const dataA = writeOVFeature(basePolyFeatureA, shape, undefined, col);
  const dataB = writeOVFeature(basePolyFeatureB, shape, mShape, col);
  // store column
  pbf.writeMessage(5, ColumnCacheWriter.write, col);
  // store features
  pbf.writeBytes(dataA);
  pbf.writeBytes(dataB);
  // commit
  const rawData = pbf.commit();

  const parsePBF = new Pbf(rawData);
  parsePBF.readTag(); // 5
  const cache = new ColumnCacheReader(parsePBF, parsePBF.readVarint() + parsePBF.pos);
  const decodeBytesA = parsePBF.readBytes();
  const decodeBytesB = parsePBF.readBytes();
  // ensure the features bytes are the same
  expect(decodeBytesA).toEqual(new Uint8Array(dataA));
  expect(decodeBytesB).toEqual(new Uint8Array(dataB));
  // read out the features
  const decodedPolyFeatureA = readFeature(
    decodeBytesA,
    4_096,
    cache,
    shape,
  ) as OVectorPolys3DFeature;
  const decodedPolyFeatureB = readFeature(
    decodeBytesB,
    4_096,
    cache,
    shape,
    mShape,
  ) as OVectorPolys3DFeature;

  it('point features are decoded correctly', () => {
    // ensure data type is accurate:
    expect(decodedPolyFeatureA).toBeInstanceOf(OVectorPolys3DFeature);
    expect(decodedPolyFeatureB).toBeInstanceOf(OVectorPolys3DFeature);

    // ensure accuracy of feature A:
    expect(decodedPolyFeatureA.id).toBe(55);
    expect(decodedPolyFeatureA.properties).toEqual({ name: 'a' });
    expect(decodedPolyFeatureA.extent).toBe(4_096);
    expect(decodedPolyFeatureA.type).toBe(6);
    const geometry = decodedPolyFeatureA.loadGeometry();
    expect(geometry).toEqual([
      [
        [
          { x: 3805, y: 5645, z: 4001 },
          { x: 1, y: 0, z: 3 },
        ],
        [
          { x: 1, y: 0, z: 3 },
          { x: 2, y: -1, z: -9 },
        ],
        [
          { x: 2, y: -1, z: -9 },
          { x: 0, y: -2, z: 0 },
        ],
      ],
    ]);
    expect(decodedPolyFeatureA.geoType()).toEqual('MultiPolygon');
    expect(decodedPolyFeatureA.isPoints()).toBeFalse();
    expect(decodedPolyFeatureA.isLines()).toBeFalse();
    expect(decodedPolyFeatureA.isPolygons()).toBeFalse();
    expect(decodedPolyFeatureA.isPoints3D()).toBeFalse();
    expect(decodedPolyFeatureA.isLines3D()).toBeFalse();
    expect(decodedPolyFeatureA.isPolygons3D()).toBeTrue();

    // ensure accuracy of feature B:
    expect(decodedPolyFeatureB.id).toBe(5_555);
    expect(decodedPolyFeatureB.properties).toEqual({ name: 'b' });
    expect(decodedPolyFeatureB.extent).toBe(4_096);
    expect(decodedPolyFeatureB.type).toBe(6);
    expect(decodedPolyFeatureB.loadGeometry()).toEqual([
      [
        [
          { x: 1, y: 0, z: 3, m: { width: 55 } },
          { x: 2, y: -1, z: -9, m: { width: 0 } },
        ],
        [
          { x: 2, y: -1, z: -3, m: { width: 0 } },
          { x: 0, y: -2, z: 22, m: { width: 0 } },
        ],
      ],
      [
        [
          { x: 0, y: -2, z: 0, m: { width: 0 } },
          { x: 300, y: 500, z: 300, m: { width: 0 } },
        ],
        [
          { x: 300, y: 500, z: 100, m: { width: 0 } },
          { x: 0, y: 0, z: 0, m: { width: 0 } },
        ],
      ],
      [
        [
          { x: 0, y: 0, z: 0, m: { width: 0 } },
          { x: 300, y: 500, z: 300, m: { width: 0 } },
        ],
        [
          { x: 300, y: 500, z: 300, m: { width: 0 } },
          { x: 0, y: -2, z: 0, m: { width: 0 } },
        ],
        [
          { x: 0, y: -2, z: 0, m: { width: 0 } },
          { x: 300, y: 500, z: 200, m: { width: 0 } },
        ],
      ],
    ]);
    expect(decodedPolyFeatureB.loadPoints()).toEqual([
      { x: 1, y: 0, z: 3, m: { width: 55 } },
      { x: 2, y: -1, z: -9, m: { width: 0 } },
      { x: 2, y: -1, z: -3, m: { width: 0 } },
      { x: 0, y: -2, z: 22, m: { width: 0 } },
      { x: 0, y: -2, z: 0, m: { width: 0 } },
      { x: 300, y: 500, z: 300, m: { width: 0 } },
      { x: 300, y: 500, z: 100, m: { width: 0 } },
      { x: 0, y: 0, z: 0, m: { width: 0 } },
      { x: 0, y: 0, z: 0, m: { width: 0 } },
      { x: 300, y: 500, z: 300, m: { width: 0 } },
      { x: 300, y: 500, z: 300, m: { width: 0 } },
      { x: 0, y: -2, z: 0, m: { width: 0 } },
      { x: 0, y: -2, z: 0, m: { width: 0 } },
      { x: 300, y: 500, z: 200, m: { width: 0 } },
    ]);
    expect(decodedPolyFeatureB.loadLines()).toEqual([
      {
        geometry: [
          { x: 1, y: 0, z: 3, m: { width: 55 } },
          { x: 2, y: -1, z: -9, m: { width: 0 } },
        ],
        offset: 4.4,
      },
      {
        geometry: [
          { x: 2, y: -1, z: -3, m: { width: 0 } },
          { x: 0, y: -2, z: 22, m: { width: 0 } },
        ],
        offset: 1004,
      },
      {
        geometry: [
          { x: 0, y: -2, z: 0, m: { width: 0 } },
          { x: 300, y: 500, z: 300, m: { width: 0 } },
        ],
        offset: 102.2,
      },
      {
        geometry: [
          { x: 300, y: 500, z: 100, m: { width: 0 } },
          { x: 0, y: 0, z: 0, m: { width: 0 } },
        ],
        offset: 2.2,
      },
      {
        geometry: [
          { x: 0, y: 0, z: 0, m: { width: 0 } },
          { x: 300, y: 500, z: 300, m: { width: 0 } },
        ],
        offset: 5.5,
      },
      {
        geometry: [
          { x: 300, y: 500, z: 300, m: { width: 0 } },
          { x: 0, y: -2, z: 0, m: { width: 0 } },
        ],
        offset: 0,
      },
      {
        geometry: [
          { x: 0, y: -2, z: 0, m: { width: 0 } },
          { x: 300, y: 500, z: 200, m: { width: 0 } },
        ],
        offset: 0,
      },
    ]);
    const [geoWithTess, indices] = decodedPolyFeatureB.loadGeometryFlat();
    expect(geoWithTess).toEqual([
      0.000244140625, 0, 0.00048828125, -0.000244140625, 0.00048828125, -0.000244140625, 0,
      -0.00048828125, 0, -0.00048828125, 0.0732421875, 0.1220703125, 0.0732421875, 0.1220703125, 0,
      0, 0, 0, 0.0732421875, 0.1220703125, 0.0732421875, 0.1220703125, 0, -0.00048828125, 0,
      -0.00048828125, 0.0732421875, 0.1220703125, 0.928955078125, 1.378173828125, 0.976806640625,
      0.000244140625, 0, 0.000732421875,
    ]);
    expect(indices).toEqual([0, 1, 5, 2]);
    expect(decodedPolyFeatureB.bbox()).toEqual([
      0.10000348687194105, 1.1000008046627556, 2.299994367360739, 3.3000024139882527, -50, 120,
    ]);
  });
});
