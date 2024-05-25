import fs from 'fs';
import path from 'path';
import { VectorTile, writeOVTile } from '../src';

const files = fs.readdirSync(path.join(__dirname, `../test/fixtures`));
for (const file of files) {
  const name = file.split('.')[0];
  const fullPath = path.join(__dirname, `../test/fixtures/${file}`);
  const data = fs.readFileSync(fullPath);
  const tile = new VectorTile(new Uint8Array(data));
  const result = writeOVTile(tile);
  console.info('writing', name);
  fs.writeFileSync(path.join(__dirname, `../test/fixtures/${name}.ovt`), result);
}
