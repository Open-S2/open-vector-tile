// import { MltDecoder, TileSetMetadata } from '@maplibre/maplibre-tile-spec';
import { VectorTile, writeOVTile } from '../src';
import { brotliCompressSync, gzipSync } from 'zlib';

import { ZstdInit, ZstdStream } from '@oneidentity/zstd-js';

await ZstdInit();

const MVT = await Bun.file(`${__dirname}/data/omt/mvt/2_2_2.mvt`).arrayBuffer();
const MVT_GZIP = gzipSync(MVT);
const MVT_BROTLI = brotliCompressSync(MVT);
const MVT_ZSTD = ZstdStream.compress(new Uint8Array(MVT), 22);
const COVT = await Bun.file(`${__dirname}/data/omt/covt/2_2_2.covt`).arrayBuffer();
const tile = new VectorTile(MVT);
const OVT_NONE = writeOVTile(tile);
const OVT_GZIP = gzipSync(OVT_NONE);
const OVT_BROTLI = brotliCompressSync(OVT_NONE);
const OVT_ZSTD = ZstdStream.compress(OVT_NONE, 22);

console.info('MVT', MVT.byteLength);
console.info('MVT GZIP', MVT_GZIP.byteLength);
console.info('MVT BROTLI', MVT_BROTLI.byteLength);
console.info('MVT ZSTD', MVT_ZSTD.byteLength);
console.info('\n\n\n');
console.info('OVT NONE', OVT_NONE.byteLength);
console.info('OVT GZIP', OVT_GZIP.byteLength);
console.info('OVT BROTLI', OVT_BROTLI.byteLength);
console.info('OVT ZSTD', OVT_ZSTD.byteLength);
console.info('\n\n\n');
console.info('OVT COVT', COVT.byteLength);
