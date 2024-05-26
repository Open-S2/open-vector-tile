import { BaseVectorTile } from '../../src/baseVectorTile';
import { VectorTile } from '../../src';
import { describe, expect, it } from 'bun:test';

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
