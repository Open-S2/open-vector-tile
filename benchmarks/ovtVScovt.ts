import fs from 'fs';
import path from 'path';

import { markdownTable } from 'markdown-table';
import { VectorTile, writeOVTile } from '../src';
import { brotliCompressSync, gzipSync } from 'zlib';

/**
 * Finding the averages for each zoom or all
 */
interface AverageTracker {
  sum: number;
  total: number;
  average: number;
}

/**
 * Find the averages for each zoom and total
 */
interface SizeBenchmarks {
  all: AverageTracker;
  [zoom: number]: AverageTracker;
}

/**
 * compression is either raw, gzip, or brotli
 */
interface CompressionBenchmarks {
  raw: SizeBenchmarks;
  gzip: SizeBenchmarks;
  brotli: SizeBenchmarks;
}

/**
 * Finding the averages for each format
 */
interface AllSizeBenchmarks {
  covt: CompressionBenchmarks;
  mvt: CompressionBenchmarks;
  ovt: CompressionBenchmarks;
}

const RULES = [
  // { folder: 'amazon', fileType: 'pbf' },
  // { folder: 'amazon_here', fileType: 'pbf' },
  // { folder: 'bing', fileType: 'mvt' },
  { folder: 'omt', fileType: 'mvt' },
];

const sizeBenchmarks: AllSizeBenchmarks = {
  covt: {
    raw: { all: { sum: 0, total: 0, average: 0 } },
    gzip: { all: { sum: 0, total: 0, average: 0 } },
    brotli: { all: { sum: 0, total: 0, average: 0 } },
  },
  mvt: {
    raw: { all: { sum: 0, total: 0, average: 0 } },
    gzip: { all: { sum: 0, total: 0, average: 0 } },
    brotli: { all: { sum: 0, total: 0, average: 0 } },
  },
  ovt: {
    raw: { all: { sum: 0, total: 0, average: 0 } },
    gzip: { all: { sum: 0, total: 0, average: 0 } },
    brotli: { all: { sum: 0, total: 0, average: 0 } },
  },
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
for (const table in tables) {
  console.info(`\n${table.toUpperCase()}:\n`);
  const tablePretty = markdownTable(tables[table], {
    align: ['l', 'r', 'r', 'r'],
    padding: true,
  });
  console.info(tablePretty);
}

/**
 * @param benchmarks - all size benchmarks
 * @param sizes - all compression types to add
 * @param zoom - the zoom at which we analyzed
 */
function addBench(benchmarks: AllSizeBenchmarks, sizes: AllFileSizes, zoom: number): void {
  for (const tileFormat in sizes) {
    const compressions = sizes[tileFormat] as FileSizes;
    for (const compress in compressions) {
      const compressValue = compressions[compress] as number;
      if (benchmarks[tileFormat][compress][zoom] === undefined) {
        benchmarks[tileFormat][compress][zoom] = { sum: 0, total: 0, average: 0 };
      }
      benchmarks[tileFormat][compress][zoom].sum += compressValue;
      benchmarks[tileFormat][compress][zoom].total++;
      benchmarks[tileFormat][compress].all.sum += compressValue;
      benchmarks[tileFormat][compress].all.total++;
    }
  }
}

/**
 * @param benchmarks - all size benchmarks
 */
function buildAverages(benchmarks: AllSizeBenchmarks) {
  for (const tileFormat in benchmarks) {
    for (const compressionType in benchmarks[tileFormat]) {
      for (const zoom in benchmarks[tileFormat][compressionType]) {
        benchmarks[tileFormat][compressionType][zoom].average =
          benchmarks[tileFormat][compressionType][zoom].sum /
          benchmarks[tileFormat][compressionType][zoom].total;
      }
      benchmarks[tileFormat][compressionType].all.average =
        benchmarks[tileFormat][compressionType].all.sum /
        benchmarks[tileFormat][compressionType].all.total;
    }
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
 * Get the file sizes for compression format
 */
interface FileSizes {
  raw: number;
  gzip: number;
  brotli: number;
}

/**
 * Get file sizes for every vector format
 */
interface AllFileSizes {
  covt: FileSizes;
  mvt: FileSizes;
  ovt: FileSizes;
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
    covt: {
      raw: COVT.length,
      gzip: gzipSync(COVT).length,
      brotli: brotliCompressSync(COVT).length,
    },
    mvt: {
      raw: MVT.length,
      gzip: gzipSync(MVT).length,
      brotli: brotliCompressSync(MVT).length,
    },
    ovt: {
      raw: OVT.length,
      gzip: gzipSync(OVT).length,
      brotli: brotliCompressSync(OVT).length,
    },
  };
}

/**
 * Filesize Benchmarks setup for pretty table printing
 */
// type BenchTable = Array<{
//   zoom: string;
//   average: number;
//   format: 'mvt' | 'covt' | 'ovt';
//   percentMVT: number;
// }>;
type BenchTable = Array<
  [
    string, // zoom
    number, // average
    string, // format: 'mvt' | 'covt' | 'ovt';
    number, // percentMVT: number;
  ]
>;

/**
 * Filesize Benchmarks setup for pretty table printing
 */
interface BenchTables {
  raw: BenchTable;
  gzip: BenchTable;
  brotli: BenchTable;
}

/**
 * @param benchmarks - all size benchmarks
 * @returns all the benchmarks in a table format
 */
function buildTables(benchmarks: AllSizeBenchmarks): BenchTables {
  const benchTables = {
    raw: [['zoom', 'mvt', 'covt', 'ovt']],
    gzip: [['zoom', 'mvt', 'covt', 'ovt']],
    brotli: [['zoom', 'mvt', 'covt', 'ovt']],
  };
  // match a zoom to the table index. I did the benchmark storage backwards -_-
  const zoomTable: { [zoom: number]: number } = {};
  let zoomIndex = 1;

  for (const tileFormat in benchmarks) {
    const formats = benchmarks[tileFormat];
    for (const compress in formats) {
      const compressions = formats[compress];
      for (const zoom in compressions) {
        if (zoomTable[zoom] === undefined) {
          zoomTable[zoom] = zoomIndex;
          zoomIndex++;
        }
        const compressValue = compressions[zoom];
        const compressTable = benchTables[compress];
        const tableIndex = zoomTable[zoom];
        const average = formatBytes(compressValue.average);
        if (compressTable[tableIndex] === undefined) {
          compressTable[tableIndex] = [zoom];
        }
        if (tileFormat === 'mvt') {
          compressTable[tableIndex][1] = average;
        } else if (tileFormat === 'covt') {
          compressTable[tableIndex][2] = average;
        } else if (tileFormat === 'ovt') {
          compressTable[tableIndex][3] = average;
        }
      }
    }
  }

  // @ts-expect-error - the first line will be all strings
  return benchTables;
}

/**
 * @param bytes - number of bytes
 * @returns formatted bytes
 */
function formatBytes(bytes: number): string {
  return (bytes / 1024).toFixed(2) + ' kB';
}
