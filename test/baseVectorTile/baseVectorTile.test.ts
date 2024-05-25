import fs from 'fs';
import path from 'path';
import { BaseVectorTile, VectorTile } from '../../src';
import { describe, expect, it } from 'bun:test';

describe('BaseVectorTile', () => {
  const layer = new BaseVectorTile();

  it('should be an instance of BaseVectorTile', () => {
    expect(layer).toBeInstanceOf(BaseVectorTile);
  });

  it('should parse a mapbox tile', () => {
    const data = fs.readFileSync(path.join(__dirname, '../fixtures/lots-of-tags.vector.pbf'));
    const tile = new VectorTile(data);
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
