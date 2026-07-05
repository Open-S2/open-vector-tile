import { VectorTileWASM } from '../src/index.js';
import { expect, test } from 'bun:test';

test('VectorTileWASM', () => {
  const vtWasm = new VectorTileWASM();
  expect(vtWasm).toBeInstanceOf(VectorTileWASM);
});
