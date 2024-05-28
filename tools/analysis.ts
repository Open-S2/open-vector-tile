import { VectorTile } from '../src';
import fs from 'fs';
import path from 'path';

// const FOLDER = 'bing';
// const XYZ = '4_8_5';
// const FILE_TYPE = 'mvt';

// const FOLDER = 'test';
// const XYZ = '5_5_11';
// const FILE_TYPE = 'pbf';

const FOLDER = 'omt';
const XYZ = '4_3_9';
const FILE_TYPE = 'mvt';

// const FOLDER = 'omt';
// const XYZ = '2_2_2';
// const FILE_TYPE = 'mvt';

const data = fs.readFileSync(
  path.join(__dirname, `../benchmarks/data/${FOLDER}/mvt/${XYZ}.${FILE_TYPE}`),
);
const tile = new VectorTile(new Uint8Array(data));

// console.info(tile.layers);
// const layer = tile.layers.transportation;
// // const layer = tile.layers['Admin0 forest or park'];
// // // const { poi } = tile.layers;
// const first = layer.feature(0);
// const second = layer.feature(1);
// const third = layer.feature(2);
// console.info(first, second, third);

// for every layer and every feature in the layer, store unique strings
const strings: Set<string> = new Set();
for (const layer of Object.values(tile.layers)) {
  strings.add(layer.name);
  for (let i = 0; i < layer.length; i++) {
    const properties = layer.feature(i).properties;
    for (const [key, value] of Object.entries(properties)) {
      strings.add(key);
      if (typeof value === 'string') strings.add(value);
    }
  }
}
console.info(strings);

Bun.write('./strings.json', JSON.stringify([...strings]));
// place all the strings in a buffer to see how big it is
const buffers = [...strings].map((s) => Buffer.from(s));
const concatBuf = Buffer.concat(buffers);
console.info(concatBuf.length);
