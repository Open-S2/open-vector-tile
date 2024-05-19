import { VectorTile } from '../src';
import fs from 'fs';
import path from 'path';

const FOLDER = 'bing';
const XYZ = '4_8_5';
const FILE_TYPE = 'mvt';

const data = fs.readFileSync(
  path.join(__dirname, `../benchmarks/data/${FOLDER}/mvt/${XYZ}.${FILE_TYPE}`),
);
const tile = new VectorTile(new Uint8Array(data));

console.info(tile.layers);
// const { poi } = tile.layers;
// const first = poi.feature(0);
// const second = poi.feature(1);
// const third = poi.feature(2);
// console.log(first, second, third);
