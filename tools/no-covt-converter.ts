import fs from 'fs';
import path from 'path';
import { VectorTile, writeOVTile } from '../src';
import { brotliCompressSync, gzipSync } from 'zlib';

// const data = fs.readFileSync(
//   path.join(__dirname, '../test/fixtures/14-8801-5371.vector.pbf'),
// ) as Uint8Array;

// const FOLDER = 'amazon_here';
// const XYZ = '4_8_5';
// const FILE_TYPE = 'pbf';

const FOLDER = 'omt';
const XYZ = '2_2_2';
const FILE_TYPE = 'mvt';
// const FOLDER = 'bing';
// const XYZ = '11_603_769';
// const FILE_TYPE = 'mvt';

const data = fs.readFileSync(
  path.join(__dirname, `../benchmarks/data/${FOLDER}/mvt/${XYZ}.${FILE_TYPE}`),
);
const tile = new VectorTile(new Uint8Array(data));

const result = writeOVTile(tile);

console.info(`Default:\nMVT: ${data.byteLength} bytes -> OVT: ${result.byteLength} bytes`);
console.info(
  `Gzip:\nMVT: ${gzipSync(data).byteLength} bytes -> OVT: ${gzipSync(result).byteLength} bytes`,
);
console.info(
  `Brotli:\nMVT: ${brotliCompressSync(data).length} bytes -> OVT: ${brotliCompressSync(result).length} bytes`,
);
