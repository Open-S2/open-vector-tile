import fs from 'fs';
import path from 'path';
import { VectorTile, writeOVTile } from '../src';
import { brotliCompressSync, gzipSync } from 'zlib';

// const data = fs.readFileSync(
//   path.join(__dirname, '../test/fixtures/14-8801-5371.vector.pbf'),
// ) as Uint8Array;

const data = fs.readFileSync(path.join(__dirname, '../benchmarks/data/omt/mvt/2_2_2.mvt'));
const covtData = fs.readFileSync(path.join(__dirname, '../benchmarks/data/omt/covt/2_2_2.covt'));
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

// NOT WORKING
// Default:
// MVT: 578549 bytes -> COVT: 310123 bytes -> OVT: 317657 bytes
// Gzip:
// MVT: 317773 bytes -> COVT: 184973 bytes -> OVT: 128753 bytes
// Brotli:
// MVT: 169112 bytes -> COVT: 166436 bytes -> OVT: 84220 bytes
// Brotli is 50% the size of the Mapbox Vector Tile

// LOTS OF ADDITIONS
// Default:
// MVT: 578549 bytes -> COVT: 310123 bytes -> OVT: 364019 bytes
// Gzip:
// MVT: 317773 bytes -> COVT: 184973 bytes -> OVT: 141613 bytes
// Brotli:
// MVT: 169112 bytes -> COVT: 166436 bytes -> OVT: 104648 bytes

// WORKING + BACK TO BASICS
// Default:
// MVT: 578549 bytes -> COVT: 310123 bytes -> OVT: 371611 bytes
// Gzip:
// MVT: 317773 bytes -> COVT: 184973 bytes -> OVT: 131232 bytes
// Brotli:
// MVT: 169112 bytes -> COVT: 166436 bytes -> OVT: 97359 bytes
