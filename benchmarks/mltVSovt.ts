import { MltDecoder, TileSetMetadata } from '@maplibre/maplibre-tile-spec';
import { VectorTile, writeOVTile } from '../src';

const FOLDER = 'bing';
const XYZ = '4_8_5';

const MVT = await Bun.file(`${__dirname}/data/${FOLDER}/mvt/${XYZ}.mvt`).arrayBuffer();
const MLT = await Bun.file(`${__dirname}/data/${FOLDER}/mlt/${XYZ}.mlt`).arrayBuffer();
const MLT_META = await Bun.file(
  `${__dirname}/data/${FOLDER}/mlt/${XYZ}.mlt.meta.pbf`,
).arrayBuffer();
const mvTile = new VectorTile(new Uint8Array(MVT));
const OVT = writeOVTile(mvTile);

const ovtTile = new VectorTile(OVT);

let mvtFeaturesTotal = 0;
let mvtProps;
const startMVT = Bun.nanoseconds();
for (const [_name, layer] of Object.entries(mvTile.layers)) {
  // grab features
  for (let i = 0; i < layer.length; i++) {
    mvtFeaturesTotal++;
    const feature = layer.feature(i);
    const _geometry = feature.loadGeometry();
    if (feature.properties.name === 'Slovenia') mvtProps = feature.properties;
  }
}
const endMVT = Bun.nanoseconds();
console.info('MVT', (endMVT - startMVT) / 1_000_000);

let ovtFeaturesTotal = 0;
let ovtProps;
const startOVT = Bun.nanoseconds();
for (const [_name, layer] of Object.entries(ovtTile.layers)) {
  // grab features
  for (let i = 0; i < layer.length; i++) {
    ovtFeaturesTotal++;
    const feature = layer.feature(i);
    const _geometry = feature.loadGeometry();
    if (feature.properties.name === 'Slovenia') ovtProps = feature.properties;
  }
}
const endOVT = Bun.nanoseconds();
console.info('OVT', (endOVT - startOVT) / 1_000_000);

let mltFeaturesTotal = 0;
let mltProps;
const startMLT = Bun.nanoseconds();
const mltTilesetMetadata = TileSetMetadata.fromBinary(new Uint8Array(MLT_META));
const mltTile = MltDecoder.decodeMlTile(new Uint8Array(MLT), mltTilesetMetadata);
for (const [_name, layer] of Object.entries(mltTile.layers)) {
  // grab features
  for (const feature of layer.features) {
    mltFeaturesTotal++;
    const _geometry = feature.loadGeometry();
    if (feature.properties.name === 'Slovenia') mltProps = feature.properties;
  }
}
const endMLT = Bun.nanoseconds();
console.info('MLT', (endMLT - startMLT) / 1_000_000);

console.info('\n\n\n');

console.info('MVT: ', mvtProps);
console.info('OVT: ', ovtProps);
console.info('MLT: ', mltProps);
console.info('features:', mvtFeaturesTotal, ovtFeaturesTotal, mltFeaturesTotal);
console.info('length:', MVT.byteLength, OVT.byteLength, MLT.byteLength);
