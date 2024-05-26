import { BaseVectorLayer } from '../../src/baseVectorTile';
import { Pbf as Protobuf } from '../../src/pbf';
import { ColumnCacheReader, ColumnCacheWriter } from '../../src/openVectorTile';
import {
  OVectorLayer,
  decodeExtent,
  encodeExtent,
  writeOVLayer,
} from '../../src/openVectorTile/vectorLayer';
import { describe, expect, it } from 'bun:test';

describe('encodeExtent and decodeExtent', () => {
  it('should encode', () => {
    expect(encodeExtent(8192)).toEqual(4);
    expect(encodeExtent(4096)).toEqual(3);
    expect(encodeExtent(2048)).toEqual(2);
    expect(encodeExtent(1024)).toEqual(1);
    expect(encodeExtent(512)).toEqual(0);
  });

  it('should decode', () => {
    expect(decodeExtent(4)).toEqual(8192);
    expect(decodeExtent(3)).toEqual(4096);
    expect(decodeExtent(2)).toEqual(2048);
    expect(decodeExtent(1)).toEqual(1024);
    expect(decodeExtent(0)).toEqual(512);
  });
});

describe('OVectorLayer', () => {
  const pbf = new Protobuf();
  const reader = new ColumnCacheReader(pbf);
  const layer = new OVectorLayer(pbf, 0, reader);

  it('should instantiate', () => {
    expect(layer).toBeInstanceOf(OVectorLayer);
  });

  it('should have length', () => {
    expect(layer.length).toEqual(0);
  });

  it('no features should throw', () => {
    expect(() => layer.feature(0)).toThrow('feature index out of bounds');
  });
});

describe('force writeOVLayer to verbose print', () => {
  const pbf = new Protobuf();
  const writer = new ColumnCacheWriter();
  const layer = new BaseVectorLayer(1, 'test');
  writeOVLayer(
    {
      layer,
      cache: writer,
    },
    pbf,
    true,
  );
});
