import fs from 'fs';
import path from 'path';
import { VectorTile, writeOVTile } from '../src';
import { brotliCompressSync, gzipSync } from 'zlib';

// const data = fs.readFileSync(
//   path.join(__dirname, '../test/fixtures/14-8801-5371.vector.pbf'),
// ) as Uint8Array;

// const FOLDER = 'amazon';
// const XYZ = '5_5_11';
// const FILE_TYPE = 'pbf';

const FOLDER = 'omt';
const XYZ = '2_2_2';
const FILE_TYPE = 'mvt';

// const FOLDER = 'omt';
// const XYZ = '4_3_9';
// const FILE_TYPE = 'mvt';

// const FOLDER = 'bing';
// const XYZ = '11_603_769';
// const FILE_TYPE = 'mvt';

const data = fs.readFileSync(
  path.join(__dirname, `../benchmarks/data/${FOLDER}/mvt/${XYZ}.${FILE_TYPE}`),
);
const covtData = fs.readFileSync(
  path.join(__dirname, `../benchmarks/data/${FOLDER}/covt/${XYZ}.covt`),
);
const tile = new VectorTile(new Uint8Array(data));

const result = writeOVTile(tile);

console.info(
  `Default:\nMVT: ${data.byteLength} bytes -> COVT: ${covtData.byteLength} bytes -> OVT: ${result.byteLength} bytes`,
);
console.info(
  `Gzip:\nMVT: ${gzipSync(data).byteLength} bytes -> COVT: ${gzipSync(covtData).byteLength} bytes -> OVT: ${gzipSync(result).byteLength} bytes`,
);
console.info(
  `Brotli:\nMVT: ${brotliCompressSync(data).length} bytes -> COVT: ${brotliCompressSync(covtData).length} bytes -> OVT: ${brotliCompressSync(result).length} bytes`,
);

// amazon (5_5_11)
// Default:
// MVT: 393103 bytes -> COVT: 162691 bytes -> OVT: 143714 bytes
// Gzip:
// MVT: 176110 bytes -> COVT: 128045 bytes -> OVT: 49332 bytes
// Brotli:
// MVT: 137233 bytes -> COVT: 115701 bytes -> OVT: 38418 bytes

// omt (2_2_2)
// Default:
// MVT: 578549 bytes -> COVT: 310123 bytes -> OVT: 460414 bytes
// Gzip:
// MVT: 317773 bytes -> COVT: 184973 bytes -> OVT: 206084 bytes
// Brotli:
// MVT: 169112 bytes -> COVT: 166436 bytes -> OVT: 164576 bytes

// bing (11_603_769)
// Default:
// MVT: 53040 bytes -> COVT: 41999 bytes -> OVT: 51591 bytes
// Gzip:
// MVT: 43068 bytes -> COVT: 33947 bytes -> OVT: 38313 bytes
// Brotli:
// MVT: 40598 bytes -> COVT: 31790 bytes -> OVT: 34205 bytes
