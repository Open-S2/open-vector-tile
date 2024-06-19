import fs from 'fs';
import path from 'path';

import { brotliCompressSync } from 'zlib';
import { markdownTable } from 'markdown-table';
import { VectorTile, writeOVTile } from '../src';

/** Finding the averages for each zoom or all */
interface AverageTracker {
  sum: number;
  total: number;
  average: number;
}

/** Find the averages for each zoom and total */
interface SizeBenchmarks {
  all: AverageTracker;
  [zoom: number]: AverageTracker;
}

const RULES = [
  { folder: 'amazon', fileType: 'pbf' },
  // { folder: 'test', fileType: 'pbf' },
  // { folder: 'amazon_here', fileType: 'pbf' },
  // { folder: 'bing', fileType: 'mvt' },
  // { folder: 'omt', fileType: 'mvt' },
];

const sizeBenchmarks: SizeBenchmarks = {
  all: { sum: 0, total: 0, average: 0 },
};

for (const { folder, fileType } of RULES) {
  // console.info(`${folder}`);
  const fileList = getFileList(folder);

  for (const { fileName, zoom } of fileList) {
    const sizes = buildFilesizeBenchmarks(folder, fileName, fileType);
    addBench(sizeBenchmarks, sizes, zoom);
  }

  buildAverages(sizeBenchmarks);
}

const tables = buildTables(sizeBenchmarks);
const tablePretty = markdownTable(tables, {
  align: ['l', 'r'],
  padding: true,
});
console.info(tablePretty);

/**
 * @param benchmarks - all size benchmarks
 * @param sizes - all compression types to add
 * @param zoom - the zoom at which we analyzed
 */
function addBench(benchmarks: SizeBenchmarks, sizes: AllFileSizes, zoom: number): void {
  benchmarks.all.sum += sizes.diff;
  benchmarks.all.total++;
  if (benchmarks[zoom] === undefined) {
    benchmarks[zoom] = { sum: 0, total: 0, average: 0 };
  }
  benchmarks[zoom].sum += sizes.diff;
  benchmarks[zoom].total++;
}

/**
 * @param benchmarks - all size benchmarks
 */
function buildAverages(benchmarks: SizeBenchmarks) {
  for (const zoom in benchmarks) {
    benchmarks[zoom].average = benchmarks[zoom].sum / benchmarks[zoom].total;
  }
}

/**
 * @param folder - head dir folder name to parse
 * @returns list of file names
 */
function getFileList(folder: string): { fileName: string; zoom: number }[] {
  const files = fs.readdirSync(`./benchmarks/data/${folder}/covt`);
  return files.map((file) => {
    const fileName = file.split('.')[0];
    const zoom = fileName.split('_')[0];
    return { fileName, zoom: parseInt(zoom) };
  });
}

/**
 * Get file sizes for every vector format
 */
interface AllFileSizes {
  covt: number;
  ovt: number;
  diff: number;
}

/**
 * From each file build normal, gzip, and brotli for:
 * - MVT
 * - COVT
 * - OVT
 * @param folder - head dir folder name
 * @param xyz - will be the file name like "z_x_y.pbf" without the pbf
 * @param fileType - in the mvt folder sometimes its pbf, sometimes its mvt
 * @returns AllFileSizes and compression formats for each tile format
 */
function buildFilesizeBenchmarks(folder: string, xyz: string, fileType: string): AllFileSizes {
  const MVT = fs.readFileSync(
    path.join(__dirname, `../benchmarks/data/${folder}/mvt/${xyz}.${fileType}`),
  );
  const COVT = fs.readFileSync(
    path.join(__dirname, `../benchmarks/data/${folder}/covt/${xyz}.covt`),
  );
  const tile = new VectorTile(new Uint8Array(MVT));

  const OVT = writeOVTile(tile);

  return {
    covt: brotliCompressSync(COVT).length,
    ovt: brotliCompressSync(OVT).length,
    diff: brotliCompressSync(OVT).length - brotliCompressSync(COVT).length,
  };
}

/**
 * Filesize Benchmarks setup for pretty table printing
 */
type BenchTables = Array<[string, string]>;

/**
 * @param benchmarks - all size benchmarks
 * @returns all the benchmarks in a table format
 */
function buildTables(benchmarks: SizeBenchmarks): BenchTables {
  const benchTables: BenchTables = [['zoom', 'diff']];

  for (const zoom in benchmarks) {
    benchTables.push([zoom, formatBytes(benchmarks[zoom].average)]);
  }

  return benchTables;
}

/**
 * @param bytes - number of bytes
 * @returns formatted bytes
 */
function formatBytes(bytes: number): string {
  return (bytes / 1024).toFixed(2) + ' kB';
}
